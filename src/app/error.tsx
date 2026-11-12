"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <h1 className="h2">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted">The problem has been logged. Try again, and if it keeps happening, contact the organisers.</p>
      <button type="button" className="btn btn-primary mt-8" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
