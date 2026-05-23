import { useEffect, useRef } from 'react';
import { usePrivy, useMfaEnrollment } from '@privy-io/react-auth';

export function MfaGuard() {
  const { authenticated, user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!authenticated || !user) {
      promptedRef.current = false;
      return;
    }
    if (promptedRef.current) return;
    if (!user.mfaMethods.includes('totp')) {
      promptedRef.current = true;
      showMfaEnrollmentModal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  return null;
}
