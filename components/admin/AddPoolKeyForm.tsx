"use client"

import { useFormState, useFormStatus } from "react-dom"
import { addPoolKey } from "@/app/actions/pool-key"

const initialState: { success?: true; error?: string } = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {pending ? "Adding..." : "Add Key"}
    </button>
  )
}

export function AddPoolKeyForm() {
  const [state, action] = useFormState(addPoolKey, initialState)

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Provider</label>
          <select
            name="provider"
            required
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="cerebras">Cerebras</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Label (optional)</label>
          <input
            name="label"
            type="text"
            placeholder="e.g. Gemini primary"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium">API Key</label>
          <input
            name="apiKey"
            type="password"
            required
            placeholder="sk-... / AIza..."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Daily Limit</label>
          <input
            name="dailyLimit"
            type="number"
            defaultValue={1000}
            min={1}
            max={100000}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Priority</label>
          <input
            name="priority"
            type="number"
            defaultValue={0}
            min={0}
            max={999}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Lower = used first</p>
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
          Key added successfully.
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
