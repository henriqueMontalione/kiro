import { QrCode, Zap, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STEPS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: QrCode,
    title: 'Cliente paga via PIX',
    body: 'Você recebe o pagamento normalmente. O Kiro captura a transação em tempo real via webhook.',
  },
  {
    Icon: Zap,
    title: 'Recebível aparece no Kiro',
    body: 'A venda é tokenizada como recebível na rede Stellar. Você acompanha tudo no dashboard.',
  },
  {
    Icon: Wallet,
    title: 'Antecipe quando quiser',
    body: 'Em um clique, converte recebíveis futuros em saldo BRL disponível na hora — saque via PIX 24/7.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative z-10 max-w-[1180px] mx-auto px-5 md:px-8 py-16 md:py-24"
    >
      <div className="flex flex-col items-center text-center max-w-[640px] mx-auto">
        <span className="k-eyebrow">Como funciona</span>
        <h2
          className="k-display mt-3"
          style={{ fontSize: 'clamp(30px, 4.4vw, 44px)' }}
        >
          Três passos. <span className="k-gradient-text">Zero burocracia.</span>
        </h2>
      </div>

      <ol className="grid md:grid-cols-3 gap-5 md:gap-6 mt-12 relative">
        {/* Connector line behind cards (desktop only) */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute left-[12%] right-[12%] top-[64px] h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,255,135,0.25), rgba(123,44,191,0.30), transparent)',
          }}
        />

        {STEPS.map((step, i) => (
          <li key={step.title} className="list-none">
            <Step number={i + 1} {...step} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Step({
  number,
  Icon,
  title,
  body,
}: {
  number: number;
  Icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div
      className="relative h-full flex flex-col gap-4 rounded-[var(--radius-lg)] border p-6 md:p-7"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'var(--stroke-2)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center justify-center rounded-[14px]"
          style={{
            width: 52,
            height: 52,
            background: 'rgba(0,255,135,0.08)',
            border: '1px solid var(--stroke-green)',
          }}
        >
          <Icon size={24} strokeWidth={1.6} color="var(--kiro-green)" />
        </span>
        <span
          className="font-display font-bold"
          style={{
            fontSize: 40,
            background: 'var(--gradient-stellar)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            opacity: 0.6,
            lineHeight: 1,
          }}
        >
          0{number}
        </span>
      </div>

      <h3 className="font-display font-semibold text-[19px] text-[var(--fg-1)] tracking-[-0.01em]">
        {title}
      </h3>
      <p className="font-sans text-[14px] text-[var(--fg-2)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
