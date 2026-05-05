"use client"

import { useState } from "react"
import { Star, Check, AlertTriangle, RefreshCw, Settings as Cog, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  removeUserApiKey,
  setDefaultUserApiKey,
  refreshKeyModels,
  type UserApiKeySummary,
} from "@/app/actions/api-key"
import { KeyConfigModal } from "./KeyConfigModal"

interface Props {
  apiKey: UserApiKeySummary
  onChange: () => void
}

function formatResetHint(reset: Date | null): string {
  if (!reset) return ""
  const ms = new Date(reset).getTime() - Date.now()
  if (ms <= 0) return "ready to retry"
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 0) return `Reset in ~${hours}h ${mins}m`
  return `Reset in ~${mins}m`
}

function formatLastUsed(d: Date | null): string {
  if (!d) return "never used"
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "used just now"
  if (min < 60) return `used ${min}m ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `used ${hours}h ago`
  return `used ${Math.floor(hours / 24)}d ago`
}

export function ApiKeyCard({ apiKey, onChange }: Props) {
  const [busy, setBusy] = useState<"set-default" | "remove" | "refresh" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  async function handleSetDefault() {
    setBusy("set-default")
    setError(null)
    const res = await setDefaultUserApiKey(apiKey.id)
    setBusy(null)
    if (!res.ok) setError(res.error)
    else onChange()
  }

  async function handleRemove() {
    if (!confirm(`Remove "${apiKey.name}"? This cannot be undone.`)) return
    setBusy("remove")
    setError(null)
    const res = await removeUserApiKey(apiKey.id)
    setBusy(null)
    if (!res.ok) setError(res.error)
    else onChange()
  }

  async function handleRefresh() {
    setBusy("refresh")
    setError(null)
    const res = await refreshKeyModels(apiKey.id)
    setBusy(null)
    if (!res.ok) setError(res.error)
    else onChange()
  }

  const statusIcon =
    apiKey.status === "active"
      ? <Check className="h-3.5 w-3.5 text-green-600" />
      : apiKey.status === "quota_exceeded"
      ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
      : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />

  const statusText =
    apiKey.status === "active"
      ? "Active"
      : apiKey.status === "quota_exceeded"
      ? formatResetHint(apiKey.quotaResetHint)
      : "Invalid"

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              {apiKey.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
              <span className="truncate">{apiKey.name}</span>
              <span className="text-muted-foreground text-xs capitalize">{apiKey.provider}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {statusIcon}
              <span>{statusText}</span>
              <span>•</span>
              <span>{formatLastUsed(apiKey.lastUsedAt)}</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground">{apiKey.maskedKey}</div>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {!apiKey.isDefault && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetDefault}
              disabled={busy !== null || apiKey.status === "invalid"}
            >
              {busy === "set-default" ? "..." : "Set default"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
            <Cog className="h-3.5 w-3.5" />
            Config
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={busy !== null}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />
            Refresh models
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-destructive hover:bg-destructive/10"
            onClick={handleRemove}
            disabled={busy !== null}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>

      <KeyConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        apiKey={apiKey}
        onSaved={onChange}
      />
    </>
  )
}
