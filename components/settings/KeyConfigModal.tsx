"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModelConfigForm } from "./ModelConfigForm"
import { getModelConfig, type UserApiKeySummary, type ModelConfigInput } from "@/app/actions/api-key"

interface Props {
  open: boolean
  onClose: () => void
  apiKey: UserApiKeySummary
  onSaved: () => void
}

export function KeyConfigModal({ open, onClose, apiKey, onSaved }: Props) {
  const [config, setConfig] = useState<ModelConfigInput | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getModelConfig().then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Model configuration — {apiKey.name}</DialogTitle>
          <DialogDescription>
            Choose which model to use for each task. Only models that this key supports for the
            given task are listed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (apiKey.availableModels?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No models discovered for this key yet. Click <strong>Refresh models</strong> on the key
            card and try again.
          </p>
        ) : (
          <ModelConfigForm
            initial={config}
            models={apiKey.availableModels ?? []}
            onSaved={() => {
              onSaved()
              onClose()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
