import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
// Sub-path imports intentional: the main package entry (index.mjs) re-exports
// ALL wallet modules, including Hana/HotWallet which pull in @near-js/crypto —
// a Node-only package that references `global` and crashes in Vite/browser.
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/stellar-wallets-kit';
import { WalletNetwork } from '@creit.tech/stellar-wallets-kit/types';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter.module';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull.module';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo.module';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr.module';
// Side-effect import: registers the <stellar-wallets-modal> custom element.
import '@creit.tech/stellar-wallets-kit/components/modal/stellar-wallets-modal';
import { fetchTesouroBalance, WALLET_NETWORK, NETWORK_PASSPHRASE } from '@/lib/stellar';
import {
  createPasskeyWallet,
  forgetPasskeyWallet,
  hasPasskeyWallet as readHasPasskeyWallet,
  isPasskeySupported,
  loginWithPasskey as authPasskey,
  signXdrWithPasskey,
} from '@/lib/passkey/wallet';

export type WalletType = 'kit' | 'passkey' | null;

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  /** Raw TESOURO balance from Horizon (e.g. "1000.0000000"), or null when not connected / issuer unconfigured. */
  balance: string | null;
  isLoading: boolean;
  /** Which backend signed in — drives `signTransaction` routing. */
  walletType: WalletType;
  /** True when a passkey-protected wallet blob exists in localStorage (regardless of session). */
  hasPasskeyWallet: boolean;
  /** True when the browser exposes the WebAuthn + PRF surface we need. */
  passkeySupported: boolean;
  /** Opens the stellar-wallets-kit modal (Freighter, Albedo, xBull, Lobstr). */
  connect: () => void;
  /** Create a brand-new passkey-protected Stellar account on this device. */
  createPasskeyAccount: (userName?: string) => Promise<void>;
  /** Authenticate with the stored passkey to start a session. */
  loginWithPasskey: () => Promise<void>;
  /** Ends the current session. Does NOT remove the stored passkey blob — use `forgetPasskeyAccount` for that. */
  disconnect: () => void;
  /** Permanently delete the local passkey blob (the OS passkey itself stays). */
  forgetPasskeyAccount: () => void;
  /** Signs an XDR transaction envelope with whichever wallet is active. Returns signed XDR. */
  signTransaction: (xdr: string) => Promise<string>;
  /** Re-fetches the TESOURO balance from Horizon. No-op if not connected. */
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

const KIT_CONFIG = {
  network: WALLET_NETWORK === 'TESTNET' ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    new FreighterModule(),
    new xBullModule(),
    new AlbedoModule(),
    new LobstrModule(),
  ],
} as const;

function createKit() {
  return new StellarWalletsKit({ ...KIT_CONFIG, modules: [...KIT_CONFIG.modules] });
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [hasPasskeyWallet, setHasPasskeyWallet] = useState<boolean>(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);

  // Persisted across connect → signTransaction calls.
  const kitRef = useRef<StellarWalletsKit | null>(null);

  useEffect(() => {
    setHasPasskeyWallet(readHasPasskeyWallet());
    setPasskeySupported(isPasskeySupported());
  }, []);

  const loadBalance = useCallback(async (address: string) => {
    try {
      const bal = await fetchTesouroBalance(address);
      setBalance(bal);
    } catch (err) {
      console.error('[Wallet] Failed to fetch balance:', err);
    }
  }, []);

  const connect = useCallback(() => {
    // The kit tracks modal state internally and the custom element persists in
    // the DOM across HMR reloads. Removing any stale element and using a fresh
    // kit instance avoids the "modal is already open" error.
    document.querySelectorAll('stellar-wallets-modal').forEach((el) => el.remove());

    const kit = createKit();

    kit.openModal({
      onWalletSelected: async (option) => {
        kit.setWallet(option.id);
        kitRef.current = kit;
        setIsLoading(true);

        let address: string;
        try {
          address = (await kit.getAddress()).address;
        } catch (err) {
          console.error('[Wallet] Failed to get address:', err);
          setIsLoading(false);
          return;
        }

        // Unblock the UI as soon as the address is known. Balance fetches in
        // the background so the dashboard (and downstream cards like
        // TransactionsCard) can start their own queries in parallel.
        setPublicKey(address);
        setWalletType('kit');
        setIsLoading(false);

        loadBalance(address);
      },
    });
  }, [loadBalance]);

  const createPasskeyAccount = useCallback(
    async (userName = 'Lojista Kiro') => {
      setIsLoading(true);
      try {
        const address = await createPasskeyWallet(userName);
        setPublicKey(address);
        setWalletType('passkey');
        setHasPasskeyWallet(true);
        // friendbot funding is best-effort but usually instant on Testnet
        await loadBalance(address);
      } finally {
        setIsLoading(false);
      }
    },
    [loadBalance],
  );

  const loginWithPasskey = useCallback(async () => {
    setIsLoading(true);
    try {
      const address = await authPasskey();
      setPublicKey(address);
      setWalletType('passkey');
      await loadBalance(address);
    } finally {
      setIsLoading(false);
    }
  }, [loadBalance]);

  const disconnect = useCallback(() => {
    kitRef.current = null;
    setPublicKey(null);
    setBalance(null);
    setWalletType(null);
    // Note: passkey blob remains in localStorage so the user can return via
    // "Entrar com Face ID" without re-creating. Call `forgetPasskeyAccount`
    // explicitly to wipe it.
  }, []);

  const forgetPasskeyAccount = useCallback(() => {
    forgetPasskeyWallet();
    setHasPasskeyWallet(false);
    if (walletType === 'passkey') {
      setPublicKey(null);
      setBalance(null);
      setWalletType(null);
    }
  }, [walletType]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (walletType === 'passkey') {
        return signXdrWithPasskey(xdr);
      }

      const kit = kitRef.current;
      if (!kit) throw new Error('Carteira não conectada');
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return signedTxXdr;
    },
    [walletType],
  );

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
        isLoading,
        walletType,
        hasPasskeyWallet,
        passkeySupported,
        connect,
        createPasskeyAccount,
        loginWithPasskey,
        disconnect,
        forgetPasskeyAccount,
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
