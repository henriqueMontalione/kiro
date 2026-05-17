import { Store, TrendingUp, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function Audiences() {
  return (
    <section id="audiencias" className="relative z-10 max-w-[1180px] mx-auto px-5 md:px-8 py-16 md:py-24">
      <SectionHeader
        eyebrow="Para quem é"
        title={
          <>
            Dois lados do <span className="k-gradient-text">mesmo ciclo</span>.
          </>
        }
        subtitle="O Kiro conecta lojistas que precisam de capital de giro com investidores que buscam rendimento atrelado ao Tesouro Direto tokenizado."
      />

      <div className="grid md:grid-cols-2 gap-5 md:gap-6 mt-12">
        <AudienceCard
          variant="green"
          Icon={Store}
          tag="Para lojistas"
          title="Receba antes do vencimento."
          bullets={[
            'Antecipe recebíveis de cartão em 1 clique',
            'Saque via PIX 24/7, inclusive fim de semana',
            'Taxa flat e transparente — sem letrinha miúda',
            'Saldo parado rende automaticamente',
          ]}
        />
        <AudienceCard
          variant="purple"
          Icon={TrendingUp}
          tag="Para investidores"
          title="Capital que rende com lastro real."
          bullets={[
            'Rendimento atrelado a títulos do Tesouro Direto',
            'Tokenização via Stellar — liquidez on-chain',
            'Diversificação automática entre recebíveis',
            'Transparência total na blockchain',
          ]}
        />
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center max-w-[640px] mx-auto">
      <span className="k-eyebrow">{eyebrow}</span>
      <h2
        className="k-display mt-3"
        style={{ fontSize: 'clamp(30px, 4.4vw, 44px)' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="font-sans text-[15px] md:text-[16px] text-[var(--fg-2)] leading-relaxed mt-4">
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface AudienceCardProps {
  variant: 'green' | 'purple';
  Icon: LucideIcon;
  tag: string;
  title: string;
  bullets: string[];
}

function AudienceCard({ variant, Icon, tag, title, bullets }: AudienceCardProps) {
  const accent =
    variant === 'green'
      ? { bg: 'rgba(0,255,135,0.10)', fg: 'var(--kiro-green)', border: 'var(--stroke-green)' }
      : { bg: 'rgba(123,44,191,0.18)', fg: '#C99EFA', border: 'var(--stroke-purple)' };

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-xl)] border p-7 md:p-8 flex flex-col gap-5"
      style={{
        background: 'rgba(255,255,255,0.035)',
        borderColor: 'var(--stroke-2)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      }}
    >
      {/* Decorative corner glow */}
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
        style={{
          background:
            variant === 'green' ? 'var(--gradient-glow-green)' : 'var(--gradient-glow-purple)',
          opacity: 0.45,
        }}
      />

      <div className="flex items-center gap-3 relative">
        <span
          className="inline-flex items-center justify-center rounded-[14px]"
          style={{ width: 44, height: 44, background: accent.bg, border: `1px solid ${accent.border}` }}
        >
          <Icon size={22} strokeWidth={1.6} color={accent.fg} />
        </span>
        <span
          className="font-display text-[12px] font-medium uppercase"
          style={{ color: accent.fg, letterSpacing: '0.08em' }}
        >
          {tag}
        </span>
      </div>

      <h3 className="k-h1 relative" style={{ fontSize: 'clamp(24px, 3vw, 30px)' }}>
        {title}
      </h3>

      <ul className="flex flex-col gap-3 mt-1 relative">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <span
              className="inline-flex items-center justify-center rounded-full flex-shrink-0 mt-[2px]"
              style={{ width: 20, height: 20, background: accent.bg, border: `1px solid ${accent.border}` }}
            >
              <Check size={12} strokeWidth={2.4} color={accent.fg} />
            </span>
            <span className="text-[14px] text-[var(--fg-2)] leading-snug font-sans">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
