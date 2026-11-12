import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-7xl font-semibold text-gradient">404</p>
      <h1 className="h2 mt-6">This page does not exist.</h1>
      <p className="mt-3 text-muted">The link may be old, or the address mistyped.</p>
      <Link href="/" className="btn btn-primary mt-8">
        Back to home
      </Link>
    </main>
  );
}
