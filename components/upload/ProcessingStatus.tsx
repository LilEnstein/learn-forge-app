"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  docId: string;
  onReady?: () => void;
}

export function ProcessingStatus({ docId, onReady }: Props) {
  const [status, setStatus] = useState<"processing" | "ready" | "error">("processing");

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 3000));
        if (stopped) break;

        try {
          const res = await fetch(`/api/upload/status/${docId}`);
          if (!res.ok) break;
          const data: { status: string } = await res.json();
          if (data.status === "ready" || data.status === "error") {
            setStatus(data.status as "ready" | "error");
            if (data.status === "ready") onReady?.();
            break;
          }
        } catch {
          break;
        }
      }
    };

    poll();
    return () => { stopped = true; };
  }, [docId, onReady]);

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Processing…
      </span>
    );
  }

  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
        <CheckCircle className="h-3.5 w-3.5" />
        Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      Error
    </span>
  );
}
