import { getUserApiKeyStatus } from "@/app/actions/api-key"
import { ApiKeySettings } from "@/components/settings/ApiKeySettings"

type Provider = "gemini" | "openai" | "groq" | "cerebras" | "ollama" | "openai-compat"

export default async function SettingsPage() {
  const raw = await getUserApiKeyStatus()
  const status = raw ? { ...raw, provider: raw.provider as Provider } : null

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your AI provider to use LearnForge.</p>
      </div>
      <ApiKeySettings initial={status} />
    </div>
  )
}
