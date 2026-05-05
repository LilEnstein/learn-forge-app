"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiKeyCard } from "./ApiKeyCard"
import { AddKeyForm } from "./AddKeyForm"
import { getUserApiKeys, type UserApiKeySummary } from "@/app/actions/api-key"

interface Props {
  initialKeys: UserApiKeySummary[]
}

export function ApiKeyList({ initialKeys }: Props) {
  const [keys, setKeys] = useState<UserApiKeySummary[]>(initialKeys)
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const updated = await getUserApiKeys()
      setKeys(updated)
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My API Keys</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add Key
          </Button>
        )}
      </div>

      {adding && (
        <AddKeyForm
          onAdded={() => {
            setAdding(false)
            refresh()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {keys.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No API keys yet. Add one to start using AI features.
        </div>
      )}

      <div className="space-y-3">
        {keys.map((k) => (
          <ApiKeyCard key={k.id} apiKey={k} onChange={refresh} />
        ))}
      </div>
    </section>
  )
}
