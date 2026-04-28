export async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")) as unknown as (b: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return data.text;
}
