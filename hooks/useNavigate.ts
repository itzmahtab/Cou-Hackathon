'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Navigation helper that mirrors the behaviour of the original Vite SPA router:
 *  - plain paths use client-side routing
 *  - "/#anchor" scrolls to a section on the landing page
 */
export function useNavigate(): (route: string) => void {
  const router = useRouter();

  return useCallback(
    (route: string) => {
      if (route.startsWith('/#')) {
        const id = route.replace('/#', '');
        const scrollTo = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

        if (window.location.pathname !== '/') {
          router.push('/');
          setTimeout(scrollTo, 120);
        } else {
          scrollTo();
        }
        return;
      }

      router.push(route);
    },
    [router]
  );
}

export default useNavigate;
