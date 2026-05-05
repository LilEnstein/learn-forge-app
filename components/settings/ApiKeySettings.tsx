"use client"

import { useState } from "react"
import { saveUserApiKey, deleteUserApiKey } from "@/app/actions/api-key"

type Provider = "gemini" | "openai" | "groq" | "cerebras" | "ollama" | "openai-compat"

interface KeyStatus {
  provider: Provider
  maskedKey: string
  verifiedAt: Date
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "cerebras", label: "Cerebras" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "openai-compat", label: "OpenAI-compatible" },
]

const PLACEHOLDER_MODELS: Record<Provider, { fast: string; capable: string }> = {
  gemini: { fast: "gemini-2.5-flash", capable: "gemini-2.5-pro" },
  openai: { fast: "gpt-4o-mini", capable: "gpt-4o" },
  groq: { fast: "llama-3.1-8b-instant", capable: "llama-3.3-70b-versatile" },
  cerebras: { fast: "llama3.1-8b", capable: "llama3.3-70b" },
  ollama: { fast: "llama3.1", capable: "llama3.1:70b" },
  "openai-compat": { fast: "", capable: "" },
}

const LLM_ONLY = new Set<Provider>(["groq", "cerebras"])

interface Props {
  initial: KeyStatus | null
}

export function ApiKeySettings({ initial }: Props) {
  const [status, setStatus] = useState<KeyStatus | null>(initial)
  const [editing, setEditing] = useState(!initial)
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? "gemini")
  const [apiKey, setApiKey] = useState("")
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [compatUrl, setCompatUrl] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [fastModel, setFastModel] = useState("")
  const [capableModel, setCapableModel] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await saveUserApiKey({
      provider,
      apiKey: provider !== "ollama" ? apiKey : undefined,
      ollamaBaseUrl: provider === "ollama" ? ollamaUrl : undefined,
      openAiCompatBaseUrl: provider === "openai-compat" ? compatUrl : undefined,
      fastModel: fastModel || undefined,
      capableModel: capableModel || undefined,
    })

    setSaving(false)

    if ("error" in result) {
      setError(result.error)
      return
    }

    setStatus({ provider: result.provider as Provider, maskedKey: result.maskedKey, verifiedAt: result.verifiedAt })
    setEditing(false)
    setApiKey("")
  }

  async function handleRemove() {
    setRemoving(true)
    await deleteUserApiKey()
    setStatus(null)
    setEditing(true)
    setRemoving(false)
  }

  if (!editing && status) {
    return (
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">AI Provider</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">✓</span>
          <span className="font-medium capitalize">{status.provider}</span>
          <span className="text-muted-foreground">— {status.maskedKey}</span>
          <span className="text-muted-foreground text-xs ml-2">
            verified {new Date(status.verifiedAt).toLocaleDateString()}
          </span>
        </div>
        {LLM_ONLY.has(status.provider) && (
          <p className="text-xs text-muted-foreground">
            Embeddings use the server&apos;s configured EMBEDDING_PROVIDER.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
          >
            Change
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="rounded-lg border p-6 space-y-5">
      <h2 className="text-lg font-semibold">AI Provider</h2>

      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Provider</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProvider(p.value)}
              className={`px-3 py-2 text-sm border rounded-md text-left transition-colors ${
                provider === p.value
                  ? "border-primary bg-primary/5 font-medium"
                  : "hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key input */}
      {provider === "ollama" ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Ollama Base URL</label>
          <input
            type="url"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
      ) : (
        <div className="space-y-1">
          {provider === "openai-compat" && (
            <div className="space-y-1 mb-3">
              <label className="text-sm font-medium">Base URL</label>
              <input
                type="url"
                value={compatUrl}
                onChange={(e) => setCompatUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
          )}
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              required
              className="w-full px-3 py-2 pr-16 text-sm border rounded-md bg-background"
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
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Advanced */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? "▲ Hide advanced" : "▼ Advanced model overrides"}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fast model</label>
              <input
                type="text"
                value={fastModel}
                onChange={(e) => setFastModel(e.target.value)}
                placeholder={PLACEHOLDER_MODELS[provider].fast}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Capable model</label>
              <input
                type="text"
                value={capableModel}
                onChange={(e) => setCapableModel(e.target.value)}
                placeholder={PLACEHOLDER_MODELS[provider].capable}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Verifying…" : "Test & Save"}
        </button>
        {status && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
