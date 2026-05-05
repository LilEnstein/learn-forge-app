import { Mail } from "lucide-react";

export default function AdminRequestsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Upgrade Requests</h1>
      <p className="text-muted-foreground mt-1">
        Review free → pro upgrade requests submitted by users.
      </p>

      <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Coming in Phase 4</p>
        <p className="text-xs text-muted-foreground mt-1">
          UpgradeRequest table + approve/reject flow + email notifications.
        </p>
      </div>
    </div>
  );
}
