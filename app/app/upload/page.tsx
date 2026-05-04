import { getUserApiKeyStatus } from "@/app/actions/api-key"
import { hasEnvKey } from "@/lib/ai/user-provider"
import { NoAiKeyBanner } from "@/components/settings/NoAiKeyBanner"
import { UploadPageClient } from "@/components/upload/UploadPageClient"

export default async function UploadPage() {
  const keyStatus = await getUserApiKeyStatus()
  const showBanner = !keyStatus && !hasEnvKey(process.env.AI_PROVIDER ?? "gemini")

  return (
    <>
      <NoAiKeyBanner show={showBanner} />
      <UploadPageClient />
    </>
  )
}
