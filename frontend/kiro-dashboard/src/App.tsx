import { useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { ReceberPixModal } from '@/components/ReceberPixModal';
import { SacarPixModal } from '@/components/SacarPixModal';
import { WalletSignModal } from '@/components/WalletSignModal';
import { CompleteOnboardingModal } from '@/components/CompleteOnboardingModal';
import Resumo from '@/pages/Resumo';
// On /resumo "Receber via PIX" triggers the off-ramp flow (TESOURO → BRL).
// On /transacoes the same prop means "receive a customer payment" (on-ramp),
// so each route wires onReceive to a different handler.
import Transacoes from '@/pages/Transacoes';
import Configuracoes from '@/pages/Configuracoes';
import MobileMais from '@/pages/MobileMais';

/**
 * Application shell.
 *
 * Layout adapts at the `md` breakpoint (768px):
 * - Below md: MobileHeader at top, MobileBottomNav fixed at bottom.
 *   Content gets bottom padding so the last card clears the nav bar.
 * - At md and above: classic left Sidebar + sticky Header.
 *
 * The PIX modal is lifted to the root so any page (mobile or desktop)
 * can open it via the `onReceive` prop.
 */
export default function App() {
  const [pixOpen, setPixOpen] = useState(false);
  const openPix = () => setPixOpen(true);
  const closePix = () => setPixOpen(false);

  const [sacarOpen, setSacarOpen] = useState(false);
  const openSacar = () => setSacarOpen(true);
  const closeSacar = () => setSacarOpen(false);

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden">
          <MobileHeader />
        </div>
        <div className="hidden md:block">
          <Header />
        </div>

        <div className="flex-1 overflow-auto relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              background:
                'radial-gradient(620px 460px at 18% 12%, rgba(0,255,135,0.05), transparent 60%), radial-gradient(620px 460px at 92% 100%, rgba(123,44,191,0.07), transparent 60%)',
            }}
          />
          <div
            className="relative px-4 pt-4 pb-[96px] md:px-7 md:pt-7 md:pb-10"
            style={{ zIndex: 1 }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/resumo" replace />} />
              <Route path="/resumo" element={<Resumo onReceive={openSacar} />} />
              <Route path="/transacoes" element={<Transacoes onReceive={openPix} />} />
              <Route path="/mais" element={<MobileMais />} />
              <Route path="/config" element={<RequireAuth><Configuracoes /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/resumo" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      <div className="md:hidden">
        <MobileBottomNav />
      </div>

      <ReceberPixModal open={pixOpen} onClose={closePix} />
      <SacarPixModal open={sacarOpen} onClose={closeSacar} />
      <WalletSignModal />
      <CompleteOnboardingModal />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet();
  if (!isConnected) return <Navigate to="/resumo" replace />;
  return <>{children}</>;
}
