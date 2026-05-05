import { getUserApiKeys } from "@/app/actions/api-key"
import { ApiKeyList } from "@/components/settings/ApiKeyList"

export default async function SettingsPage() {
  const keys = await getUserApiKeys()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your AI provider keys. Add multiple keys for automatic failover when one hits its quota.
        </p>
      </div>
      <ApiKeyList initialKeys={keys} />
    </div>
  )
}
