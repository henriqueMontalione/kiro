import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ReceberPixModal } from '@/components/ReceberPixModal';
import Resumo from '@/pages/Resumo';
import Transacoes from '@/pages/Transacoes';
import Recebimentos from '@/pages/Recebimentos';
import Placeholder from '@/pages/Placeholder';

/**
 * Application shell:
 * - Fixed left Sidebar
 * - Sticky Header (top tabs + user chip)
 * - Routed main content
 * - Receber via PIX modal (lifted to root so any page can open it)
 */
export default function App() {
  const [pixOpen, setPixOpen] = useState(false);
  const openPix = () => setPixOpen(true);
  const closePix = () => setPixOpen(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <Header />

        <div
          className="flex-1 overflow-auto relative"
          style={{ padding: '28px 28px 40px' }}
        >
          {/* Ambient corner glows — green top-left, purple bottom-right. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              background:
                'radial-gradient(620px 460px at 18% 12%, rgba(0,255,135,0.05), transparent 60%), radial-gradient(620px 460px at 92% 100%, rgba(123,44,191,0.07), transparent 60%)',
            }}
          />
          <div className="relative" style={{ zIndex: 1 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/resumo" replace />} />
              <Route path="/resumo" element={<Resumo onReceive={openPix} />} />
              <Route path="/transacoes" element={<Transacoes />} />
              <Route path="/recebimentos" element={<Recebimentos onReceive={openPix} />} />
              <Route path="/extrato" element={<Placeholder name="Extrato" />} />
              <Route path="/links" element={<Placeholder name="Links de Pagamento" />} />
              <Route path="/clientes" element={<Placeholder name="Clientes" />} />
              <Route path="/relatorios" element={<Placeholder name="Relatórios" />} />
              <Route path="/integracoes" element={<Placeholder name="Integrações" />} />
              <Route path="/config" element={<Placeholder name="Configurações" />} />
              <Route path="*" element={<Navigate to="/resumo" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      <ReceberPixModal open={pixOpen} onClose={closePix} />
    </div>
  );
}
