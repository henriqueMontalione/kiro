import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertCircle, Copy, Check, Info } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '@/context/WalletContext';
import { formatBRL, submitXdr } from '@/lib/stellar';
import { usePrivy } from '@privy-io/react-auth';
import { createTransaction, tesouroToStroops } from '@/lib/api/transactions';
import { useTransactions } from '@/context/TransactionsContext';
import { TesouroInfoModal } from './TesouroInfoModal';
import {
  getBankAccounts,
  getOnRampQuote,
  createOnRampOrder,
  getOnRampOrder,
  regenerateClaimXdr,
  sandboxApprove,
  simulateOnRampPayment,
  type OnRampQuoteResult,
  type OnRampOrderResult,
} from '@/lib/anchors/etherfuse/client';

const SANDBOX_ENABLED = import.meta.env.VITE_ETHERFUSE_SANDBOX === 'true';

type Step =
  | 'loading'
  | 'no_wallet'
  | 'amount'
  | 'confirm'
  | 'pix'
  | 'claiming'
  | 'done'
  | 'error';

const CUSTOMER_KEY = 'kiro_ef_customer_id';
const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';

interface ReceberPixModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReceberPixModal({ open, onClose }: ReceberPixModalProps) {
  const { isConnected, publicKey, connect, signTransaction, refreshBalance } = useWallet();
  const { getAccessToken } = usePrivy();
  const { refresh: refreshTxs } = useTransactions();

  const [step, setStep] = useState<Step>('loading');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<OnRampQuoteResult | null>(null);
  const [order, setOrder] = useState<OnRampOrderResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [claimingMsg, setClaimingMsg] = useState('');
  const [yieldInfoOpen, setYieldInfoOpen] = useState(false);

  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);
  const customerIdRef = useRef('');
  const bankAccountIdRef = useRef('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const stopPolls = useCallback(() => {
    if (orderPollRef.current) { clearInterval(orderPollRef.current); orderPollRef.current = null; }
  }, []);

  const startOrderPolling = useCallback(
    (orderId: string) => {
      stopPolls();
      orderPollRef.current = setInterval(async () => {
        try {
          const result = await getOnRampOrder(orderId);
          if (result.status === 'completed') {
            stopPolls();
            let claimXdr = result.stellarClaimTransaction;
            if (!claimXdr) {
              try {
                claimXdr = await regenerateClaimXdr(orderId);
              } catch { /* no claimable balance — proceed without claim */ }
            }
            let claimedTxHash = result.confirmedTxSignature ?? null;
            if (claimXdr) {
              setStep('claiming');
              try {
                setClaimingMsg('Autorizando recebimento...');
                const [signedXdr, authToken] = await Promise.all([signTransaction(claimXdr), getAccessToken()]);
                if (!authToken) throw new Error('Sessão expirada. Faça login novamente.');
                setClaimingMsg('Finalizando...');
                claimedTxHash = await submitXdr(signedXdr, authToken);
              } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Erro ao reivindicar TESOURO');
                setStep('error');
                return;
              }
            }
            refreshBalance().catch(() => { /* silent */ });

            if (result.amountInTokens && result.amountInFiat) {
              getAccessToken()
                .then((token) => {
                  if (!token) return;
                  const grossCentavos = Math.round(parseFloat(result.amountInFiat!) * 100);
                  const feeCentavos = Math.round(parseFloat(result.feeAmountInFiat ?? '0') * 100);
                  return createTransaction(token, {
                    direction: 'in',
                    tesouro_amount: tesouroToStroops(result.amountInTokens!),
                    brl_amount: grossCentavos - feeCentavos,
                    fee_brl_amount: feeCentavos,
                    stellar_tx_hash: claimedTxHash ?? undefined,
                    etherfuse_order_id: orderId,
                  }).then(() => refreshTxs());
                })
                .catch((err) => console.warn('[ReceberPixModal] createTransaction failed:', err));
            }

            setStep('done');
          } else if (result.status === 'failed' || result.status === 'canceled') {
            stopPolls();
            setErrorMsg('A ordem foi cancelada ou falhou.');
            setStep('error');
          }
        } catch { /* transient */ }
      }, 5000);
    },
    [stopPolls, refreshBalance, signTransaction],
  );

  const startFlow = useCallback(async () => {
    setStep('loading');
    cancelRef.current = false;
    stopPolls();

    const customerId = localStorage.getItem(CUSTOMER_KEY) ?? '';
    let bankAccId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? '';

    if (!customerId) {
      setErrorMsg('Complete a verificação de identidade antes de receber.');
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
    } catch {
      // Non-fatal: use stored ID. If it's stale the order creation will fail
      // with a clear error rather than silently misbehaving.
    }

    if (!bankAccId) {
      setErrorMsg('Conta de pagamento não encontrada. Refaça o cadastro de verificação.');
      setStep('error');
      return;
    }

    bankAccountIdRef.current = bankAccId;

    // Sandbox: re-run the bypass to ensure agreements are accepted and the PIX
    // proxy account is provisioned. Idempotent on Etherfuse's side. Without
    // this, /ramp/order rejects with "Proxy account not found" when the user
    // finished docs without the bypass having been called (e.g. older session).
    if (SANDBOX_ENABLED && publicKey) {
      try {
        await sandboxApprove(customerId, publicKey, bankAccId);
      } catch (err) {
        console.warn('[ReceberPixModal] sandboxApprove failed:', err);
      }
    }

    setStep('amount');
  }, [stopPolls]);

  useEffect(() => {
    if (!open) {
      stopPolls();
      cancelRef.current = true;
      return;
    }
    setAmount('');
    setQuote(null);
    setOrder(null);
    setErrorMsg('');
    setCopied(false);

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

  useEffect(() => () => stopPolls(), [stopPolls]);

  async function handleGetQuote() {
    const cents = parseInt(amount.replace(/\D/g, ''), 10);
    if (!publicKey || isNaN(cents) || cents <= 0) return;
    const num = cents / 100;

    setStep('loading');
    try {
      const q = await tryQuoteWithSandboxRecovery(num);
      setQuote(q);
      setStep('confirm');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao obter cotação');
      setStep('error');
    }
  }

  async function tryQuoteWithSandboxRecovery(num: number) {
    try {
      return await getOnRampQuote(customerIdRef.current, num.toFixed(2), publicKey ?? undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isAgreementsError = msg.includes('terms and conditions');
      if (!SANDBOX_ENABLED || !isAgreementsError || !publicKey) throw err;
      await sandboxApprove(customerIdRef.current, publicKey, bankAccountIdRef.current);
      return await getOnRampQuote(customerIdRef.current, num.toFixed(2), publicKey);
    }
  }

  async function handleConfirm() {
    if (!quote || !publicKey) return;
    setStep('loading');
    try {
      const o = await createOnRampOrder(quote.quoteId, publicKey, bankAccountIdRef.current);
      setOrder(o);
      setStep('pix');
      startOrderPolling(o.orderId);
      if (SANDBOX_ENABLED) {
        setTimeout(() => {
          simulateOnRampPayment(o.orderId).catch((err) => {
            console.warn('[ReceberPixModal] simulateOnRampPayment failed:', err);
          });
        }, 4000);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar ordem');
      setStep('error');
    }
  }

  async function handleCopyPix() {
    if (!order?.depositPixCode) return;
    try {
      await navigator.clipboard.writeText(order.depositPixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  function handleClose() {
    stopPolls();
    cancelRef.current = true;
    onClose();
  }

  if (!open) return null;

  const amountCents = parseInt(amount.replace(/\D/g, ''), 10);
  const amountNum = isNaN(amountCents) ? 0 : amountCents / 100;
  const amountValid = amountNum > 0;
  const amountDisplay = amount
    ? amountNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  return (
    <>
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
          <h2 className="k-h2">Receber via PIX</h2>
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
            <span className="text-[14px] text-[var(--fg-3)]">Carregando...</span>
          </div>
        )}

        {step === 'no_wallet' && (
          <div className="flex flex-col gap-5">
            <p className="text-[14px] text-[var(--fg-2)] leading-relaxed">
              Entre na sua conta para receber via PIX.
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
                Quanto deseja receber?
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
              <p className="text-[12px] text-[var(--fg-3)]">
                Você pagará via PIX e o equivalente em TESOURO chegará na sua conta.
              </p>
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
                <span className="text-[13px] text-[var(--fg-3)]">Você paga via PIX</span>
                <span className="text-[15px] font-medium text-[var(--fg-1)]">
                  {formatBRL(quote.sourceAmount)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-[13px] text-[var(--fg-3)]">Você recebe</span>
                <div className="flex flex-col items-end gap-[2px]">
                  <span className="flex items-center gap-1.5 text-[18px] font-semibold" style={{ color: 'var(--kiro-green)' }}>
                    {parseFloat(quote.destinationAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TESOURO
                    <button
                      type="button"
                      onClick={() => setYieldInfoOpen(true)}
                      className="flex items-center justify-center cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-3)' }}
                      aria-label="O que é TESOURO?"
                    >
                      <Info size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                  <span className="text-[12px] text-[var(--fg-3)]">
                    ≈ {formatBRL((parseFloat(quote.sourceAmount) - parseFloat(quote.fee)).toFixed(2))}
                  </span>
                </div>
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
                  1 BRL ={' '}
                  {parseFloat(quote.exchangeRate).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{' '}
                  TESOURO
                </span>
              </div>
            </div>

            <p className="text-[12px] text-[var(--fg-3)] text-center leading-relaxed">
              Cotação válida por alguns minutos. O TESOURO chegará na sua conta após a confirmação do PIX.
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
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {step === 'pix' && order && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[var(--fg-2)] text-center leading-relaxed">
              Pague <strong style={{ color: 'var(--kiro-green)' }}>{formatBRL(order.depositAmount)}</strong> via PIX para receber o TESOURO na sua conta.
            </p>

            <div
              className="flex flex-col items-center gap-3 rounded-[var(--radius-md)]"
              style={{ background: '#FFFFFF', padding: 22 }}
            >
              <img
                src="/qr-code.png"
                alt="QR Code PIX"
                style={{ display: 'block', width: 200, height: 200 }}
              />
            </div>

            <div
              className="border rounded-[var(--radius-md)]"
              style={{ padding: '10px 14px', borderColor: 'var(--stroke-3)', background: 'var(--bg-3)' }}
            >
              <span className="block text-[11px] text-[var(--fg-2)] font-mono truncate">
                {order.depositPixCode}
              </span>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleCopyPix}
                className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[var(--stroke-3)] bg-transparent text-[var(--kiro-green)] cursor-pointer text-[12px] font-medium hover:bg-white/[0.04] transition-colors"
                style={{ padding: '8px 18px' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar código PIX'}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[12px] text-[var(--fg-3)] justify-center">
              <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              Aguardando pagamento via PIX
            </div>
          </div>
        )}

        {step === 'claiming' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <span className="text-[14px] text-[var(--fg-2)]">{claimingMsg}</span>
            <p className="text-[12px] text-[var(--fg-3)] text-center max-w-[320px] leading-relaxed">
              Primeira vez recebendo? Estamos configurando sua conta automaticamente — isso leva alguns segundos.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <CheckCircle size={48} strokeWidth={1.4} style={{ color: 'var(--kiro-green)' }} />
            <div>
              <p className="text-[18px] font-semibold text-[var(--fg-1)] mb-1">Pagamento recebido!</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
                O TESOURO foi creditado na sua conta.
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
    <TesouroInfoModal open={yieldInfoOpen} onClose={() => setYieldInfoOpen(false)} />
    </>
  );
}
