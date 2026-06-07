import { nvidiaClient, NVIDIA_MODELS } from './client';

export async function extractTextFromImageNvidia(
  base64Image: string,
  mimeType: 'image/jpeg' | 'image/png'
): Promise<{ text: string; confidence: number }> {
  const response = await nvidiaClient.chat.completions.create({
    model: NVIDIA_MODELS.vision,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        {
          type: 'text',
          text: `Extract all text from this image exactly as written.\nPreserve line breaks, bullet points, and headings.\nReturn ONLY the extracted text — no commentary.`,
        },
      ],
    }],
    max_tokens: 2048,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content ?? '';
  const confidence = text.length > 50 ? 0.92 : 0.60;
  return { text, confidence };
}
