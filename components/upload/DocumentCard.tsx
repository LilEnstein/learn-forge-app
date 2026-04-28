import { FileText, Globe, Youtube, File } from "lucide-react";
import { ProcessingStatus } from "./ProcessingStatus";

interface Props {
  docId: string;
  name: string;
  type: string;
  sizeBytes: number;
  status: "processing" | "ready" | "error";
  onReady?: () => void;
}

const TypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  docx: FileText,
  text: File,
  url: Globe,
  youtube: Youtube,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({ docId, name, type, sizeBytes, status, onReady }: Props) {
  const Icon = TypeIcon[type] ?? File;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      {status === "processing" ? (
        <ProcessingStatus docId={docId} onReady={onReady} />
      ) : status === "ready" ? (
        <span className="text-xs font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
          Ready
        </span>
      ) : (
        <span className="text-xs font-medium text-destructive bg-red-50 rounded-full px-2 py-0.5">
          Error
        </span>
      )}
    </div>
  );
}
