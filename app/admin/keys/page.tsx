import { KeyRound } from "lucide-react";

export default function AdminKeysPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Key Pool</h1>
      <p className="text-muted-foreground mt-1">
        Shared provider API keys with per-key daily limits and tier-based routing.
      </p>

      <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <KeyRound className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Coming in Phase 3</p>
        <p className="text-xs text-muted-foreground mt-1">
          PoolKey table + admin key CRUD + routing logic.
        </p>
      </div>
    </div>
  );
}
