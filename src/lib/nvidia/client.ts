import OpenAI from 'openai';

export const nvidiaClient = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY || 'nvapi-dummy',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

export const NVIDIA_MODELS = {
  vision: 'meta/llama-3.2-11b-vision-instruct',
  text:   'meta/llama-3.1-8b-instruct',
} as const;
