"use client";

import { CheckCircle2, FileText, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface UploadedFile {
  fileId: string;
  name: string;
  previewUrl?: string;
}

interface Props {
  label: string;
  hint: string;
  category: "STUDENT_ID" | "IDEA_DOC" | "PAYMENT_SCREENSHOT";
  accept: string;
  maxBytes: number;
  uploadSession: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
  required?: boolean;
}

/** Uploads as soon as a file is chosen, with progress, and reports the server's file ID. */
export function FileDropzone({ label, hint, category, accept, maxBytes, uploadSession, value, onChange, error, required }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const shownError = localError ?? error;

  const upload = (file: File) => {
    setLocalError(null);
    if (file.size > maxBytes) {
      setLocalError(`That file is ${(file.size / 1048576).toFixed(1)} MB. ${hint}.`);
      return;
    }
    const body = new FormData();
    body.set("category", category);
    body.set("uploadSession", uploadSession);
    body.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => {
      setProgress(null);
      setLocalError("The upload failed. Check your connection and try again.");
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 201 && res.ok) {
          onChange({ fileId: res.data.fileId, name: file.name, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined });
        } else {
          setLocalError(res.error?.message ?? "The upload failed. Try again.");
        }
      } catch {
        setLocalError("The upload failed. Try again.");
      }
    };
    setProgress(0);
    xhr.send(body);
  };

  const busy = progress !== null;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) upload(file);
        }}
        className={cn(
          "relative flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-dashed border-line bg-surface-2/60 p-4 transition-colors focus-within:border-primary-soft",
          dragging && "border-primary-soft bg-primary/10",
          shownError && "border-danger/70",
          value && !shownError && "border-solid border-success/40",
        )}
      >
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          aria-required={required || undefined}
          aria-invalid={shownError ? "true" : undefined}
          aria-describedby={`${id}-hint`}
          className="absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-wait"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        {value?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={value.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-muted">
            {busy ? <Loader2 className="animate-spin" size={22} aria-hidden /> : value ? <FileText size={22} aria-hidden /> : <UploadCloud size={22} aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          {busy ? (
            <>
              <p className="font-medium">Uploading… {progress}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} upload`}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : value ? (
            <>
              <p className="flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 size={16} aria-hidden /> Uploaded
              </p>
              <p className="mt-0.5 truncate text-muted">{value.name}</p>
            </>
          ) : (
            <>
              <p className="font-medium">Choose a file or drop it here</p>
              <p id={`${id}-hint`} className="mt-0.5 text-muted">
                {hint}
              </p>
            </>
          )}
        </div>
        {value && !busy && (
          <span className="btn btn-secondary btn-sm pointer-events-none shrink-0" aria-hidden>
            <RefreshCw size={14} /> Replace
          </span>
        )}
      </div>
      {shownError && (
        <p role="alert" className="field-error">
          {shownError}
        </p>
      )}
    </div>
  );
}
