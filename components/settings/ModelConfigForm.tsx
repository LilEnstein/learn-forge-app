"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { saveModelConfig, type ModelConfigInput } from "@/app/actions/api-key"
import type { ModelInfo, TaskType } from "@/lib/ai/types"
import { TASK_REQUIREMENTS } from "@/lib/ai/types"

interface Props {
  initial: ModelConfigInput | null
  models: ModelInfo[]
  // If true, render a Save button. If false, parent handles saving.
  showSave?: boolean
  onSaved?: () => void
}

const TASK_LABELS: Record<TaskType, { emoji: string; label: string }> = {
  fileProcessing: { emoji: "📄", label: "File Processing" },
  courseGen: { emoji: "🧠", label: "Course Generation" },
  companion: { emoji: "💬", label: "AI Companion" },
  embedding: { emoji: "🔍", label: "Embeddings" },
}

function modelsForTask(all: ModelInfo[], task: TaskType): ModelInfo[] {
  const req = TASK_REQUIREMENTS[task]
  return all.filter((m) => {
    if (!m.capabilities.includes(req.capability)) return false
    if (req.nameMustInclude && !m.name.toLowerCase().includes(req.nameMustInclude.toLowerCase())) return false
    return true
  })
}

export function ModelConfigForm({ initial, models, showSave = true, onSaved }: Props) {
  const [config, setConfig] = useState<ModelConfigInput>({
    fileProcessing: initial?.fileProcessing ?? null,
    courseGen: initial?.courseGen ?? null,
    companion: initial?.companion ?? null,
    embedding: initial?.embedding ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await saveModelConfig(config)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    onSaved?.()
  }

  function setTaskModel(task: TaskType, value: string) {
    setConfig((c) => ({ ...c, [task]: value || null }))
  }

  const tasks: TaskType[] = ["fileProcessing", "courseGen", "companion", "embedding"]

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const opts = modelsForTask(models, task)
        const meta = TASK_LABELS[task]
        const value = config[task] ?? ""
        return (
          <div key={task} className="grid grid-cols-[1fr_2fr] items-center gap-3">
            <Label className="flex items-center gap-2 text-sm">
              <span aria-hidden>{meta.emoji}</span>
              {meta.label}
            </Label>
            <select
              value={value}
              onChange={(e) => setTaskModel(task, e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">(use provider default)</option>
              {opts.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.displayName}
                  {m.tags.length > 0 ? `  [${m.tags.join(", ")}]` : ""}
                </option>
              ))}
              {opts.length === 0 && (
                <option disabled>No compatible models — refresh from key</option>
              )}
            </select>
          </div>
        )
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showSave && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Configuration"}
          </Button>
          {saved && <span className="text-sm text-green-600">✓ Saved</span>}
        </div>
      )}
    </div>
  )
}
