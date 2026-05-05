import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const MAX_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "50");
const FREE_LIMIT = parseInt(process.env.MAX_DOCUMENTS_FREE ?? "3");
const ALLOWED_EXTS = [".pdf", ".docx", ".txt", ".md"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  const courseId = (formData.get("courseId") as string | null) ?? null;
  const courseName = (formData.get("courseName") as string | null) ?? "New course";
  const topic = (formData.get("topic") as string | null) ?? "general";

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Validate file types and sizes
  const errors: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      errors.push(`${file.name}: unsupported type (allowed: PDF, DOCX, TXT, MD)`);
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      errors.push(`${file.name}: exceeds ${MAX_SIZE_MB} MB`);
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  // Free-tier doc cap — only enforced when the user is consuming the server's
  // env API key. Users who have configured their own UserApiKey are on BYOK
  // (they pay for inference themselves), so we don't cap their corpus.
  const ownKeyCount = await prisma.userApiKey.count({ where: { userId } });
  if (ownKeyCount === 0) {
    const docCount = await prisma.document.count({ where: { userId } });
    if (docCount + files.length > FREE_LIMIT) {
      return NextResponse.json(
        {
          error: `Free tier allows up to ${FREE_LIMIT} documents. Add your own API key in Settings to remove this limit.`,
        },
        { status: 403 }
      );
    }
  }

  // Resolve course — create new if no courseId provided
  let resolvedCourseId = courseId;
  if (!resolvedCourseId) {
    const course = await prisma.course.create({
      data: { userId, title: courseName, topic, status: "processing" },
    });
    resolvedCourseId = course.id;
  } else {
    const existing = await prisma.course.findFirst({
      where: { id: resolvedCourseId, userId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
  }

  // Save files to disk + create Document rows
  await mkdir(UPLOAD_DIR, { recursive: true });

  const createdDocs = await Promise.all(
    files.map(async (file) => {
      const ext = path.extname(file.name).toLowerCase();
      const fileId = crypto.randomUUID();
      const fileName = `${fileId}${ext}`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const docType = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "text";

      return prisma.document.create({
        data: {
          userId,
          courseId: resolvedCourseId,
          name: file.name,
          type: docType,
          storagePath: filePath,
          sizeBytes: file.size,
          status: "processing",
        },
      });
    })
  );

  // Fire-and-forget ingestion in the same Node.js process (dev-friendly).
  // pg-boss is unreliable in Next.js dev — direct invocation works every time.
  for (const doc of createdDocs) {
    import("@/lib/upload/ingest")
      .then(({ ingestDocument }) =>
        ingestDocument(doc.id).catch((e) =>
          console.error(`[upload] ingest failed for ${doc.id}:`, e)
        )
      )
      .catch((e) => console.error("[upload] failed to load ingest module:", e));
  }

  return NextResponse.json({
    success: true,
    courseId: resolvedCourseId,
    documents: createdDocs.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
    })),
  });
}
