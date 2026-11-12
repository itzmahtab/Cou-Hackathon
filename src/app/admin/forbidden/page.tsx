import Link from "next/link";

export default function Forbidden() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl font-semibold">Your role does not include this page.</h1>
      <p className="mt-2 text-muted">Ask a super admin if you need access.</p>
      <Link href="/admin" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </main>
  );
}
