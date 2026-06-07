import { type NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { progressEmitter } from '@/lib/progress-emitter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { docId } = params
  const stream = progressEmitter.subscribe(docId)

  request.signal.addEventListener('abort', () => {
    progressEmitter.close(docId)
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
