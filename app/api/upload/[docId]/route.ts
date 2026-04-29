import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const docId = params.docId;

  const doc = await prisma.document.findFirst({
    where: { id: docId, userId },
    select: { id: true, storagePath: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Row delete cascades to DocumentChunk; in-flight ingest will throw on next
  // prisma read and fall through to its existing .catch — no special signal needed.
  await prisma.document.delete({ where: { id: doc.id } });
  await unlink(doc.storagePath).catch(() => {});

  return NextResponse.json({ success: true });
}
