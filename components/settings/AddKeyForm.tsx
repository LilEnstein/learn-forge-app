"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addUserApiKey } from "@/app/actions/api-key"
import type { AiProviderName } from "@/lib/ai/types"
import { ALL_PROVIDERS } from "@/lib/ai/types"

interface Props {
  onAdded: () => void
  onCancel: () => void
}

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  groq: "Groq",
  cerebras: "Cerebras",
  ollama: "Ollama (local)",
  "openai-compat": "OpenAI-compatible",
}

export function AddKeyForm({ onAdded, onCancel }: Props) {
  const [name, setName] = useState("")
  const [provider, setProvider] = useState<AiProviderName>("gemini")
  const [apiKey, setApiKey] = useState("")
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [compatUrl, setCompatUrl] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccessCount(null)

    const res = await addUserApiKey({
      name: name.trim() || `${PROVIDER_LABELS[provider]} key`,
      provider,
      apiKey: provider !== "ollama" ? apiKey : undefined,
      ollamaBaseUrl: provider === "ollama" ? ollamaUrl : undefined,
      openAiCompatBaseUrl: provider === "openai-compat" ? compatUrl : undefined,
      isDefault,
    })

    setSubmitting(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    setSuccessCount(res.key.availableModels?.length ?? 0)
    // Brief success display before closing
    setTimeout(() => onAdded(), 600)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-5 space-y-4 bg-muted/30">
      <h3 className="text-sm font-semibold">Add a new API key</h3>

      <div className="space-y-1.5">
        <Label htmlFor="key-name">Name</Label>
        <Input
          id="key-name"
          placeholder='e.g. "Personal key", "Work key"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Provider</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`px-3 py-2 text-sm border rounded-md text-left transition-colors ${
                provider === p ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"
              }`}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {provider === "ollama" ? (
        <div className="space-y-1.5">
          <Label htmlFor="ollama-url">Ollama Base URL</Label>
          <Input
            id="ollama-url"
            type="url"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
      ) : (
        <>
          {provider === "openai-compat" && (
            <div className="space-y-1.5">
              <Label htmlFor="compat-url">Base URL</Label>
              <Input
                id="compat-url"
                type="url"
                value={compatUrl}
                onChange={(e) => setCompatUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key"
                required
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4"
        />
        <span>Set as default key</span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {successCount !== null && (
        <p className="text-sm text-green-600">
          ✓ Verified — discovered {successCount} model{successCount === 1 ? "" : "s"}.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Verifying & discovering models…" : "Verify & Add"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
