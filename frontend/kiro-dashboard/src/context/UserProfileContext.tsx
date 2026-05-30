import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from './WalletContext';
import {
  getMe,
  createMe,
  updateMe,
  updateMyPhoto,
  type UserProfile,
  type CreateMeBody,
} from '@/lib/api/me';

/**
 * Status state machine for the lojista profile lifecycle:
 *
 *   idle             → before wallet is connected; nothing to fetch yet
 *   loading          → GET /api/me in flight
 *   needs_onboarding → backend returned 404; UI must collect cadastro data
 *   ready            → profile loaded; dashboard can render real data
 *   error            → backend unreachable / token rejected
 */
export type ProfileStatus = 'idle' | 'loading' | 'needs_onboarding' | 'ready' | 'error';

interface UserProfileState {
  status: ProfileStatus;
  profile: UserProfile | null;
  errorMessage: string | null;

  /** Display name = store_name when ready, empty string otherwise. */
  name: string;
  email: string;
  /** Hardcoded for now — single-role app. Kept as a hook output so consumers
   *  don't need to change when we eventually add roles to the backend. */
  role: string;
  /** Two-letter initials derived from name; "?" when unavailable. */
  initials: string;
  /** Data URL or null. Source of truth is the backend (encrypted PII column);
   *  never read from or written to browser storage. */
  photoUrl: string | null;
  /** Etherfuse identifiers persisted on the backend. Reading from here keeps
   *  the ramp flow consistent across devices and survives localStorage wipes. */
  etherfuseCustomerId: string | null;
  etherfuseBankAccountId: string | null;

  /** Persists the new photo (or null to remove) on the backend. */
  setPhotoUrl: (url: string | null) => Promise<void>;
  /** PATCH /api/me with a new store_name. Updates the local profile on success. */
  setName: (name: string) => Promise<void>;
  /** Persists Etherfuse customer / bank-account IDs on the backend so the
   *  webhook can map incoming events to this merchant. */
  setEtherfuseIds: (ids: { customerId?: string; bankAccountId?: string }) => Promise<void>;
  /** Submits the cadastro form on first login. Promotes status → 'ready' on success. */
  completeOnboarding: (body: Omit<CreateMeBody, 'stellar_public_key'>) => Promise<void>;
  /** Re-fetches the profile from the backend. */
  refresh: () => Promise<void>;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const UserProfileContext = createContext<UserProfileState | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, user } = usePrivy();
  const { isConnected, publicKey } = useWallet();

  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus('error');
        setErrorMessage('Sessão expirada. Faça login novamente.');
        return;
      }
      const p = await getMe(token);
      if (p === null) {
        setProfile(null);
        setStatus('needs_onboarding');
      } else {
        setProfile(p);
        setStatus('ready');
      }
    } catch (err) {
      console.error('[UserProfile] fetchProfile failed:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar perfil');
    }
  }, [getAccessToken]);

  // Fetch the profile once the wallet is connected. Earlier than that we don't
  // have a Stellar pubkey to anchor the cadastro to, and Privy might still be
  // setting up MFA / embedded wallet — better to wait for the full handshake.
  useEffect(() => {
    if (!isConnected) {
      setStatus('idle');
      setProfile(null);
      setErrorMessage(null);
      return;
    }
    fetchProfile();
  }, [isConnected, fetchProfile]);

  const completeOnboarding = useCallback(
    async (body: Omit<CreateMeBody, 'stellar_public_key'>) => {
      if (!publicKey) throw new Error('Você precisa estar logado para continuar.');
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const created = await createMe(token, { ...body, stellar_public_key: publicKey });
      setProfile(created);
      setStatus('ready');
      setErrorMessage(null);
    },
    [publicKey, getAccessToken],
  );

  const setPhotoUrl = useCallback(
    async (url: string | null) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');
      const updated = await updateMyPhoto(token, url);
      setProfile(updated);
    },
    [getAccessToken],
  );

  const setName = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) throw new Error('Nome inválido');
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');
      const updated = await updateMe(token, { store_name: trimmed });
      setProfile(updated);
    },
    [getAccessToken],
  );

  const setEtherfuseIds = useCallback(
    async (ids: { customerId?: string; bankAccountId?: string }) => {
      const body: { etherfuse_customer_id?: string; etherfuse_bank_account_id?: string } = {};
      if (ids.customerId) body.etherfuse_customer_id = ids.customerId;
      if (ids.bankAccountId) body.etherfuse_bank_account_id = ids.bankAccountId;
      if (!body.etherfuse_customer_id && !body.etherfuse_bank_account_id) return;
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');
      const updated = await updateMe(token, body);
      setProfile(updated);
    },
    [getAccessToken],
  );

  // Derived display fields. When the profile isn't loaded yet, we fall back to
  // the Privy email so the dashboard doesn't render with empty placeholders.
  const name = profile?.store_name ?? '';
  const email = profile?.email ?? user?.email?.address ?? '';
  const initials = profile ? deriveInitials(profile.store_name) : '?';
  const photoUrl = profile?.photo_data_url ?? null;
  const etherfuseCustomerId = profile?.etherfuse_customer_id ?? null;
  const etherfuseBankAccountId = profile?.etherfuse_bank_account_id ?? null;

  return (
    <UserProfileContext.Provider
      value={{
        status,
        profile,
        errorMessage,
        name,
        email,
        role: 'Merchant',
        initials,
        photoUrl,
        etherfuseCustomerId,
        etherfuseBankAccountId,
        setPhotoUrl,
        setName,
        setEtherfuseIds,
        completeOnboarding,
        refresh: fetchProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileState {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  return ctx;
}
