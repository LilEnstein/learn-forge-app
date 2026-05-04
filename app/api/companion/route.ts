import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ChatMessage } from "@/lib/ai/provider";
import { getProviderForUser } from "@/lib/ai/user-provider";
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors";
import type { CompanionContext } from "@/lib/companion/useCompanionContext";

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  context: z.discriminatedUnion("type", [
    z.object({ type: z.literal("lesson"), courseId: z.string(), lessonId: z.string() }),
    z.object({ type: z.literal("map"), courseId: z.string() }),
    z.object({ type: z.literal("general") }),
  ]),
});

// Module-level cache: key → { strings, expiresAt }
interface ContextStrings { courseTitle: string; courseTopic?: string; lessonTitle?: string }
const contextCache = new Map<string, { data: ContextStrings; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveContextStrings(ctx: CompanionContext): Promise<ContextStrings> {
  const cacheKey = ctx.type === "lesson"
    ? `lesson:${ctx.lessonId}`
    : ctx.type === "map"
    ? `course:${ctx.courseId}`
    : "general";

  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let data: ContextStrings = { courseTitle: "" };

  if (ctx.type === "lesson") {
    const lesson = await prisma.lesson.findUnique({
      where: { id: ctx.lessonId },
      select: { title: true, chapter: { select: { course: { select: { title: true, topic: true } } } } },
    });
    data = {
      courseTitle: lesson?.chapter.course.title ?? "",
      courseTopic: lesson?.chapter.course.topic,
      lessonTitle: lesson?.title,
    };
  } else if (ctx.type === "map") {
    const course = await prisma.course.findUnique({
      where: { id: ctx.courseId },
      select: { title: true, topic: true },
    });
    data = { courseTitle: course?.title ?? "", courseTopic: course?.topic };
  }

  contextCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function buildSystemPrompt(userName: string, ctx: CompanionContext, strings: ContextStrings): string {
  if (ctx.type === "lesson") {
    return `You are an AI learning assistant for ${userName}. They are currently doing lesson '${strings.lessonTitle}' in course '${strings.courseTitle}'. Answer questions about this lesson in Vietnamese, using examples. Be concise.`;
  }
  if (ctx.type === "map") {
    return `You are an AI learning assistant for ${userName}. They are viewing the learning map for course '${strings.courseTitle}' (topic: ${strings.courseTopic ?? "general"}). Answer questions about this course in Vietnamese, concisely.`;
  }
  return `You are an AI learning assistant for ${userName}. Answer in Vietnamese, concisely.`;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = session.user.id as string;
  const userName = session.user?.name ?? "bạn";

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { messages, context } = parsed.data;

  let provider;
  try {
    provider = await getProviderForUser(userId);
  } catch (err) {
    if (err instanceof NoAiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof InvalidUserKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const strings = await resolveContextStrings(context as CompanionContext);
  const systemPrompt = buildSystemPrompt(userName, context as CompanionContext, strings);

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const streamFn = provider.getLLMStream();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const token of streamFn(allMessages)) {
          controller.enqueue(encoder.encode(`data: ${token}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[companion] LLM stream error:", err);
        controller.enqueue(encoder.encode("data: [ERROR]\n\n"));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
