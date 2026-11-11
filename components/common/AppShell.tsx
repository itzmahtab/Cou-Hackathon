'use client';

import React, { Suspense } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

/** Placeholder shown while the header resolves the current pathname. */
const HeaderFallback = (
  <header className="sticky top-0 z-50 w-full bg-[#0a0618]/95 backdrop-blur-md border-b border-purple-900/30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-18" />
    </div>
  </header>
);

/**
 * Application shell: the global header and footer wrap every route,
 * matching the layout of the original single-page application.
 *
 * The header is isolated behind a Suspense boundary because it reads the
 * current pathname, which is only known at request time.
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0618] text-[#f6f4ff] selection:bg-cyan-500 selection:text-black">
      <Suspense fallback={HeaderFallback}>
        <Header />
      </Suspense>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
};

export default AppShell;
