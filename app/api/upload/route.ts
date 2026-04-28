import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { getBoss } from "@/lib/queue/boss";
import { randomUUID } from "crypto";
import path from "path";

const MAX_SIZE_BYTES = (parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "50") * 1024 * 1024);
const MAX_DOCUMENTS_FREE = parseInt(process.env.MAX_DOCUMENTS_FREE ?? "3");
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Check free tier document limit
  const docCount = await prisma.document.count({ where: { userId } });
  if (docCount >= MAX_DOCUMENTS_FREE) {
    return NextResponse.json(
      { error: `Free tier allows up to ${MAX_DOCUMENTS_FREE} documents.` },
      { status: 403 }
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${process.env.MAX_UPLOAD_SIZE_MB ?? "50"} MB.` },
      { status: 400 }
    );
  }

  const fileType = ALLOWED_TYPES[file.type];
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: PDF, DOCX, TXT." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || `.${fileType}`;
  const filename = `${randomUUID()}${ext}`;
  const storagePath = await storage.saveFile(buffer, filename);

  const doc = await prisma.document.create({
    data: {
      userId,
      courseId: courseId ?? null,
      name: file.name,
      type: fileType,
      storagePath,
      sizeBytes: file.size,
      status: "processing",
    },
  });

  const boss = await getBoss();
  await boss.send("ingest-document", { documentId: doc.id });

  return NextResponse.json({ documentId: doc.id }, { status: 202 });
}
