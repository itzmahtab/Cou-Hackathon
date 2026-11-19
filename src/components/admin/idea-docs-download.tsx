"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { buildIdeaZip, type IdeaDocItem } from "@/lib/idea-zip";

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

/** Fetches one document; 404 means it is missing from storage, other failures retry twice. */
async function fetchDoc(item: IdeaDocItem): Promise<Uint8Array | null> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/api/v1/admin/files/${encodeURIComponent(item.fileId)}`, { credentials: "same-origin", cache: "no-store" });
      if (res.status === 404) return null;
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      lastError = await errorMessage(res);
      if (res.status === 401 || res.status === 403 || res.status === 429) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`${item.registrationId}: ${lastError || "download failed"}`);
}

/**
 * Downloads every idea document (optionally filtered by team status) and saves them
 * as one ZIP with an index.csv. The ZIP is built in the browser, not on the Worker.
 */
export function IdeaDocsDownload({ status, label = "Download all idea docs (ZIP)" }: { status?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/v1/admin/export/ideas${qs}`, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      const { data } = (await res.json()) as { data: { items: IdeaDocItem[] } };
      if (data.items.length === 0) throw new Error("No idea documents match this filter.");
      setProgress({ done: 0, total: data.items.length });

      const stream = buildIdeaZip(data.items, fetchDoc, { onProgress: (done, total) => setProgress({ done, total }) });
      const blob = new Blob([await new Response(stream).arrayBuffer()], { type: "application/zip" });

      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `idea-docs-${status ? status.toLowerCase().replace(/,/g, "-") : "all"}-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className="btn btn-secondary btn-sm" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />}
        {busy ? (progress ? `Zipping ${progress.done} / ${progress.total}…` : "Preparing…") : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </span>
  );
}
