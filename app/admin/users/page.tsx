import { Users } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-1">
        Manage user tiers, promote admins, and review activity.
      </p>

      <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Coming in Phase 5</p>
        <p className="text-xs text-muted-foreground mt-1">
          User list + tier change + admin promote actions.
        </p>
      </div>
    </div>
  );
}
