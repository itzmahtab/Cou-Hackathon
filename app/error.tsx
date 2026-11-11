'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#0a0618] px-4 py-16">
      <div className="glass-panel p-8 rounded-[20px] max-w-md text-center border border-red-500/40 shadow-2xl space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="font-heading font-bold text-xl text-white">Something Went Wrong</h2>
        <p className="text-xs text-slate-400">
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-[10px] bg-[#6d3df5] hover:bg-[#5b2bd5] text-white text-xs font-bold"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-[10px] bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
