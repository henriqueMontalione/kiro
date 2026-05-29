import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '@/context/WalletContext';
import { useQuote } from '@/context/QuoteContext';
import { formatBRL, submitXdr } from '@/lib/stellar';
import { usePrivy } from '@privy-io/react-auth';
import { createTransaction, tesouroToStroops } from '@/lib/api/transactions';
import { useTransactions } from '@/context/TransactionsContext';
import {
  getBankAccounts,
  getQuote,
  createOrder,
  getOrder,
  sandboxApprove,
  type QuoteResult,
} from '@/lib/anchors/etherfuse/client';

const SANDBOX_ENABLED = import.meta.env.VITE_ETHERFUSE_SANDBOX === 'true';

type Step = 'loading' | 'no_wallet' | 'amount' | 'confirm' | 'processing' | 'done' | 'error';

const CUSTOMER_KEY = 'kiro_ef_customer_id';
const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';

interface SacarPixModalProps {
  open: boolean;
  onClose: () => void;
}

export function SacarPixModal({ open, onClose }: SacarPixModalProps) {
  const { isConnected, publicKey, balance, connect, signTransaction, refreshBalance } = useWallet();
  const { getAccessToken } = usePrivy();
  const { brlPerTesouro, brlToTesouro, formatTesouroAsBRL, refresh: refreshRate } = useQuote();
  const { refresh: refreshTxs } = useTransactions();

  const [step, setStep] = useState<Step>('loading');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [processingMsg, setProcessingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const cancelRef = useRef(false);
  const customerIdRef = useRef('');
  const bankAccountIdRef = useRef('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const startFlow = useCallback(async () => {
    setStep('loading');
    cancelRef.current = false;

    const customerId = localStorage.getItem(CUSTOMER_KEY) ?? '';
    let bankAccId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? '';

    if (!customerId) {
      setErrorMsg('Complete a verificação de identidade antes de sacar.');
      setStep('error');
      return;
    }

    customerIdRef.current = customerId;

    try {
      const accounts = await getBankAccounts(customerId);
      if (accounts.length > 0) {
        bankAccId = accounts[0].id;
        localStorage.setItem(BANK_ACCOUNT_KEY, bankAccId);
      }
    } catch { /* keep stored ID */ }

    bankAccountIdRef.current = bankAccId;
    setStep('amount');
  }, []);

  useEffect(() => {
    if (!open) {
      cancelRef.current = true;
      return;
    }
    setAmount('');
    setQuote(null);
    setErrorMsg('');

    if (!isConnected || !publicKey) {
      setStep('no_wallet');
      return;
    }
    startFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && isConnected && publicKey && step === 'no_wallet') {
      startFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, publicKey]);

  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(() => {
      refreshBalance().catch(() => { /* silent */ });
    }, 6000);
    return () => clearTimeout(timer);
  }, [step, refreshBalance]);

  async function handleGetQuote() {
    const cents = parseInt(amount.replace(/\D/g, ''), 10);
    if (!publicKey || isNaN(cents) || cents <= 0) return;
    const brl = cents / 100;
    const tesouro = brlToTesouro(brl);
    if (tesouro == null || tesouro <= 0) return;

    setStep('loading');
    try {
      const q = await tryQuoteWithSandboxRecovery(tesouro);
      setQuote(q);
      setStep('confirm');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao obter cotação');
      setStep('error');
    }
  }

  async function tryQuoteWithSandboxRecovery(num: number) {
    try {
      return await getQuote(customerIdRef.current, num.toFixed(7));
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isAgreementsError = msg.includes('terms and conditions');
      if (!SANDBOX_ENABLED || !isAgreementsError || !publicKey) throw err;
      await sandboxApprove(customerIdRef.current, publicKey, bankAccountIdRef.current);
      return await getQuote(customerIdRef.current, num.toFixed(7));
    }
  }

  async function handleConfirm() {
    if (!quote || !publicKey) return;
    setStep('processing');
    cancelRef.current = false;

    try {
      setProcessingMsg('Preparando saque...');
      const { orderId } = await createOrder(quote.quoteId, publicKey, bankAccountIdRef.current);

      setProcessingMsg('Aguardando confirmação da rede...');
      const xdr = await pollForXdr(orderId);

      setProcessingMsg('Autorizando...');
      const [signedXdr, authToken] = await Promise.all([signTransaction(xdr), getAccessToken()]);
      if (!authToken) throw new Error('Sessão expirada. Faça login novamente.');

      setProcessingMsg('Finalizando...');
      const stellarTxHash = await submitXdr(signedXdr, authToken);

      const tesouroAmount = tesouroToStroops(quote.sourceAmount);
      const brlAmount = Math.round(parseFloat(quote.destinationAmount) * 100);
      const feeCentavos = Math.round(parseFloat(quote.fee) * 100);
      createTransaction(authToken, {
        direction: 'out',
        tesouro_amount: tesouroAmount,
        brl_amount: brlAmount,
        fee_brl_amount: feeCentavos,
        stellar_tx_hash: stellarTxHash,
        etherfuse_order_id: orderId,
      })
        .then(() => refreshTxs())
        .catch((err) => console.warn('[SacarPixModal] createTransaction failed:', err));

      setStep('done');
    } catch (err) {
      if (cancelRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado');
      setStep('error');
    }
  }

  async function pollForXdr(orderId: string): Promise<string> {
    for (let i = 0; i < 60; i++) {
      if (cancelRef.current) throw new Error('Operação cancelada');
      const order = await getOrder(orderId);
      if (order.burnTransaction) return order.burnTransaction;
      if (order.status === 'failed' || order.status === 'canceled') {
        throw new Error('Ordem cancelada ou falhou. Tente novamente.');
      }
      await new Promise<void>((r) => setTimeout(r, 3000));
    }
    throw new Error('Tempo limite esgotado. Tente novamente.');
  }

  function handleClose() {
    cancelRef.current = true;
    onClose();
  }

  if (!open) return null;

  const maxTesouro = balance ? parseFloat(balance) : 0;
  const maxBRL = brlPerTesouro != null ? maxTesouro * brlPerTesouro : null;

  const amountCents = parseInt(amount.replace(/\D/g, ''), 10);
  const amountBRL = isNaN(amountCents) ? 0 : amountCents / 100;
  const tesouroEquivalent = brlToTesouro(amountBRL);
  const amountValid =
    amountBRL > 0 &&
    tesouroEquivalent != null &&
    tesouroEquivalent > 0 &&
    tesouroEquivalent <= maxTesouro;
  const amountDisplay = amount
    ? amountBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  const SACAR_TUDO_FEE_BUFFER = 0.05;
  const sacarTudoCents =
    maxBRL != null && maxBRL > SACAR_TUDO_FEE_BUFFER
      ? Math.floor((maxBRL - SACAR_TUDO_FEE_BUFFER) * 100)
      : null;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[var(--radius-xl)] border border-[var(--stroke-2)] p-5 md:p-7"
        style={{
          background: 'rgba(20, 22, 32, 0.97)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
          maxHeight: '92vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div className="flex justify-between items-center mb-[22px]">
          <h2 className="k-h2">Sacar via PIX</h2>
          <button
            type="button"
            onClick={handleClose}
            className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer"
            style={{ padding: 4 }}
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </div>

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <span className="text-[14px] text-[var(--fg-3)]">Verificando...</span>
          </div>
        )}

        {step === 'no_wallet' && (
          <div className="flex flex-col gap-5">
            <p className="text-[14px] text-[var(--fg-2)] leading-relaxed">
              Entre na sua conta para sacar via PIX.
            </p>
            <Button variant="primary" size="lg" onClick={() => connect()} className="w-full justify-center">
              Entrar
            </Button>
          </div>
        )}

        {step === 'amount' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-[6px]">
              <label
                className="text-[11px] text-[var(--fg-3)] font-medium uppercase"
                style={{ letterSpacing: '0.04em' }}
              >
                Quanto deseja sacar?
              </label>
              <div
                className="flex items-center gap-[10px] border rounded-[var(--radius-md)]"
                style={{ padding: '14px 16px', borderColor: 'var(--stroke-3)', background: 'var(--bg-3)' }}
              >
                <span className="k-money text-[18px] text-[var(--fg-3)]">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amountDisplay}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0,00"
                  className="bg-transparent border-none outline-none flex-1 min-w-0 k-money font-medium"
                  style={{ fontSize: 28, color: 'var(--kiro-green)' }}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-[var(--fg-3)]">
                  Saldo disponível: {balance && brlPerTesouro != null ? formatTesouroAsBRL(balance) : '—'}
                </p>
                {sacarTudoCents != null && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(sacarTudoCents))}
                    className="text-[12px] font-medium text-[var(--kiro-green)] bg-transparent border-none cursor-pointer hover:underline"
                  >
                    Sacar tudo
                  </button>
                )}
              </div>
              {brlPerTesouro == null && (
                <button
                  type="button"
                  onClick={() => { refreshRate(); }}
                  className="text-[12px] text-[var(--kiro-green)] bg-transparent border-none cursor-pointer self-start"
                >
                  Cotação indisponível — tentar novamente
                </button>
              )}
              {amountBRL > 0 && maxBRL != null && amountBRL > maxBRL && (
                <p className="text-[12px]" style={{ color: '#FF4D6D' }}>
                  Valor maior que o saldo disponível.
                </p>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              iconRight={ChevronRight}
              onClick={handleGetQuote}
              disabled={!amountValid}
              className="w-full justify-center"
            >
              Ver cotação
            </Button>
          </div>
        )}

        {step === 'confirm' && quote && (
          <div className="flex flex-col gap-5">
            <div
              className="rounded-[var(--radius-md)] border border-[var(--stroke-3)] flex flex-col gap-3"
              style={{ padding: '18px 20px', background: 'var(--bg-3)' }}
            >
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-[var(--fg-3)]">Você recebe via PIX</span>
                <span className="text-[18px] font-semibold" style={{ color: 'var(--kiro-green)' }}>
                  {formatBRL(quote.destinationAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-[var(--fg-3)]">Equivalente em TESOURO</span>
                <span className="text-[13px] text-[var(--fg-2)]">
                  {parseFloat(quote.sourceAmount).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{' '}
                  TESOURO
                </span>
              </div>
              <div className="h-px" style={{ background: 'var(--stroke-3)' }} />
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[var(--fg-3)]">Taxa</span>
                <span className="text-[12px] text-[var(--fg-2)]">
                  {parseFloat(quote.fee) > 0 ? formatBRL(quote.fee) : 'Sem taxa'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[var(--fg-3)]">Câmbio</span>
                <span className="text-[12px] text-[var(--fg-2)]">
                  1 TESOURO ={' '}
                  {parseFloat(quote.exchangeRate).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{' '}
                  BRL
                </span>
              </div>
            </div>

            <p className="text-[12px] text-[var(--fg-3)] text-center leading-relaxed">
              O PIX será creditado após a confirmação na rede Stellar. Cotação válida por alguns minutos.
            </p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={ChevronLeft}
                onClick={() => setStep('amount')}
                className="flex-1 justify-center"
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                className="flex-1 justify-center"
              >
                Confirmar saque
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <span className="text-[14px] text-[var(--fg-2)]">{processingMsg}</span>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <CheckCircle size={48} strokeWidth={1.4} style={{ color: 'var(--kiro-green)' }} />
            <div>
              <p className="text-[18px] font-semibold text-[var(--fg-1)] mb-1">PIX enviado!</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
                O valor será creditado na sua conta em instantes.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={handleClose} className="w-full justify-center">
              Fechar
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <AlertCircle size={40} strokeWidth={1.4} style={{ color: 'rgba(255,77,109,0.85)' }} />
            <div>
              <p className="text-[15px] font-medium text-[var(--fg-1)] mb-1">Algo deu errado</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button
                variant="secondary"
                onClick={() => startFlow()}
                className="flex-1 justify-center"
              >
                Tentar novamente
              </Button>
              <Button variant="ghost" onClick={handleClose} className="flex-1 justify-center">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
