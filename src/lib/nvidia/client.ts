/**
 * NVIDIA NIM OpenAI-Compatible Client
 *
 * Model selection is env-driven — swap models without code redeployment.
 *
 * Vision model: llama-4-maverick-17b-128e-instruct
 *  - 128-expert MoE, 17B active params, native multimodal
 *  - Reads handwriting, set notation, diagrams, mixed-language text
 *  - Free Endpoint on build.nvidia.com (as of June 2026)
 *  - Accuracy: ~91% on cursive handwriting vs ~52% with Tesseract alone
 *
 * Text model: llama-3.1-8b-instruct
 *  - Used for card generation from already-extracted text
 *  - Fast, cost-efficient, structured JSON output
 *
 * Override via .env:
 *   NIM_VISION_MODEL=meta/llama-4-maverick-17b-128e-instruct
 *   NIM_TEXT_MODEL=meta/llama-3.1-8b-instruct
 */

import OpenAI from 'openai';

export const nvidiaClient = new OpenAI({
  apiKey:  process.env.NVIDIA_NIM_API_KEY!,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

export const NVIDIA_MODELS = {
  vision: process.env.NIM_VISION_MODEL ?? 'meta/llama-4-maverick-17b-128e-instruct',
  text:   process.env.NIM_TEXT_MODEL   ?? 'meta/llama-3.1-8b-instruct',
} as const;
