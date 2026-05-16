import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
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

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  /** Raw TESOURO balance from Horizon (e.g. "1000.0000000"), or null when not connected / issuer unconfigured. */
  balance: string | null;
  isLoading: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Signs an XDR transaction envelope with the connected wallet. Returns the signed XDR. */
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

  // Persisted across connect → signTransaction calls.
  const kitRef = useRef<StellarWalletsKit | null>(null);

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
        try {
          const { address } = await kit.getAddress();
          setPublicKey(address);
          const bal = await fetchTesouroBalance(address);
          setBalance(bal);
        } catch (err) {
          console.error('[Wallet] Failed to get address:', err);
        } finally {
          setIsLoading(false);
        }
      },
    });
  }, []);

  const disconnect = useCallback(() => {
    kitRef.current = null;
    setPublicKey(null);
    setBalance(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Carteira não conectada');
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    return signedTxXdr;
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await fetchTesouroBalance(publicKey);
    setBalance(bal);
  }, [publicKey]);

  return (
    <WalletContext.Provider
      value={{ isConnected: !!publicKey, publicKey, balance, isLoading, connect, disconnect, signTransaction, refreshBalance }}
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
