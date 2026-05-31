import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useUserProfile } from './UserProfileContext';
import { useWallet } from './WalletContext';
import { getKycProfile } from '@/lib/api/kyc';
import { getKycStatus } from '@/lib/anchors/etherfuse/client';

const CUSTOMER_KEY = 'kiro_ef_customer_id';

/**
 * Phase state machine for the Etherfuse KYC wizard:
 *
 *   loading        → checking status from backend + Etherfuse
 *   needs_consent  → user has not yet accepted data-sharing with Etherfuse
 *   needs_identity → consent given, personal data form not yet submitted
 *   needs_docs     → identity submitted, document photos not yet uploaded
 *   pending        → docs uploaded, waiting for Etherfuse review
 *   approved       → KYC approved — Receber/Sacar are unlocked
 *   rejected       → Etherfuse rejected the KYC
 */
export type KycPhase =
  | 'loading'
  | 'needs_consent'
  | 'needs_identity'
  | 'needs_docs'
  | 'pending'
  | 'approved'
  | 'rejected';

interface EtherfuseKycContextValue {
  phase: KycPhase;
  /** Wizard step currently shown (null = wizard closed). */
  wizardStep: 'consent' | 'identity' | 'docs' | 'review' | null;
  /** ef_customer_id from our backend profile (null until identity is submitted). */
  efCustomerId: string | null;
  /** Opens the wizard at the appropriate step for the current phase. */
  startFlow: () => void;
  /** Closes the wizard without advancing (only valid from 'review' step). */
  closeWizard: () => void;
  /** Called by ConsentModal on success. */
  onConsentDone: (customerId: string) => void;
  /** Called by IdentityModal on success. */
  onIdentityDone: () => void;
  /** Called by DocsModal on success. */
  onDocsDone: () => void;
  /** Re-derives phase from backend + Etherfuse. */
  refresh: () => Promise<void>;
}

const EtherfuseKycContext = createContext<EtherfuseKycContextValue | null>(null);

export function EtherfuseKycProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy();
  const { status: profileStatus } = useUserProfile();
  const { isConnected, publicKey } = useWallet();

  const [phase, setPhase] = useState<KycPhase>('loading');
  const [wizardStep, setWizardStep] = useState<EtherfuseKycContextValue['wizardStep']>(null);
  const [efCustomerId, setEfCustomerId] = useState<string | null>(
    () => localStorage.getItem(CUSTOMER_KEY),
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const derivePhase = useCallback(async (): Promise<KycPhase> => {
    const token = await getAccessToken();
    if (!token || !isConnected) return 'loading';

    const profile = await getKycProfile(token);

    // Consent state is per-USER, not per-browser — read it from consent_logs
    // (via backend) rather than localStorage, which leaks across accounts on
    // the same device.
    if (!profile.consent_given) return 'needs_consent';
    if (!profile.has_profile) return 'needs_identity';

    if (profile.ef_customer_id) {
      setEfCustomerId(profile.ef_customer_id);
      localStorage.setItem(CUSTOMER_KEY, profile.ef_customer_id);
    }

    if (!profile.docs_uploaded) return 'needs_docs';

    // Profile + docs exist — check Etherfuse for final status.
    const customerId = profile.ef_customer_id ?? localStorage.getItem(CUSTOMER_KEY);
    if (!customerId || !publicKey) return 'pending';

    try {
      const efStatus = await getKycStatus(customerId, publicKey);
      if (efStatus === 'approved') return 'approved';
      if (efStatus === 'rejected') return 'rejected';
      return 'pending';
    } catch {
      return 'pending';
    }
  }, [getAccessToken, isConnected, publicKey]);

  const refresh = useCallback(async () => {
    if (profileStatus !== 'ready') return;
    setPhase('loading');
    try {
      const p = await derivePhase();
      setPhase(p);
    } catch {
      setPhase('needs_consent');
    }
  }, [profileStatus, derivePhase]);

  // Initial load when profile becomes ready.
  useEffect(() => {
    if (profileStatus === 'ready') {
      refresh();
    } else if (profileStatus === 'idle' || profileStatus === 'needs_onboarding') {
      setPhase('loading');
      stopPolling();
    }
  }, [profileStatus, refresh, stopPolling]);

  // Poll Etherfuse every 10s while waiting for review.
  useEffect(() => {
    if (phase !== 'pending') { stopPolling(); return; }
    pollRef.current = setInterval(async () => {
      const p = await derivePhase();
      if (p !== 'pending') {
        stopPolling();
        setPhase(p);
        if (p === 'approved') setWizardStep(null);
      }
    }, 10_000);
    return stopPolling;
  }, [phase, derivePhase, stopPolling]);

  const startFlow = useCallback(() => {
    if (phase === 'approved' || phase === 'loading') return;
    const step: EtherfuseKycContextValue['wizardStep'] =
      phase === 'needs_consent' ? 'consent' :
      phase === 'needs_identity' ? 'identity' :
      phase === 'needs_docs' ? 'docs' : 'review';
    setWizardStep(step);
  }, [phase]);

  const onConsentDone = useCallback((customerId: string) => {
    localStorage.setItem(CUSTOMER_KEY, customerId);
    setEfCustomerId(customerId);
    setPhase('needs_identity');
    setWizardStep('identity');
  }, []);

  const onIdentityDone = useCallback(() => {
    setPhase('needs_docs');
    setWizardStep('docs');
  }, []);

  const onDocsDone = useCallback(() => {
    setPhase('pending');
    setWizardStep('review');
  }, []);

  const closeWizard = useCallback(() => {
    setWizardStep(null);
  }, []);

  return (
    <EtherfuseKycContext.Provider value={{
      phase,
      wizardStep,
      efCustomerId,
      startFlow,
      closeWizard,
      onConsentDone,
      onIdentityDone,
      onDocsDone,
      refresh,
    }}>
      {children}
    </EtherfuseKycContext.Provider>
  );
}

export function useEtherfuseKyc(): EtherfuseKycContextValue {
  const ctx = useContext(EtherfuseKycContext);
  if (!ctx) throw new Error('useEtherfuseKyc must be used inside <EtherfuseKycProvider>');
  return ctx;
}
