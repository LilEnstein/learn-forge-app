import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, { params }: { params: { docId: string } }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.docId, userId: session.user.id },
    select: {
      id: true,
      name: true,
      status: true,
      sizeBytes: true,
      _count: { select: { chunks: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    sizeBytes: doc.sizeBytes,
    chunkCount: doc._count.chunks,
  });
}
