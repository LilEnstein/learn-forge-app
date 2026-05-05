"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, AlertTriangle, ChevronDown, Plus, Star } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setDefaultUserApiKey, type UserApiKeySummary } from "@/app/actions/api-key"

interface Props {
  keys: UserApiKeySummary[]
  activeId: string | null
  onChanged: () => void
}

function formatResetHint(reset: Date | null): string {
  if (!reset) return ""
  const ms = new Date(reset).getTime() - Date.now()
  if (ms <= 0) return "ready"
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours > 0) return `~${hours}h`
  const mins = Math.floor(ms / (60 * 1000))
  return `~${mins}m`
}

export function KeySwitchDropdown({ keys, activeId, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function pick(keyId: string) {
    if (keyId === activeId) return
    setBusyId(keyId)
    const res = await setDefaultUserApiKey(keyId)
    setBusyId(null)
    if (res.ok) startTransition(onChanged)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
        Switch
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[18rem]" align="end">
        {keys.map((k) => {
          const isActive = k.id === activeId
          const icon =
            k.status === "active" ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            )
          return (
            <DropdownMenuItem
              key={k.id}
              onSelect={(e) => {
                e.preventDefault()
                pick(k.id)
              }}
              disabled={busyId !== null || k.status === "invalid"}
            >
              <span className="flex items-center gap-1 min-w-0 flex-1">
                {isActive ? (
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span className="truncate">{k.name}</span>
                <span className="text-muted-foreground text-xs capitalize">{k.provider}</span>
              </span>
              <span className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
                {icon}
                {k.status === "quota_exceeded" && formatResetHint(k.quotaResetHint)}
              </span>
            </DropdownMenuItem>
          )
        })}
        <div className="my-1 border-t" />
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add new key
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
