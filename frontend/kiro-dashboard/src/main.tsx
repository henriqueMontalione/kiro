import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import { DashboardProvider } from './context/DashboardContext';
import { QuoteProvider } from './context/QuoteContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { TransactionsProvider } from './context/TransactionsContext';
import { MfaGuard } from './components/MfaGuard';
import './index.css';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        mfa: { noPromptOnMfaRequired: false },
        loginMethods: ['email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#00FF87',
          logo: '/logo.png',
          landingHeader: 'Entrar no Kiro',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <MfaGuard />
      <BrowserRouter>
        <WalletProvider>
          <UserProfileProvider>
            <TransactionsProvider>
              <DashboardProvider>
                <QuoteProvider>
                  <NotificationsProvider>
                    <App />
                  </NotificationsProvider>
                </QuoteProvider>
              </DashboardProvider>
            </TransactionsProvider>
          </UserProfileProvider>
        </WalletProvider>
      </BrowserRouter>
    </PrivyProvider>
  </>,
);
