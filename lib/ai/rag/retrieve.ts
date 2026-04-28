import { prisma } from "@/lib/db/prisma";
import { getEmbeddingModel } from "@/lib/ai/provider";

export interface RetrievedChunk {
  id: string;
  content: string;
  metadata: unknown;
  documentId: string;
  similarity: number;
}

export async function retrieveChunks(
  query: string,
  userId: string,
  opts?: { courseId?: string; topK?: number }
): Promise<RetrievedChunk[]> {
  const topK = opts?.topK ?? 10;
  const embed = getEmbeddingModel();
  const queryEmbedding = await embed(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Get document IDs scoped to this user (optionally filtered by course)
  const docs = await prisma.document.findMany({
    where: {
      userId,
      status: "ready",
      ...(opts?.courseId ? { courseId: opts.courseId } : {}),
    },
    select: { id: true },
  });

  if (docs.length === 0) return [];

  const docIds = docs.map((d) => d.id);

  const rows = await prisma.$queryRaw<
    { id: string; content: string; metadata: unknown; documentId: string; similarity: number }[]
  >`
    SELECT id, content, metadata, "documentId",
           1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "documentId" = ANY(${docIds}::text[])
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  return rows;
}
