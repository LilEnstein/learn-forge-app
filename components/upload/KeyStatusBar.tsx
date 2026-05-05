"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Key, AlertTriangle } from "lucide-react"
import { KeySwitchDropdown } from "./KeySwitchDropdown"
import { getUserApiKeys, type UserApiKeySummary } from "@/app/actions/api-key"
import type { KeyStatusResponse } from "@/app/api/user/key-status/route"

interface Props {
  initialKeys: UserApiKeySummary[]
}

function formatReset(reset: string | null): string {
  if (!reset) return ""
  const ms = new Date(reset).getTime() - Date.now()
  if (ms <= 0) return "ready to retry"
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 0) return `~${hours}h ${mins}m`
  return `~${mins}m`
}

export function KeyStatusBar({ initialKeys }: Props) {
  const [keys, setKeys] = useState<UserApiKeySummary[]>(initialKeys)
  const [status, setStatus] = useState<KeyStatusResponse | null>(null)
  const [, startTransition] = useTransition()

  async function refresh() {
    const [updatedKeys, res] = await Promise.all([
      getUserApiKeys(),
      fetch("/api/user/key-status", { cache: "no-store" }).then((r) => r.json() as Promise<KeyStatusResponse>),
    ])
    setKeys(updatedKeys)
    setStatus(res)
  }

  useEffect(() => {
    fetch("/api/user/key-status", { cache: "no-store" })
      .then((r) => r.json() as Promise<KeyStatusResponse>)
      .then(setStatus)
      .catch(() => {})
  }, [])

  if (keys.length === 0) {
    if (status?.hasEnvFallback) {
      return (
        <div className="rounded-md border bg-muted/40 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span>Using server&apos;s default AI key.</span>
          </div>
          <Link href="/app/settings" className="text-primary hover:underline">
            Add your own key
          </Link>
        </div>
      )
    }
    return (
      <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <span>No API key configured.</span>
        </div>
        <Link href="/app/settings" className="font-medium underline">
          Add a key in Settings
        </Link>
      </div>
    )
  }

  const active = keys.find((k) => k.isDefault) ?? keys[0]
  const taskModel = status?.models.fileProcessing ?? "(provider default)"

  if (active.status === "quota_exceeded") {
    return (
      <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <strong>{active.name}</strong> hit quota — Reset {formatReset(active.quotaResetHint?.toString() ?? null)}
          </span>
        </div>
        <KeySwitchDropdown
          keys={keys}
          activeId={active.id}
          onChanged={() => startTransition(refresh)}
        />
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-muted/40 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Key className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate">
          <strong>{active.name}</strong>
          <span className="text-muted-foreground"> ({active.provider})</span>
          <span className="mx-1.5 text-muted-foreground">•</span>
          <span className="font-mono text-xs text-muted-foreground">{taskModel}</span>
        </span>
      </div>
      <KeySwitchDropdown
        keys={keys}
        activeId={active.id}
        onChanged={() => startTransition(refresh)}
      />
    </div>
  )
}
