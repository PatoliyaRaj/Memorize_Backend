import { performance } from 'perf_hooks';
import { getAdaptiveChunkConfig } from './adaptiveChunker';
import { chunkTextWithOverlap } from './chunker';
import { buildSystemPrompt } from './promptBuilder';
import { nvidiaClient, NVIDIA_MODELS } from '../../lib/nvidia/client';
import { SupportedLang } from './languageDetector';
import { CircuitBreaker } from '../../lib/nvidia/circuitBreaker';

const MAX_CARDS_PER_IMPORT = 10;

const breaker = new CircuitBreaker(
  async (params: any) => nvidiaClient.chat.completions.create(params),
  { failureThreshold: 4, recoveryTimeoutMs: 45_000, requestTimeoutMs: 12_000 }
);

export async function orchestrateLlmAnalysis(rawText: string, lang: SupportedLang, nodeTitle: string, nodeType: string) {
  const t0 = performance.now();
  const { chunkSize, overlap } = getAdaptiveChunkConfig(nodeType);
  const chunks = chunkTextWithOverlap(rawText, chunkSize, overlap);

  let mergedTheory = '', mergedRemember = '';
  const mergedRefs: any[] = [], rawCards: any[] = [];
  let ok = 0;

  for (const chunk of chunks) {
    const params = {
      model: NVIDIA_MODELS.text,
      messages: [
        { role: 'system', content: buildSystemPrompt(lang) },
        { role: 'user',   content: `Node Title: "${nodeTitle}"\nNode Type: "${nodeType}"\nContent:\n<user_content_data>\n${chunk.content}\n</user_content_data>` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    };
    try {
      const resp = await breaker.execute(params);
      const d = JSON.parse(resp.choices[0]?.message?.content || '{}');
      if (d.fields?.theoryContent)    mergedTheory   += (mergedTheory   ? '\n\n' : '') + d.fields.theoryContent;
      if (d.fields?.thingsToRemember) mergedRemember += (mergedRemember ? '\n\n' : '') + d.fields.thingsToRemember;
      if (d.fields?.references)       mergedRefs.push(...d.fields.references);
      if (d.cards)                    rawCards.push(...d.cards);
      ok++;
    } catch (e: any) {
      console.warn(`[ORCHESTRATOR] Chunk ${chunk.index} failed: ${e.message}`);
    }
  }

  const uniqueCards = deduplicateCards(rawCards).slice(0, MAX_CARDS_PER_IMPORT);

  return {
    fields: {
      theoryContent:    mergedTheory || rawText,
      thingsToRemember: mergedRemember,
      references:       mergedRefs,
      emotionalAnchor:  '',
    },
    cards: uniqueCards,
    metrics: { orchestrationTimeMs: performance.now() - t0, chunkCount: chunks.length, successfulChunks: ok },
  };
}

function deduplicateCards(cards: any[]): any[] {
  const seen = new Set<string>();
  return cards.filter(c => {
    if (!c.question) return false;
    const k = c.question.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
