import { listPoolKeys } from "@/app/actions/pool-key"
import { PoolKeyTable } from "@/components/admin/PoolKeyActions"
import { AddPoolKeyForm } from "@/components/admin/AddPoolKeyForm"

export default async function AdminKeysPage() {
  const keys = await listPoolKeys()

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Key Pool</h1>
        <p className="text-muted-foreground mt-1">
          Shared provider API keys with per-key daily limits. Used when a user has no BYOK key and
          no env key is configured.
        </p>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">No pool keys yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a key below to let free-tier users access AI features.
          </p>
        </div>
      ) : (
        <PoolKeyTable keys={keys} />
      )}

      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Add Key</h2>
        <AddPoolKeyForm />
      </div>
    </div>
  )
}
