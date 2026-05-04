import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { retrieveChunks } from "@/lib/ai/rag/retrieve";
import { getProviderForUser } from "@/lib/ai/user-provider";
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors";
import { MASCOT_CONFIG, AvatarKey } from "@/lib/mascots/config";

const QuerySchema = z.object({ courseId: z.string().min(1) });

const personalityInstruction: Record<string, string> = {
  witty:     "Be concise and add a clever observation or light pun. Max 1 sentence.",
  scholarly: "Quote or reference the concept formally. Add depth. Max 2 sentences.",
  chill:     "Keep it relaxed and encouraging. Add a relevant emoji at the end. Max 1 sentence.",
  playful:   "Make it fun and energetic. Use an exclamation. Max 1 sentence.",
  bold:      "State it as a powerful fact. Direct and confident. Max 1 sentence.",
  warm:      "Make it feel supportive and friendly. Max 1 sentence.",
};

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const userId = session.user!.id!;

  const params = QuerySchema.safeParse({
    courseId: req.nextUrl.searchParams.get("courseId"),
  });
  if (!params.success) {
    return NextResponse.json({ error: params.error.flatten() }, { status: 400 });
  }
  const { courseId } = params.data;

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

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarKey: true },
  });

  const avatarKey = user.avatarKey as AvatarKey;
  const personality = MASCOT_CONFIG[avatarKey]?.personality ?? "warm";
  const instruction = personalityInstruction[personality] ?? personalityInstruction.warm;

  const embedFn = provider.getEmbeddingModel();
  const chunks = await retrieveChunks("interesting fact", userId, { courseId, topK: 3 }, embedFn);
  if (chunks.length === 0) {
    return NextResponse.json({ tip: null });
  }

  const context = chunks.map((c) => c.content).join("\n\n");

  const llm = provider.getLLM();
  const tip = await llm([
    {
      role: "system",
      content: `You are a helpful learning assistant. ${instruction}`,
    },
    {
      role: "user",
      content: `Based on the following course content, share one interesting fact or insight:\n\n${context}`,
    },
  ]);

  return NextResponse.json(
    { tip: tip.trim() },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
