import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { inngest } from "@/lib/inngest/client";

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
  // env API key. Users who have configured their own UserApiKey are on BYOK.
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

  const createdDocs = await Promise.all(
    files.map(async (file) => {
      const ext = path.extname(file.name).toLowerCase();
      const fileId = crypto.randomUUID();
      const blobKey = `documents/${userId}/${fileId}${ext}`;

      const blob = await put(blobKey, file, {
        access: "public",
        addRandomSuffix: false,
      });

      const docType = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "text";

      return prisma.document.create({
        data: {
          userId,
          courseId: resolvedCourseId,
          name: file.name,
          type: docType,
          storagePath: blob.url,
          sizeBytes: file.size,
          status: "processing",
        },
      });
    })
  );

  // Hand off to Inngest — the worker downloads from Blob, parses, embeds, and
  // (when all course docs are ready) enqueues curriculum generation.
  await Promise.all(
    createdDocs.map((doc) =>
      inngest.send({
        name: "app/document.uploaded",
        data: { documentId: doc.id },
      })
    )
  );

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
