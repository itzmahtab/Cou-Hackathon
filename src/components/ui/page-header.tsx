import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div aria-hidden className="absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="container-page relative pb-14 pt-32 md:pb-20 md:pt-40">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h1 mt-4 max-w-4xl">{title}</h1>
        {lead && <p className="lead on-aura mt-5">{lead}</p>}
        {children}
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, lead, center }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h2 mt-3">{title}</h2>
      {lead && <p className={`lead mt-4 ${center ? "mx-auto" : ""}`}>{lead}</p>}
    </div>
  );
}
