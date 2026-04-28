import { YoutubeTranscript } from "youtube-transcript";

export async function parseYoutube(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error(`Could not extract video ID from: ${url}`);

  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  return transcript.map((t) => t.text).join(" ");
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
