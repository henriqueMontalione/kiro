import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertCircle, ExternalLink, Info } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '@/context/WalletContext';
import { formatBRL, submitXdr } from '@/lib/stellar';
import {
  startOnboarding,
  getKycStatus,
  getBankAccounts,
  getQuote,
  createOrder,
  getOrder,
  type QuoteResult,
} from '@/lib/anchors/etherfuse/client';

type Step =
  | 'loading'
  | 'no_wallet'
  | 'kyc'
  | 'kyc_review'
  | 'kyc_rejected'
  | 'amount'
  | 'confirm'
  | 'processing'
  | 'done'
  | 'error';

const CUSTOMER_KEY = 'kiro_ef_customer_id';
const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';

interface SacarPixModalProps {
  open: boolean;
  onClose: () => void;
}

export function SacarPixModal({ open, onClose }: SacarPixModalProps) {
  const { isConnected, publicKey, balance, connect, signTransaction, refreshBalance } = useWallet();

  const [step, setStep] = useState<Step>('loading');
  const [kycUrl, setKycUrl] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [processingMsg, setProcessingMsg] = useState('');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const kycPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);
  const customerIdRef = useRef('');
  const bankAccountIdRef = useRef('');

  // ESC closes the modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const stopKycPolling = useCallback(() => {
    if (kycPollRef.current) {
      clearInterval(kycPollRef.current);
      kycPollRef.current = null;
    }
  }, []);

  const startKycPolling = useCallback(
    (customerId: string, pubkey: string) => {
      stopKycPolling();
      kycPollRef.current = setInterval(async () => {
        try {
          const status = await getKycStatus(customerId, pubkey);
          if (status === 'approved') {
            stopKycPolling();
            setStep('amount');
          } else if (status === 'rejected') {
            stopKycPolling();
            setStep('kyc_rejected');
          }
        } catch { /* ignore transient errors */ }
      }, 5000);
    },
    [stopKycPolling],
  );

  const startFlow = useCallback(
    async (pubkey: string) => {
      setStep('loading');
      cancelRef.current = false;
      stopKycPolling();

      let customerId = localStorage.getItem(CUSTOMER_KEY) ?? '';
      let bankAccId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? '';

      try {
        // Fast path: if we have stored IDs, check KYC first to skip onboarding when approved.
        if (customerId && bankAccId) {
          const kycStatus = await getKycStatus(customerId, pubkey);

          if (kycStatus === 'approved') {
            try {
              const accounts = await getBankAccounts(customerId);
              if (accounts.length > 0) {
                bankAccId = accounts[0].id;
                localStorage.setItem(BANK_ACCOUNT_KEY, bankAccId);
              }
            } catch { /* keep stored ID */ }
            customerIdRef.current = customerId;
            bankAccountIdRef.current = bankAccId;
            setStep('amount');
            return;
          }
          if (kycStatus === 'pending') {
            customerIdRef.current = customerId;
            bankAccountIdRef.current = bankAccId;
            setStep('kyc_review');
            startKycPolling(customerId, pubkey);
            return;
          }
          if (kycStatus === 'rejected') {
            setStep('kyc_rejected');
            return;
          }
          // not_started → fall through to onboarding (gets a fresh URL)
        }

        // Onboarding path: server may swap our IDs if the wallet was already
        // registered under a different customer ("see org: XYZ").
        if (!customerId) customerId = crypto.randomUUID();
        if (!bankAccId) bankAccId = crypto.randomUUID();

        const result = await startOnboarding(customerId, bankAccId, pubkey);
        customerId = result.customerId;
        bankAccId = result.bankAccountId;
        localStorage.setItem(CUSTOMER_KEY, customerId);
        localStorage.setItem(BANK_ACCOUNT_KEY, bankAccId);
        customerIdRef.current = customerId;
        bankAccountIdRef.current = bankAccId;

        // Re-check KYC with the (possibly swapped) canonical IDs — the existing
        // customer may already be approved or in review.
        const kycStatus = await getKycStatus(customerId, pubkey);
        if (kycStatus === 'approved') {
          try {
            const accounts = await getBankAccounts(customerId);
            if (accounts.length > 0) {
              bankAccountIdRef.current = accounts[0].id;
              localStorage.setItem(BANK_ACCOUNT_KEY, accounts[0].id);
            }
          } catch { /* keep current ID */ }
          setStep('amount');
          return;
        }
        if (kycStatus === 'pending') {
          setStep('kyc_review');
          startKycPolling(customerId, pubkey);
          return;
        }
        if (kycStatus === 'rejected') {
          setStep('kyc_rejected');
          return;
        }

        setKycUrl(result.kycUrl);
        setStep('kyc');
        startKycPolling(customerId, pubkey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao verificar identidade';
        setErrorMsg(msg);
        setStep('error');
      }
    },
    [stopKycPolling, startKycPolling],
  );

  // On open: reset transient state and start flow
  useEffect(() => {
    if (!open) {
      stopKycPolling();
      cancelRef.current = true;
      return;
    }
    setAmount('');
    setQuote(null);
    setErrorMsg('');
    setTxHash('');

    if (!isConnected || !publicKey) {
      setStep('no_wallet');
      return;
    }
    startFlow(publicKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If wallet connects while modal is already open
  useEffect(() => {
    if (open && isConnected && publicKey && step === 'no_wallet') {
      startFlow(publicKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, publicKey]);

  useEffect(() => () => stopKycPolling(), [stopKycPolling]);

  // After a successful off-ramp, refresh the balance once Horizon has indexed
  // the burn transaction (~6s typically).
  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(() => {
      refreshBalance().catch(() => { /* silent */ });
    }, 6000);
    return () => clearTimeout(timer);
  }, [step, refreshBalance]);

  async function handleGetQuote() {
    const num = parseFloat(amount.replace(',', '.'));
    if (!publicKey || isNaN(num) || num <= 0) return;

    setStep('loading');
    try {
      const q = await getQuote(customerIdRef.current, String(num));
      setQuote(q);
      setStep('confirm');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao obter cotação');
      setStep('error');
    }
  }

  async function handleConfirm() {
    if (!quote || !publicKey) return;
    setStep('processing');
    cancelRef.current = false;

    try {
      setProcessingMsg('Criando ordem...');
      const { orderId } = await createOrder(quote.quoteId, publicKey, bankAccountIdRef.current);

      setProcessingMsg('Aguardando transação Stellar...');
      const xdr = await pollForXdr(orderId);

      setProcessingMsg('Aguardando assinatura na carteira...');
      const signedXdr = await signTransaction(xdr);

      setProcessingMsg('Enviando para Stellar...');
      const hash = await submitXdr(signedXdr);

      setTxHash(hash);
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

  /**
   * Re-open the KYC form when stuck on the "em análise" screen. Etherfuse
   * returns `pending` both for genuinely-under-review customers AND for
   * customers who started but never finished the form — we can't tell them
   * apart, so we give the user a way back to the iframe either way.
   */
  async function resumeKyc() {
    if (!publicKey || !customerIdRef.current) return;
    setErrorMsg('');
    setStep('loading');
    try {
      const result = await startOnboarding(
        customerIdRef.current,
        bankAccountIdRef.current,
        publicKey,
      );
      customerIdRef.current = result.customerId;
      bankAccountIdRef.current = result.bankAccountId;
      localStorage.setItem(CUSTOMER_KEY, result.customerId);
      localStorage.setItem(BANK_ACCOUNT_KEY, result.bankAccountId);
      setKycUrl(result.kycUrl);
      setStep('kyc');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao reabrir cadastro');
      setStep('error');
    }
  }

  function handleClose() {
    stopKycPolling();
    cancelRef.current = true;
    onClose();
  }

  if (!open) return null;

  const maxAmount = balance ? parseFloat(balance) : 0;
  const amountNum = parseFloat(amount.replace(',', '.'));
  const amountValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= maxAmount;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-full rounded-[var(--radius-xl)] border border-[var(--stroke-2)]"
        style={{
          background: 'rgba(20, 22, 32, 0.97)',
          backdropFilter: 'blur(24px) saturate(140%)',
          padding: 28,
          boxShadow: 'var(--shadow-3)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
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

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <span className="text-[14px] text-[var(--fg-3)]">Verificando...</span>
          </div>
        )}

        {/* NO WALLET */}
        {step === 'no_wallet' && (
          <div className="flex flex-col gap-5">
            <p className="text-[14px] text-[var(--fg-2)] leading-relaxed">
              Conecte sua carteira Stellar para sacar via PIX.
            </p>
            <Button variant="primary" size="lg" onClick={() => connect()} className="w-full justify-center">
              Conectar carteira
            </Button>
          </div>
        )}

        {/* KYC IFRAME */}
        {step === 'kyc' && (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-[var(--fg-2)] leading-relaxed">
              Complete o cadastro abaixo para habilitar saques via PIX.
            </p>

            {/* Testnet helper hint: the Etherfuse sandbox shows SMS/OTP codes
                inside its orange "Sandbox Mode" helper, but the helper is hidden
                or cropped on small viewports. The popout button gives the iframe
                a full window where the helper can render. */}
            <div
              className="flex items-start gap-2 rounded-[var(--radius-sm)] border"
              style={{
                padding: '10px 12px',
                background: 'rgba(255,181,71,0.06)',
                borderColor: 'rgba(255,181,71,0.30)',
              }}
            >
              <Info size={14} color="#FFB547" strokeWidth={1.7} className="mt-[2px] flex-shrink-0" />
              <div className="text-[12px] leading-snug">
                <p className="font-medium text-[var(--fg-1)] mb-[2px]">Modo Testnet</p>
                <p className="text-[var(--fg-2)]">
                  Os códigos de SMS/OTP não chegam no celular — eles aparecem no helper laranja do
                  Etherfuse. Se o helper estiver cortado, abra em nova janela.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.open(kycUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center justify-center gap-2 w-full font-display font-medium rounded-[var(--radius-md)] cursor-pointer transition-colors hover:bg-white/[0.10]"
              style={{
                padding: '10px 16px',
                fontSize: 13,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--fg-1)',
                border: '1px solid var(--stroke-3)',
              }}
            >
              <ExternalLink size={14} strokeWidth={1.7} />
              Abrir cadastro em nova janela
            </button>

            <div
              className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--stroke-3)]"
              style={{ height: 460 }}
            >
              <iframe
                src={kycUrl}
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title="Cadastro KYC"
              />
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--fg-3)]">
              <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              Aguardando aprovação do cadastro...
            </div>
          </div>
        )}

        {/* KYC IN REVIEW */}
        {step === 'kyc_review' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <Loader2 size={36} strokeWidth={1.4} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <div>
              <p className="text-[15px] font-medium text-[var(--fg-1)] mb-1">Cadastro em análise</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
                Aguarde a aprovação ou retome o formulário se você não finalizou.
              </p>
            </div>
            <Button variant="secondary" onClick={resumeKyc}>
              Reabrir cadastro
            </Button>
          </div>
        )}

        {/* KYC REJECTED */}
        {step === 'kyc_rejected' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <AlertCircle size={40} strokeWidth={1.4} style={{ color: 'rgba(255,77,109,0.85)' }} />
            <div>
              <p className="text-[15px] font-medium text-[var(--fg-1)] mb-1">Cadastro recusado</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
                Sua verificação foi recusada. Entre em contato com o suporte para mais informações.
              </p>
            </div>
            <Button variant="secondary" onClick={handleClose}>Fechar</Button>
          </div>
        )}

        {/* AMOUNT */}
        {step === 'amount' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-[6px]">
              <label
                className="text-[11px] text-[var(--fg-3)] font-medium uppercase"
                style={{ letterSpacing: '0.04em' }}
              >
                Valor a sacar (TESOURO)
              </label>
              <div
                className="flex items-center gap-[10px] border rounded-[var(--radius-md)]"
                style={{ padding: '14px 16px', borderColor: 'var(--stroke-3)', background: 'var(--bg-3)' }}
              >
                <input
                  type="number"
                  min="0"
                  max={maxAmount}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent border-none outline-none flex-1 k-money font-medium"
                  style={{ fontSize: 28, color: 'var(--kiro-green)' }}
                  autoFocus
                />
                <span className="text-[13px] font-medium text-[var(--fg-3)]">TESOURO</span>
              </div>
              <p className="text-[12px] text-[var(--fg-3)]">
                Saldo disponível: {balance ? formatBRL(balance) : '—'}
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

        {/* CONFIRM */}
        {step === 'confirm' && quote && (
          <div className="flex flex-col gap-5">
            <div
              className="rounded-[var(--radius-md)] border border-[var(--stroke-3)] flex flex-col gap-3"
              style={{ padding: '18px 20px', background: 'var(--bg-3)' }}
            >
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-[var(--fg-3)]">Você envia</span>
                <span className="text-[15px] font-medium text-[var(--fg-1)]">
                  {quote.sourceAmount} TESOURO
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-[var(--fg-3)]">Você recebe via PIX</span>
                <span className="text-[18px] font-semibold" style={{ color: 'var(--kiro-green)' }}>
                  {formatBRL(quote.destinationAmount)}
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

        {/* PROCESSING */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
            <span className="text-[14px] text-[var(--fg-2)]">{processingMsg}</span>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <CheckCircle size={48} strokeWidth={1.4} style={{ color: 'var(--kiro-green)' }} />
            <div>
              <p className="text-[18px] font-semibold text-[var(--fg-1)] mb-1">PIX enviado!</p>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
                O valor será creditado na sua conta em instantes.
              </p>
            </div>
            {txHash && (
              <div
                className="rounded-[var(--radius-md)] border border-[var(--stroke-3)] w-full text-left"
                style={{ padding: '10px 14px', background: 'var(--bg-3)' }}
              >
                <p className="text-[11px] text-[var(--fg-3)] mb-1 uppercase" style={{ letterSpacing: '0.04em' }}>
                  Transação Stellar
                </p>
                <p className="text-[11px] text-[var(--fg-2)] font-mono break-all">{txHash}</p>
              </div>
            )}
            <Button variant="primary" size="lg" onClick={handleClose} className="w-full justify-center">
              Fechar
            </Button>
          </div>
        )}

        {/* ERROR */}
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
                onClick={() => publicKey && startFlow(publicKey)}
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
