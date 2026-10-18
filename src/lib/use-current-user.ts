'use client';

import { useEffect, useState } from 'react';
import type { UserSession } from './auth-types';

/**
 * Asks the server who is logged in. (The session cookie is httpOnly, so page code can not
 * read it directly.) While loading, `user` is null, which pages treat as the LEAST
 * privileged state. The server still enforces every permission on its own.
 */
export function useCurrentUser(refreshKey?: string) {
  const [state, setState] = useState<{ user: UserSession | null; demoMode: boolean; loading: boolean }>({
    user: null,
    demoMode: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setState({ user: data.user ?? null, demoMode: Boolean(data.demo_mode), loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}
