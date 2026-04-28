"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, File } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadedDoc {
  docId: string;
  name: string;
  type: string;
  sizeBytes: number;
  status: "processing" | "ready" | "error";
}

interface Props {
  onUploaded: (doc: UploadedDoc) => void;
  courseId?: string;
}

const ACCEPTED = ".pdf,.docx,.txt";
const MAX_MB = parseInt(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? "50");

export function DropZone({ onUploaded, courseId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  }

  function selectFile(file: File) {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Max size is ${MAX_MB} MB.`);
      return;
    }
    setSelected(file);
  }

  async function handleUpload() {
    if (!selected || uploading) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selected);
    if (courseId) formData.append("courseId", courseId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      const typeMap: Record<string, string> = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "text",
      };

      onUploaded({
        docId: data.documentId,
        name: selected.name,
        type: typeMap[selected.type] ?? "text",
        sizeBytes: selected.size,
        status: "processing",
      });

      setSelected(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Drop a file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT — max {MAX_MB} MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={handleChange}
        />
      </div>

      {selected && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm truncate">{selected.name}</span>
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
