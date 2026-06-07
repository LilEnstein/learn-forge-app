import { Client } from "pg"
import type { ProgressEvent } from "@/types/progress"

// Progress events must cross a process/module boundary: the pg-boss worker
// (started from instrumentation.ts) and the SSE route handler are compiled into
// separate Next.js bundles, so a module-level in-memory Map is NOT shared
// between them. Instead we bridge through Postgres LISTEN/NOTIFY — the one thing
// both instances already share (the same database pg-boss runs on).

const CHANNEL = "learnforge_progress"

interface Payload {
  docId: string
  event: ProgressEvent
}

export const progressEmitter = {
  /**
   * Open an SSE stream for one document. Connects a dedicated pg client that
   * LISTENs on the shared channel and forwards events for this docId only.
   */
  subscribe(docId: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    let client: Client | null = null

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        client = new Client({ connectionString: process.env.DATABASE_URL })

        const onNotification = (msg: { channel: string; payload?: string }) => {
          if (msg.channel !== CHANNEL || !msg.payload) return
          let parsed: Payload
          try {
            parsed = JSON.parse(msg.payload)
          } catch {
            return
          }
          if (parsed.docId !== docId) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed.event)}\n\n`))
          } catch {
            return
          }
          // Terminal events end the stream.
          if (parsed.event.step === "done" || parsed.event.step === "error") {
            void cleanup()
            try {
              controller.close()
            } catch {
              // already closed
            }
          }
        }

        async function cleanup() {
          if (!client) return
          const c = client
          client = null
          c.removeListener("notification", onNotification)
          await c.end().catch(() => {})
        }

        client.on("notification", onNotification)
        client.on("error", () => void cleanup())

        try {
          await client.connect()
          await client.query(`LISTEN ${CHANNEL}`)
        } catch {
          // Serverless/pooled Postgres (e.g. Neon on Vercel) may reject LISTEN.
          // Close the stream cleanly instead of throwing a 500 so the client
          // falls back to status polling.
          await cleanup()
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
      },
      async cancel() {
        if (client) {
          const c = client
          client = null
          await c.end().catch(() => {})
        }
      },
    })
  },

  /**
   * Publish a progress event. Runs in the worker; broadcast via NOTIFY so any
   * LISTENing SSE route (in any module instance/process) receives it.
   */
  async emit(docId: string, event: ProgressEvent): Promise<void> {
    const payload: Payload = { docId, event }
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    try {
      await client.connect()
      // pg_notify takes the payload as a bound parameter — avoids quoting issues.
      await client.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)])
    } catch {
      // Progress is best-effort telemetry; never fail ingestion because of it.
    } finally {
      await client.end().catch(() => {})
    }
  },

  /**
   * Kept for API compatibility with callers in the ingest pipeline. The stream
   * closes itself on the terminal "done"/"error" event, so this is a no-op.
   */
  close(_docId: string): void {
    // no-op: subscribe() tears down its own pg client on terminal events
  },
}
