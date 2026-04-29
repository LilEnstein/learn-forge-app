"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type FileStatus = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "ready" | "error" | "cancelled";
  docId?: string;
  error?: string;
  chunks?: number;
  controller?: AbortController;
};

type Props = {
  courseId?: string;
  courseName?: string;
  topic?: string;
  minFiles?: number;
  redirectTo?: string;
  onComplete?: (courseId: string) => void;
};

const ACCEPTED = ".pdf,.docx,.txt,.md";
const ALLOWED_EXTS = ["pdf", "docx", "txt", "md"];

export function DropZone({
  courseId,
  courseName,
  topic,
  minFiles = 1,
  redirectTo,
  onComplete,
}: Props) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const filesRef = useRef<FileStatus[]>([]);
  const router = useRouter();

  // Mirror state to a ref so async handlers (cancel, polling) can read the
  // latest snapshot without depending on stale closures.
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // On unmount: stop all polling and abort any in-flight uploads.
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach((id) => clearInterval(id));
      filesRef.current.forEach((f) => f.controller?.abort());
    };
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  }, []);

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return ALLOWED_EXTS.includes(ext);
    });
    setFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pending" as const,
      })),
    ]);
    setError(null);
  }

  function patchFile(id: string, patch: Partial<FileStatus>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function uploadOne(
    fs: FileStatus,
    courseIdToUse: string | null
  ): Promise<string | null> {
    const controller = new AbortController();
    patchFile(fs.id, { status: "uploading", controller });

    const fd = new FormData();
    fd.append("files", fs.file);
    if (courseIdToUse) fd.append("courseId", courseIdToUse);
    if (courseName) fd.append("courseName", courseName);
    if (topic) fd.append("topic", topic);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const doc = data.documents[0];
      patchFile(fs.id, {
        status: "processing",
        docId: doc.id,
        controller: undefined,
      });
      startPolling(doc.id, data.courseId);
      return data.courseId as string;
    } catch (err) {
      // AbortError → silent: cancel handler already updated UI to "cancelled".
      if (err instanceof DOMException && err.name === "AbortError") return null;
      if ((err as Error)?.name === "AbortError") return null;

      patchFile(fs.id, {
        status: "error",
        error: (err as Error).message ?? "Upload failed",
        controller: undefined,
      });
      return null;
    }
  }

  async function handleUpload() {
    const pending = filesRef.current.filter((f) => f.status === "pending");
    if (pending.length < minFiles && !courseId) {
      setError(`Need at least ${minFiles} file(s)`);
      return;
    }
    if (pending.length === 0) return;

    setIsUploading(true);
    setError(null);

    let resolvedCourseId: string | null = courseId ?? null;
    let queue = pending;

    // The first file establishes the course when no courseId is provided —
    // run it alone so subsequent parallel uploads can reuse the courseId.
    if (!resolvedCourseId) {
      const first = queue[0];
      const cid = await uploadOne(first, null);
      if (!cid) {
        // First was cancelled or errored — bail without starting the rest.
        setIsUploading(false);
        return;
      }
      resolvedCourseId = cid;
      queue = queue.slice(1);
    }

    await Promise.all(queue.map((fs) => uploadOne(fs, resolvedCourseId!)));
    // isUploading remains true until polling finishes the last file.
  }

  async function handleCancel(id: string) {
    const fs = filesRef.current.find((f) => f.id === id);
    if (!fs) return;

    if (fs.status === "pending") {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      return;
    }

    if (fs.status === "uploading") {
      fs.controller?.abort();
      patchFile(id, { status: "cancelled", controller: undefined });
      return;
    }

    if (fs.status === "processing" || fs.status === "ready" || fs.status === "error") {
      // Stop polling first so a status update doesn't race the delete.
      if (fs.docId && pollingRef.current[fs.docId]) {
        clearInterval(pollingRef.current[fs.docId]);
        delete pollingRef.current[fs.docId];
      }
      patchFile(id, { status: "cancelled" });
      if (fs.docId) {
        await fetch(`/api/upload/${fs.docId}`, { method: "DELETE" }).catch(() => {});
      }
    }
  }

  function removeFromList(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function startPolling(docId: string, resolvedCourseId: string) {
    pollingRef.current[docId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload/status/${docId}`);
        if (res.status === 404) {
          // Doc was deleted (cancelled) — stop silently.
          clearInterval(pollingRef.current[docId]);
          delete pollingRef.current[docId];
          return;
        }
        const data = await res.json();

        setFiles((prev) =>
          prev.map((f) =>
            f.docId === docId && f.status !== "cancelled"
              ? { ...f, status: data.status, chunks: data.chunkCount }
              : f
          )
        );

        if (data.status === "ready" || data.status === "error") {
          clearInterval(pollingRef.current[docId]);
          delete pollingRef.current[docId];
          maybeFinish(resolvedCourseId);
        }
      } catch {
        // ignore transient polling errors
      }
    }, 2000);
  }

  function maybeFinish(resolvedCourseId: string) {
    setFiles((current) => {
      const terminal = (s: FileStatus["status"]) =>
        s === "ready" || s === "error" || s === "cancelled";
      const allDone = current.length > 0 && current.every((f) => terminal(f.status));
      if (allDone) {
        setIsUploading(false);
        if (current.some((f) => f.status === "ready")) {
          onComplete?.(resolvedCourseId);
          if (redirectTo) router.push(redirectTo);
        }
      }
      return current;
    });
  }

  const readyCount = files.filter((f) => f.status === "ready").length;
  const totalActive = files.filter((f) => f.status !== "cancelled").length;
  const hasPending = files.some((f) => f.status === "pending");

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById("lf-file-input")?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-violet-500 bg-violet-50"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          id="lf-file-input"
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={onFileInput}
        />
        <div className="text-4xl mb-3">📁</div>
        <p className="text-sm font-medium">
          Drop files here or <span className="text-violet-600">click to browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, TXT, MD · up to 50 MB each
          {minFiles > 1 ? ` · need at least ${minFiles}` : ""}
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <FileRow
              key={f.id}
              fileStatus={f}
              onCancel={() => handleCancel(f.id)}
              onRemove={() => removeFromList(f.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      {files.length > 0 && totalActive < minFiles && !isUploading && (
        <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          Add {minFiles - totalActive} more file(s) to proceed
        </p>
      )}

      {hasPending && (
        <button
          onClick={handleUpload}
          disabled={totalActive < minFiles || isUploading}
          className="w-full py-3 rounded-xl font-medium text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading
            ? `Processing… (${readyCount}/${totalActive} done)`
            : `Upload ${files.filter((f) => f.status === "pending").length} file(s)`}
        </button>
      )}

      {totalActive > 0 && readyCount === totalActive && !hasPending && (
        <div className="text-center py-3 text-sm text-green-700 bg-green-50 rounded-xl">
          All documents processed
          {redirectTo ? " — redirecting…" : ""}
        </div>
      )}
    </div>
  );
}

function FileRow({
  fileStatus,
  onCancel,
  onRemove,
}: {
  fileStatus: FileStatus;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { file, status, chunks, error } = fileStatus;

  const statusConfig = {
    pending: { icon: "📄", color: "text-muted-foreground", label: "Ready to upload" },
    uploading: { icon: "⬆️", color: "text-blue-500", label: "Uploading…" },
    processing: {
      icon: "⚙️",
      color: "text-amber-500",
      label: chunks ? `Embedded ${chunks} chunks` : "Processing…",
    },
    ready: { icon: "✅", color: "text-green-600", label: "Ready" },
    error: { icon: "❌", color: "text-destructive", label: error ?? "Error" },
    cancelled: { icon: "🚫", color: "text-muted-foreground", label: "Cancelled" },
  } as const;

  const cfg = statusConfig[status];

  // Cancel: while pending/uploading/processing/ready/error → call onCancel.
  // For cancelled rows, only show an X to remove from the list.
  const showCancel = status !== "cancelled";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <span className="text-xl">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
      </div>
      <span className="text-xs text-muted-foreground">
        {(file.size / 1024 / 1024).toFixed(1)} MB
      </span>
      {showCancel ? (
        <button
          onClick={onCancel}
          aria-label={status === "ready" ? "Remove" : "Cancel"}
          className="text-muted-foreground hover:text-destructive text-lg leading-none px-1"
          title={status === "ready" ? "Remove" : "Cancel"}
        >
          ×
        </button>
      ) : (
        <button
          onClick={onRemove}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-destructive text-lg leading-none px-1"
          title="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
