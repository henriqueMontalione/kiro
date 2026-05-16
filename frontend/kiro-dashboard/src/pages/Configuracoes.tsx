import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Camera, Check, Mail, Trash2, User } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardEyebrow } from '@/components/Card';
import { useUserProfile } from '@/context/UserProfileContext';

const MAX_PHOTO_BYTES = 1 * 1024 * 1024;

/**
 * Settings page — edit display name and avatar; view registered email.
 * Persistence lives in UserProfileContext (localStorage-backed).
 */
export default function Configuracoes() {
  const profile = useUserProfile();

  const [name, setName] = useState(profile.name);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          className="flex items-center justify-end gap-3 mt-7 pt-5 border-t"
          style={{ borderColor: 'var(--stroke-1)' }}
        >
          {saved && (
            <span
              className="inline-flex items-center gap-[6px] text-[13px] mr-auto"
              style={{ color: 'var(--kiro-green)' }}
            >
              <Check size={14} strokeWidth={2} />
              Alterações salvas
            </span>
          )}
          <Button variant="ghost" onClick={handleCancel} disabled={!dirty || saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </Card>
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
