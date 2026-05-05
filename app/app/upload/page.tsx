import { getUserApiKeys } from "@/app/actions/api-key"
import { KeyStatusBar } from "@/components/upload/KeyStatusBar"
import { UploadPageClient } from "@/components/upload/UploadPageClient"

export default async function UploadPage() {
  const keys = await getUserApiKeys()

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <KeyStatusBar initialKeys={keys} />
      <UploadPageClient />
    </div>
  )
}
