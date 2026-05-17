import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { MERCHANT } from '@/lib/mocks';

const NAME_KEY = 'kiro_profile_name';
const PHOTO_KEY = 'kiro_profile_photo';

interface UserProfileState {
  name: string;
  email: string;
  role: string;
  /** Auto-derived from the current name (first + last word). */
  initials: string;
  /** Data URL or null. Backed by localStorage. */
  photoUrl: string | null;
  setName: (name: string) => void;
  setPhotoUrl: (url: string | null) => void;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const UserProfileContext = createContext<UserProfileState | null>(null);

/**
 * Holds the merchant's display profile (name + avatar) globally.
 *
 * No backend yet — values persist in localStorage so the dashboard remembers
 * them across reloads. `MERCHANT` from mocks is the source of truth for fields
 * the user can't edit (email, role) and the default for the editable ones.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState<string>(
    () => localStorage.getItem(NAME_KEY) ?? MERCHANT.name,
  );
  const [photoUrl, setPhotoUrlState] = useState<string | null>(
    () => localStorage.getItem(PHOTO_KEY),
  );

  const setName = useCallback((next: string) => {
    setNameState(next);
    if (next === MERCHANT.name) localStorage.removeItem(NAME_KEY);
    else localStorage.setItem(NAME_KEY, next);
  }, []);

  const setPhotoUrl = useCallback((url: string | null) => {
    setPhotoUrlState(url);
    if (url) localStorage.setItem(PHOTO_KEY, url);
    else localStorage.removeItem(PHOTO_KEY);
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        name,
        email: MERCHANT.email,
        role: MERCHANT.role,
        initials: deriveInitials(name),
        photoUrl,
        setName,
        setPhotoUrl,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileState {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  return ctx;
}
