"use client"

import { useTransition } from "react"
import { togglePoolKey, deletePoolKey } from "@/app/actions/pool-key"
import type { PoolKeyRow } from "@/app/actions/pool-key"

export function PoolKeyTable({ keys }: { keys: PoolKeyRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Label / Provider</th>
            <th className="px-4 py-3 font-medium">Key</th>
            <th className="px-4 py-3 font-medium">Daily Usage</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <PoolKeyRow key={key.id} row={key} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PoolKeyRow({ row }: { row: PoolKeyRow }) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(() => togglePoolKey(row.id))
  }
  function handleDelete() {
    if (!confirm(`Delete key ${row.maskedKey}?`)) return
    startTransition(() => deletePoolKey(row.id))
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium">{row.label ?? "—"}</div>
        <div className="text-xs text-muted-foreground uppercase">{row.provider}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{row.maskedKey}</td>
      <td className="px-4 py-3">
        <span className={row.dailyUsed >= row.dailyLimit ? "text-destructive" : ""}>
          {row.dailyUsed} / {row.dailyLimit}
        </span>
      </td>
      <td className="px-4 py-3">{row.priority}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={isPending}
            className="text-xs underline text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {row.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs underline text-destructive hover:text-destructive/80 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
