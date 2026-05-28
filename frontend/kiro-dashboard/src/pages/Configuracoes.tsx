import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import { Camera, Check, Fingerprint, KeyRound, LogOut, Mail, Plus, Trash2, User } from 'lucide-react';
import { usePrivy, useMfaEnrollment } from '@privy-io/react-auth';
import { Button } from '@/components/Button';
import { Card, CardEyebrow } from '@/components/Card';
import { useUserProfile } from '@/context/UserProfileContext';
import { useWallet } from '@/context/WalletContext';
import { truncateKey } from '@/lib/stellar';
import { StatusTag } from '@/components/StatusTag';

const MAX_PHOTO_BYTES = 1 * 1024 * 1024;

/**
 * Settings page — edit display name and avatar; view registered email.
 * Persistence lives in UserProfileContext (localStorage-backed).
 */
export default function Configuracoes() {
  const profile = useUserProfile();
  const { disconnect } = useWallet();

  const [name, setName] = useState(profile.name);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (profile.name) {
      setName(profile.name);
      setPhotoPreview(profile.photoUrl);
      hydratedRef.current = true;
    }
  }, [profile.name, profile.photoUrl]);

  async function handleLogout() {
    if (loggingOut) return;
    const ok = window.confirm(
      'Tem certeza que deseja sair? Você precisará autenticar novamente na próxima vez.',
    );
    if (!ok) return;
    setLoggingOut(true);
    try {
      await disconnect();
    } finally {
      setLoggingOut(false);
    }
  }

  const trimmed = name.trim();
  const dirty = trimmed !== profile.name || photoPreview !== profile.photoUrl;
  const canSave = trimmed.length > 0 && dirty && !saving;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Imagem muito grande. Use uma foto de até 1 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
      setPhotoError(null);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setPhotoPreview(null);
    setPhotoError(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSave() {
    if (!canSave) return;
    setSaving(true);
    // Tiny delay so the disabled state is visible — no backend wired yet.
    setTimeout(() => {
      profile.setName(trimmed);
      profile.setPhotoUrl(photoPreview);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    }, 350);
  }

  function handleCancel() {
    setName(profile.name);
    setPhotoPreview(profile.photoUrl);
    setPhotoError(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-5 max-w-[720px]">
      <div>
        <h1 className="k-h1">Configurações</h1>
        <p className="text-[14px] text-[var(--fg-3)] mt-[6px]">
          Gerencie como o seu perfil aparece no Kiro.
        </p>
      </div>

      <Card>
        <CardEyebrow>Perfil</CardEyebrow>

        <div className="flex items-center gap-5 mb-7">
          <div className="relative flex-shrink-0">
            <div
              className="inline-flex items-center justify-center rounded-full font-display font-semibold text-[24px] text-white overflow-hidden"
              style={{
                width: 88,
                height: 88,
                background: photoPreview
                  ? 'var(--bg-3)'
                  : 'linear-gradient(135deg, #9D4EDD, #7B2CBF)',
                letterSpacing: '0.04em',
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.initials
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Trocar foto"
              className="absolute bottom-0 right-0 inline-flex items-center justify-center rounded-full border border-[var(--stroke-3)] bg-[var(--bg-3)] hover:bg-[var(--bg-4)] cursor-pointer text-[var(--fg-1)]"
              style={{ width: 32, height: 32 }}
            >
              <Camera size={15} strokeWidth={1.7} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-display text-[18px] font-semibold text-[var(--fg-1)] truncate">
              {trimmed || '—'}
            </span>
            {profile.profile?.stellar_public_key && (
              <div className="self-start" title={profile.profile.stellar_public_key}>
                <StatusTag status="neutral" withIcon={false}>
                  <span className="font-mono tracking-tight leading-none">
                    ID: {truncateKey(profile.profile.stellar_public_key)}
                  </span>
                </StatusTag>
              </div>
            )}
            <span className="text-[13px] text-[var(--fg-3)]">{profile.role}</span>
            {photoPreview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--fg-3)] hover:text-[#FF4D6D] bg-transparent border-none cursor-pointer p-0 self-start"
              >
                <Trash2 size={12} strokeWidth={1.7} />
                Remover foto
              </button>
            )}
            {photoError && (
              <span className="text-[12px] text-[#FF4D6D] mt-1">{photoError}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label="Nome da loja"
            icon={<User size={14} strokeWidth={1.7} color="var(--fg-3)" />}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              maxLength={120}
              placeholder="Como sua loja deve aparecer"
              className="bg-transparent border-none outline-none flex-1 font-sans text-[14px] text-[var(--fg-1)] placeholder:text-[var(--fg-4)]"
            />
          </Field>

          <Field
            label="E-mail cadastrado"
            icon={<Mail size={14} strokeWidth={1.7} color="var(--fg-3)" />}
            hint="Para alterar o e-mail, fale com o suporte."
          >
            <input
              type="email"
              value={profile.email}
              readOnly
              tabIndex={-1}
              className="bg-transparent border-none outline-none flex-1 font-sans text-[14px] text-[var(--fg-2)] cursor-not-allowed"
            />
          </Field>
        </div>

        <div
          className="mt-7 pt-5 border-t"
          style={{ borderColor: 'var(--stroke-1)' }}
        >
          {/* Fixed-height slot so the buttons don't jump when the message appears. */}
          <div className="flex items-center mb-3" style={{ minHeight: 18 }}>
            {saved && (
              <span
                className="inline-flex items-center gap-[6px] text-[13px]"
                style={{ color: 'var(--kiro-green)' }}
              >
                <Check size={14} strokeWidth={2} />
                Alterações salvas
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button variant="ghost" onClick={handleCancel} disabled={!dirty || saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </Card>

      <SecurityCard />

      <Card>
        <CardEyebrow>Sessão</CardEyebrow>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-[2px] min-w-0">
            <span className="text-[14px] text-[var(--fg-1)] font-medium">
              Sair da conta
            </span>
            <span className="text-[12px] text-[var(--fg-3)]">
              Encerra esta sessão e permite entrar com outra conta.
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-full border bg-transparent cursor-pointer transition-colors font-sans text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              padding: '8px 16px',
              borderColor: 'rgba(255,77,109,0.4)',
              color: '#FF4D6D',
            }}
          >
            <LogOut size={14} strokeWidth={1.8} />
            {loggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </Card>
    </div>
  );
}

type MfaMethod = 'passkey' | 'totp';

interface MfaMethodMeta {
  key: MfaMethod;
  label: string;
  sublabel: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}

const MFA_METHOD_META: Record<MfaMethod, MfaMethodMeta> = {
  passkey: {
    key: 'passkey',
    label: 'Digital ou reconhecimento facial',
    sublabel: 'Use a biometria do seu celular ou computador',
    icon: Fingerprint,
  },
  totp: {
    key: 'totp',
    label: 'Código de um aplicativo',
    sublabel: 'Geramos um código de 6 dígitos a cada login',
    icon: KeyRound,
  },
};

function SecurityCard() {
  const { user } = usePrivy();
  const {
    showMfaEnrollmentModal,
    unenrollWithPasskey,
    unenrollWithTotp,
  } = useMfaEnrollment();
  const [removing, setRemoving] = useState<MfaMethod | null>(null);

  const enrolledMethods = (user?.mfaMethods ?? []).filter(
    (m): m is MfaMethod => m === 'passkey' || m === 'totp',
  );

  async function handleRemove(method: MfaMethod) {
    if (removing) return;
    const ok = window.confirm(
      `Remover ${MFA_METHOD_META[method].label} da sua conta? Você poderá adicionar de novo a qualquer momento.`,
    );
    if (!ok) return;
    setRemoving(method);
    try {
      if (method === 'passkey') await unenrollWithPasskey();
      else await unenrollWithTotp();
    } catch (err) {
      console.warn('[Security] unenroll failed:', err);
      window.alert('Não conseguimos remover esse método. Tente novamente.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardEyebrow>Segurança</CardEyebrow>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-[var(--fg-3)] leading-relaxed">
          A verificação em duas etapas é opcional. Recomendamos usar sua digital
          ou rosto pra entrar — é mais rápido e seguro do que digitar um código.
        </p>

        {enrolledMethods.length === 0 ? (
          <div
            className="text-[13px] text-[var(--fg-2)] rounded-[var(--radius-md)] border border-[var(--stroke-3)] bg-[var(--bg-3)]"
            style={{ padding: '12px 14px' }}
          >
            Nenhum método de verificação ativo.
          </div>
        ) : (
          <ul className="flex flex-col gap-2 list-none m-0 p-0">
            {enrolledMethods.map((m) => (
              <li key={m}>
                <MfaRow
                  meta={MFA_METHOD_META[m]}
                  onRemove={() => handleRemove(m)}
                  removing={removing === m}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" icon={Plus} onClick={showMfaEnrollmentModal}>
            Adicionar método
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MfaRow({
  meta,
  onRemove,
  removing,
}: {
  meta: MfaMethodMeta;
  onRemove: () => void;
  removing: boolean;
}) {
  const Icon = meta.icon;
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--stroke-3)] bg-[var(--bg-3)]"
      style={{ padding: '12px 14px' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center justify-center rounded-[10px] flex-shrink-0"
          style={{
            width: 36,
            height: 36,
            background: 'rgba(0,255,135,0.10)',
            color: 'var(--kiro-green)',
          }}
        >
          <Icon size={18} strokeWidth={1.7} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] text-[var(--fg-1)] font-medium">{meta.label}</span>
          <span className="text-[12px] text-[var(--fg-3)] truncate">{meta.sublabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="inline-flex items-center gap-[6px] bg-transparent border-none cursor-pointer text-[12px] text-[var(--fg-3)] hover:text-[#FF4D6D] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ padding: '4px 8px' }}
      >
        <Trash2 size={12} strokeWidth={1.7} />
        {removing ? 'Removendo...' : 'Remover'}
      </button>
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label
        className="text-[11px] text-[var(--fg-3)] font-medium uppercase"
        style={{ letterSpacing: '0.04em' }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-[10px] border rounded-[var(--radius-md)]"
        style={{ padding: '12px 14px', borderColor: 'var(--stroke-3)', background: 'var(--bg-3)' }}
      >
        {icon}
        {children}
      </div>
      {hint && <p className="text-[11px] text-[var(--fg-4)] mt-[2px]">{hint}</p>}
    </div>
  );
}
