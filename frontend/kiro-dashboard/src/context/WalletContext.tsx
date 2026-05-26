import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { fetchTesouroBalance, NETWORK_PASSPHRASE } from '@/lib/stellar';
import { deriveEdSeedFromPrf, wipeBytes } from '@/lib/passkey/crypto';
import { setAuthTokenProvider } from '@/lib/anchors/etherfuse/client';

// This message is part of the key derivation — changing it rotates every wallet.
const DERIVATION_MESSAGE = 'kiro:stellar:seed:v1';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  /** Raw TESOURO balance from Horizon (e.g. "1000.0000000"), or null when not connected. */
  balance: string | null;
  isLoading: boolean;
  /** True while waiting for the user to confirm the one-time wallet setup screen. */
  needsSignatureConfirmation: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Called by the wallet setup modal — dismisses our screen and starts the Privy sign flow. */
  confirmDerivation: () => void;
  /** Signs an XDR transaction envelope with the derived Stellar keypair. */
  signTransaction: (xdr: string) => Promise<string>;
  /** Re-fetches the TESOURO balance from Horizon. No-op if not connected. */
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  // Tracks an in-flight manual createWallet() call so we don't fire it on
  // every render while we wait for Privy to populate the wallet.
  const creatingWalletRef = useRef(false);

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsSignatureConfirmation, setNeedsSignatureConfirmation] = useState(false);
  // Becomes true when the user explicitly clicks "Criar carteira" on our screen.
  const [derivationConfirmed, setDerivationConfirmed] = useState(false);

  // Stellar keypair lives in a ref — it never needs to trigger re-renders
  // and we want to minimize the window it stays in JS memory.
  const keypairRef = useRef<Keypair | null>(null);

  // Guards against React StrictMode double-invocation (dev only): StrictMode
  // mounts → unmounts → remounts each effect, which would fire two concurrent
  // personal_sign requests and stall Privy's signing UI.
  const derivingRef = useRef(false);

  useEffect(() => {
    setAuthTokenProvider(getAccessToken);
    return () => setAuthTokenProvider(null);
  }, [getAccessToken]);

  // Derive the Stellar wallet from the Privy embedded EVM wallet via HKDF.
  // The EVM wallet signs a fixed message — same wallet always produces the
  // same signature, so the same Stellar keypair is recovered on any device
  // that can authenticate with Privy (including cross-device session restore).
  useEffect(() => {
    if (!ready || !authenticated) {
      derivingRef.current = false; // reset gate on logout so next login can derive
      creatingWalletRef.current = false; // allow manual createWallet() on next login
      setDerivationConfirmed(false);
      setNeedsSignatureConfirmation(false);
      return;
    }
    if (publicKey) return; // already active this session
    if (derivingRef.current) return; // derivation already in flight

    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) {
      // Privy didn't auto-create the embedded wallet (can happen when MFA
      // enrollment runs in the same flow, or when `createOnLogin` is gated).
      // Force creation manually — this is a no-op if one already exists.
      if (!creatingWalletRef.current) {
        creatingWalletRef.current = true;
        console.log('[Wallet] no embedded wallet found — forcing creation');
        createWallet()
          .then(() => console.log('[Wallet] createWallet() resolved'))
          .catch((err) => {
            console.warn('[Wallet] createWallet() failed:', err);
            creatingWalletRef.current = false; // allow retry on next effect run
          });
      }
      return;
    }

    if (!derivationConfirmed) {
      // Show our explanation screen before triggering Privy's sign modal.
      console.log('[Wallet] embedded wallet ready — prompting derivation confirmation');
      setNeedsSignatureConfirmation(true);
      return;
    }

    // User confirmed — proceed with the actual derivation.
    setNeedsSignatureConfirmation(false);
    derivingRef.current = true;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      let seed: Uint8Array | null = null;
      try {
        // EIP-191 personal_sign via the EIP-1193 provider exposed by Privy.
        // The EVM wallet is used only as a signing oracle — the signature is
        // deterministic (same Privy account → same signature → same Stellar key)
        // and is never broadcast or used for any Ethereum transaction.
        const provider = await embeddedWallet.getEthereumProvider();

        const signature = (await provider.request({
          method: 'personal_sign',
          params: [DERIVATION_MESSAGE, embeddedWallet.address],
        })) as string;

        if (cancelled) return;

        // Decode hex signature → HKDF → 32-byte Ed25519 seed
        const sigHex = signature.startsWith('0x') ? signature.slice(2) : signature;
        const sigBytes = new Uint8Array(
          (sigHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
        );
        seed = await deriveEdSeedFromPrf(sigBytes.buffer as ArrayBuffer);

        const keypair = Keypair.fromRawEd25519Seed(seed as unknown as Buffer);
        keypairRef.current = keypair;
        const pk = keypair.publicKey();

        if (cancelled) return;

        setPublicKey(pk);
        localStorage.setItem('kiro_stellar_pk', pk);

        getAccessToken().then((token) => {
          if (!token) return;
          fetch('/api/stellar-activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ publicKey: pk }),
          });
        }).catch(() => {});
      } catch (err) {
        console.error('[Wallet] Stellar derivation failed:', err);
        // Reset gate so the user can retry via connect()
        derivingRef.current = false;
        // Do NOT call logout() here — changing `authenticated` re-triggers this effect
      } finally {
        if (seed) wipeBytes(seed);
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // logout intentionally omitted: it's a stable Privy function and including
  // it causes the effect to re-run on every render in some Privy versions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, wallets, publicKey, derivationConfirmed]);

  // Separate effect: whenever publicKey is resolved (or changed), load the
  // balance. Isolated from the derivation effect so that `setPublicKey` doesn't
  // cancel its own in-flight `fetchTesouroBalance` via the cleanup.
  //
  // Retries with backoff because a newly-derived wallet is racing against
  // /api/stellar-activate funding the account: the first fetch usually 404s
  // (account not yet on-chain), and without retry the UI sits in "no balance"
  // until the user manually hits refresh.
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryFetch = async (attempt: number) => {
      const bal = await fetchTesouroBalance(publicKey).catch(() => null);
      if (cancelled) return;
      if (bal !== null) {
        setBalance(bal);
        return;
      }
      // 5 attempts × 2s backoff = ~30s ceiling, more than enough for friendbot
      // or the sponsor's CreateAccount to land.
      if (attempt < 5) {
        timer = setTimeout(() => tryFetch(attempt + 1), 2000 * (attempt + 1));
      }
    };

    tryFetch(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [publicKey]);

  const confirmDerivation = useCallback(() => {
    setDerivationConfirmed(true);
  }, []);

  const connect = useCallback(() => {
    if (!authenticated) {
      login();
      // useEffect picks up once Privy fires the authenticated → true transition
      return;
    }
    // Already authenticated but the Stellar wallet hasn't been derived yet
    // (e.g. page was refreshed, or user dismissed the sign modal mid-flow).
    // Reopen the confirmation modal so the user can retry without logging out.
    if (!publicKey) {
      derivingRef.current = false;
      setDerivationConfirmed(false);
      setNeedsSignatureConfirmation(true);
    }
  }, [authenticated, login, publicKey]);

  const disconnect = useCallback(() => {
    keypairRef.current = null;
    setPublicKey(null);
    setBalance(null);
    logout();
  }, [logout]);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const keypair = keypairRef.current;
    if (!keypair) throw new Error('Carteira não conectada');
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);
    return tx.toXDR();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await fetchTesouroBalance(publicKey);
    setBalance(bal);
  }, [publicKey]);

  return (
    <WalletContext.Provider
      value={{
        isConnected: !!publicKey,
        publicKey,
        balance,
        // Show loading while Privy SDK initialises or while deriving
        isLoading: !ready || isLoading,
        needsSignatureConfirmation,
        connect,
        disconnect,
        confirmDerivation,
        signTransaction,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
