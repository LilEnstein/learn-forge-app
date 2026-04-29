import OpenAI from "openai";
import { Ollama } from "ollama";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withRetry, withModelFallback } from "./retry";

function getGeminiModelChain(): string[] {
  const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS ?? "gemini-flash-latest,gemini-2.0-flash")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

const AI_PROVIDER = process.env.AI_PROVIDER ?? "gemini";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || AI_PROVIDER;

const LLM_ONLY_PROVIDERS = new Set(["groq", "cerebras"]);

export function validateProviderConfig(): void {
  if (AI_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_BASE_URL) {
    throw new Error(
      "[AI] AI_PROVIDER=openai-compat requires OPENAI_COMPAT_BASE_URL.\n" +
        "Examples: http://localhost:1234/v1 (LM Studio), http://localhost:8080/v1 (llama.cpp), " +
        "http://localhost:1337/v1 (Jan.ai), http://localhost:8000/v1 (vLLM)"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(AI_PROVIDER) && !process.env.EMBEDDING_PROVIDER) {
    throw new Error(
      `[AI] AI_PROVIDER=${AI_PROVIDER} does not support embeddings.\n` +
        "Set EMBEDDING_PROVIDER to one of: openai, gemini, ollama, openai-compat"
    );
  }
  if (LLM_ONLY_PROVIDERS.has(EMBEDDING_PROVIDER)) {
    throw new Error(
      `[AI] EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER} cannot produce embeddings.\n` +
        "Valid values: openai, gemini, ollama, openai-compat"
    );
  }
  if (EMBEDDING_PROVIDER === "openai-compat" && !process.env.OPENAI_COMPAT_EMBEDDING_MODEL) {
    throw new Error(
      "[AI] EMBEDDING_PROVIDER=openai-compat requires OPENAI_COMPAT_EMBEDDING_MODEL to be set."
    );
  }
}

validateProviderConfig();

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

let _openai: OpenAI | null = null;
let _groq: OpenAI | null = null;
let _cerebras: OpenAI | null = null;
let _openaiCompat: OpenAI | null = null;
let _ollama: Ollama | null = null;
let _gemini: GoogleGenerativeAI | null = null;

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getGroq() {
  if (!_groq)
    _groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
  return _groq;
}

function getCerebras() {
  if (!_cerebras)
    _cerebras = new OpenAI({
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  return _cerebras;
}

function getOpenAICompat() {
  if (!_openaiCompat)
    _openaiCompat = new OpenAI({
      baseURL: process.env.OPENAI_COMPAT_BASE_URL ?? "http://localhost:8000/v1",
      apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "not-needed",
    });
  return _openaiCompat;
}

function getOllama() {
  if (!_ollama) _ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" });
  return _ollama;
}

function getGemini() {
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return _gemini;
}

export function getEmbeddingModel(): (text: string) => Promise<number[]> {
  const provider = EMBEDDING_PROVIDER;

  if (provider === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return async (text) => {
      const res = await openai.embeddings.create({ model, input: text, dimensions: 1536 });
      return res.data[0].embedding;
    };
  }

  if (provider === "gemini") {
    const genAI = getGemini();
    // gemini-embedding-001 default is 3072-d; we request 1536 to match pgvector(1536).
    // Google recommends L2-normalizing when outputDimensionality < 3072.
    const modelName = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
    const model = genAI.getGenerativeModel({ model: modelName });
    return async (text) => {
      // outputDimensionality is supported by the REST API but missing from the SDK
      // 0.24.1 type — pass it through via a cast.
      const res = await withRetry(
        () =>
          model.embedContent({
            content: { role: "user", parts: [{ text }] },
            outputDimensionality: 1536,
          } as Parameters<typeof model.embedContent>[0]),
        { label: "gemini-embed" }
      );
      const v = res.embedding.values;
      let sumSq = 0;
      for (const x of v) sumSq += x * x;
      const norm = Math.sqrt(sumSq);
      return norm > 0 ? v.map((x) => x / norm) : v;
    };
  }

  if (provider === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_EMBEDDING_MODEL!;
    return async (text) => {
      const res = await compat.embeddings.create({ model, input: text });
      return res.data[0].embedding;
    };
  }

  // ollama (default)
  const ollama = getOllama();
  const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return async (text) => {
    const res = await ollama.embed({ model: ollamaModel, input: text });
    return res.embeddings[0];
  };
}

export function getLLM(): (messages: ChatMessage[]) => Promise<string> {
  if (AI_PROVIDER === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    return async (messages) => {
      const res = await openai.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "gemini") {
    const genAI = getGemini();
    return async (messages) => {
      // Gemini separates system instruction from chat history
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMsgs = messages.filter((m) => m.role !== "system");
      const history = chatMsgs.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const last = chatMsgs[chatMsgs.length - 1];

      const result = await withModelFallback(
        getGeminiModelChain(),
        (modelName) => {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemMsg?.content,
          });
          const chat = model.startChat({ history });
          return chat.sendMessage(last.content);
        },
        { label: "gemini-llm", retries: 2, baseDelayMs: 800 }
      );
      return result.response.text();
    };
  }

  if (AI_PROVIDER === "groq") {
    const groq = getGroq();
    const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    return async (messages) => {
      const res = await groq.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "cerebras") {
    const cerebras = getCerebras();
    const model = process.env.CEREBRAS_MODEL ?? "llama3.1-8b";
    return async (messages) => {
      const res = await cerebras.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  if (AI_PROVIDER === "openai-compat") {
    const compat = getOpenAICompat();
    const model = process.env.OPENAI_COMPAT_MODEL ?? "";
    return async (messages) => {
      const res = await compat.chat.completions.create({ model, messages });
      return res.choices[0].message.content ?? "";
    };
  }

  // Ollama
  const ollama = getOllama();
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1";
  return async (messages) => {
    const res = await ollama.chat({ model: ollamaModel, messages, stream: false });
    return res.message.content;
  };
}
