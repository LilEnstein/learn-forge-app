import OpenAI from "openai";
import { Ollama } from "ollama";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "ollama";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

let _openai: OpenAI | null = null;
let _ollama: Ollama | null = null;

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getOllama() {
  if (!_ollama) _ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434" });
  return _ollama;
}

export function getEmbeddingModel(): (text: string) => Promise<number[]> {
  if (AI_PROVIDER === "openai") {
    const openai = getOpenAI();
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return async (text) => {
      const res = await openai.embeddings.create({ model, input: text, dimensions: 768 });
      return res.data[0].embedding;
    };
  }
  const ollama = getOllama();
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return async (text) => {
    const res = await ollama.embed({ model, input: text });
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
  const ollama = getOllama();
  const model = process.env.OLLAMA_MODEL ?? "llama3.1";
  return async (messages) => {
    const res = await ollama.chat({ model, messages, stream: false });
    return res.message.content;
  };
}
