import { Plus, Copy, Download } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FakeQR } from '@/components/FakeQR';
import { PAYMENT_LINKS } from '@/lib/mocks';

interface RecebimentosProps {
  onReceive: () => void;
}

/** Gallery of saved payment links / QR codes. */
export default function Recebimentos({ onReceive }: RecebimentosProps) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="k-h1">Recebimentos</h1>
          <div className="text-[13px] text-[var(--fg-3)] mt-1">
            Crie QR Codes e links de pagamento para receber via PIX.
          </div>
        </div>
        <Button variant="primary" icon={Plus} onClick={onReceive}>
          Novo recebimento
        </Button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {PAYMENT_LINKS.map((l) => (
          <Card key={l.url} className="!p-[18px] flex flex-col gap-[10px]">
            <FakeQR size={140} />
            <div className="font-display font-semibold text-[15px] text-[var(--fg-1)]">
              {l.name}
            </div>
            <div
              className="k-money font-medium"
              style={{ fontSize: 22, color: 'var(--kiro-green)' }}
            >
              {l.amount}
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="k-money text-[11px] text-[var(--fg-3)]">{l.uses} usos</span>
              <span className="k-money text-[11px] text-[var(--fg-2)]">{l.url}</span>
            </div>
            <div className="flex gap-2 mt-[6px]">
              <Button variant="secondary" size="sm" icon={Copy}>
                Copiar link
              </Button>
              <Button variant="ghost" size="sm" icon={Download}>
                PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
