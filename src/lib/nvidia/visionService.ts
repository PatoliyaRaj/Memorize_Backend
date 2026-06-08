/**
 * NVIDIA NIM Vision Service
 *
 * Sends a base64-encoded image to llama-4-maverick for high-accuracy OCR.
 *
 * temperature: 0.1 — nearly deterministic transcription (minimal creative fabrication)
 * max_tokens: 2048 — sufficient for dense handwritten pages
 *
 * Model reference uses NVIDIA_MODELS.vision (env-driven) so model upgrades
 * require only an .env change, not a code deployment.
 */

import { nvidiaClient, NVIDIA_MODELS } from './client';

export async function extractTextFromImageNvidia(
  base64Image: string,
  mimeType:    'image/jpeg' | 'image/png' | 'image/webp',
): Promise<{ text: string; confidence: number }> {
  const isNemotronParse = NVIDIA_MODELS.vision.includes('nemotron-parse');

  // DYNAMIC PROMPT ROUTING:
  // If using nemotron-parse, we MUST supply its native 4-token prompt.
  // Otherwise, the model's decoder hangs, causing a 180s timeout.
  const promptText = isNemotronParse
    ? '</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>'
    : [
        'Extract ALL text from this image exactly as written.',
        'Preserve line breaks, bullet points, headings, and mathematical notation.',
        'If the image contains handwriting, read it carefully, including cursive.',
        'Return ONLY the extracted text — no commentary, no preamble.',
      ].join('\n');

  const response = await nvidiaClient.chat.completions.create({
    model:       NVIDIA_MODELS.vision,
    max_tokens:  2_048,
    temperature: 0.1, // Near-deterministic extraction
    messages: [{
      role:    'user',
      content: [
        {
          type:      'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` },
        },
        {
          type: 'text',
          text: promptText,
        },
      ],
    }],
  });

  const text = response.choices[0]?.message?.content ?? '';
  // Confidence heuristic: calibrated from test data (>50 chars = likely successful read)
  const confidence = text.length > 50 ? 0.92 : 0.60;
  return { text, confidence };
}

