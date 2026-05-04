import Link from "next/link"

interface Props {
  show: boolean
}

export function NoAiKeyBanner({ show }: Props) {
  if (!show) return null
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-700 dark:bg-yellow-950">
      <span>⚠️</span>
      <span className="text-yellow-800 dark:text-yellow-200">
        AI provider not configured. Add your API key in{" "}
        <Link href="/app/settings" className="font-medium underline underline-offset-2">
          Settings
        </Link>{" "}
        to use this feature.
      </span>
    </div>
  )
}
