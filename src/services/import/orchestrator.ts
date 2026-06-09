/**
 * LLM Analysis Orchestrator v2.0
 *
 * Changes from v1:
 *  1. Section-header injection: Extracts ## headings from rawText and injects
 *     them as a "REQUIRED SECTIONS" list into every user prompt. This forces
 *     the model to distribute cards across ALL source sections, not just
 *     whichever section appears last in the chunk.
 *
 *  2. Fuzzy cross-chunk deduplication: Replaces exact-string dedup with
 *     Levenshtein similarity at 0.75 threshold. Catches paraphrased duplicates
 *     that exact matching misses (e.g., "What is the LEGB Rule?" vs
 *     "What order does Python follow to resolve variables?").
 *
 *  Security:
 *  - escapeXmlEntities() still applied to every chunk before boundary tags
 *  - nodeTitle/nodeType sanitized before injection into user prompt
 *
 *  Performance & Robustness:
 *  - Retains parallel execution (Promise.all) for low latency
 *  - Retains robust JSON key mapping / normalization
 *  - Retains formatThingsToRemember helper to avoid raw object string DB writes
 *  - Dynamically merges and extracts the emotionalAnchor value
 */

import { performance } from 'perf_hooks';
import { getAdaptiveChunkConfig } from './adaptiveChunker';
import { chunkTextWithOverlap } from './chunker';
import { buildSystemPrompt } from './promptBuilder';
import { nvidiaClient, NVIDIA_MODELS } from '../../lib/nvidia/client';
import { SupportedLang } from './languageDetector';
import { CircuitBreaker } from '../../lib/nvidia/circuitBreaker';

const MAX_CARDS_PER_IMPORT = 20;

/** Circuit breaker singleton for NVIDIA text API */
const textBreaker = new CircuitBreaker(
  (params: any) => nvidiaClient.chat.completions.create(params) as any,
  {
    failureThreshold: 4,
    recoveryTimeoutMs: 45_000,
    requestTimeoutMs: 90_000,  // 90s for large documents
  },
);

// ── Security: XML Entity Escaping ─────────────────────────────────────────

/**
 * Escape XML special characters in user content.
 * Prevents tag injection from PDFs/docx/images into the LLM boundary.
 * Order matters: & must be replaced first.
 */
function escapeXmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Section Header Extraction ──────────────────────────────────────────────

/**
 * Extract all Markdown section headers (## and ###) from the raw text.
 * These become the "REQUIRED SECTIONS" list injected into the user prompt,
 * forcing the model to distribute cards across ALL sections.
 */
function extractSectionHeaders(text: string): string[] {
  return text
    .split('\n')
    .filter(line => /^#{1,3}\s/.test(line.trim()))
    .map(line => line.replace(/^#{1,3}\s+/, '').trim())
    .filter(h => h.length > 2 && h.length < 100)  // Skip empty or overly long lines
    .filter((h, i, arr) => arr.indexOf(h) === i);  // Remove exact duplicate headers
}

/**
 * Build the "REQUIRED SECTIONS" string to inject into the user message.
 * Returns empty string if no headers found (e.g., plain-text paste).
 */
function buildRequiredSectionsBlock(headers: string[]): string {
  if (headers.length === 0) return '';
  const list = headers.map((h, i) => `${i + 1}. ${h}`).join('\n');
  return `\nREQUIRED COVERAGE — Generate at least 1 card from EACH of these sections:\n${list}\n`;
}

// ── Fuzzy Deduplication ───────────────────────────────────────────────────

/**
 * Normalized Levenshtein similarity between two strings.
 * Returns 0.0 (completely different) to 1.0 (identical).
 *
 * Used for cross-chunk deduplication.
 */
function levenshteinSimilarity(raw_a: string, raw_b: string): number {
  // SECURED: Uses Unicode property escapes to preserve non-Latin scripts (Devanagari, Gujarati, etc.)
  const a = raw_a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const b = raw_b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

  if (!a.length || !b.length) return 0.0;
  if (a === b) return 1.0;

  // O(1) early exit: if length ratio < threshold, similarity cannot reach 0.75
  const longer = Math.max(a.length, b.length);
  const shorter = Math.min(a.length, b.length);
  if (shorter / longer < 0.60) return 0.0;

  // Wagner-Fischer DP matrix
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, prev.length, ...curr);
  }

  const distance = prev[b.length];
  return 1 - distance / longer;
}

/**
 * Fuzzy deduplication across ALL cards from ALL chunks.
 * Above threshold = duplicate. Retains the version with higher Bloom's level.
 */
function fuzzyDeduplicateCards(cards: any[], threshold = 0.75): any[] {
  const unique: any[] = [];

  for (const incoming of cards) {
    if (!incoming?.question?.trim()) continue;  // Skip empty cards

    let isDuplicate = false;

    for (const existing of unique) {
      const similarity = levenshteinSimilarity(incoming.question, existing.question);
      if (similarity >= threshold) {
        // Keep the higher Bloom's level version
        // Heuristic: "why/how" questions are higher Bloom's than "what/name" questions
        const isHigherBloom = /^(why|how|what causes|what would|explain|calculate)/i.test(incoming.question)
          && !/^(why|how|what causes|what would|explain|calculate)/i.test(existing.question);

        if (isHigherBloom) {
          // Replace existing with the incoming higher-quality version
          const idx = unique.indexOf(existing);
          unique.splice(idx, 1, incoming);
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) unique.push(incoming);
  }

  return unique;
}

// ── Main Entry Point ──────────────────────────────────────────────────────

export async function orchestrateLlmAnalysis(
  rawText: string,
  lang: SupportedLang | 'auto',
  nodeTitle: string,
  nodeType: string,
) {
  const t0 = performance.now();
  const effectiveLang = (lang === 'auto' ? 'eng' : lang) as SupportedLang;

  const { chunkSize, overlap } = getAdaptiveChunkConfig(nodeType);
  const chunks = chunkTextWithOverlap(rawText, chunkSize, overlap);

  // Extract section headers from the FULL raw text (before chunking)
  const sectionHeaders = extractSectionHeaders(rawText);
  const requiredSections = buildRequiredSectionsBlock(sectionHeaders);

  let mergedTheory = '';
  let mergedRemember = '';
  let emotionalAnchor = '';
  const mergedRefs: any[] = [];
  const rawCards: any[] = [];
  let successfulChunks = 0;

  // Execute all chunk analyses in parallel to avoid linear sequential latency bottlenecks
  const promises = chunks.map(async (chunk) => {
    // SECURITY: escape XML entities before wrapping in boundary tags
    const escapedContent = escapeXmlEntities(chunk.content);

    // Sanitize user-provided metadata (prevents prompt injection via nodeTitle)
    const safeTitle = nodeTitle.replace(/[<>"']/g, '').slice(0, 200);
    const safeType = nodeType.replace(/[<>"']/g, '').slice(0, 100);

    // Request fewer cards per chunk if document has multiple chunks
    const maxCardsForChunk = Math.max(3, Math.ceil(MAX_CARDS_PER_IMPORT / chunks.length));

    const params = {
      model: NVIDIA_MODELS.text,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(effectiveLang, maxCardsForChunk),
        },
        {
          role: 'user',
          content: `Node Title: "${safeTitle}"\nNode Type: "${safeType}"${requiredSections}\nContent:\n<user_content_data>\n${escapedContent}\n</user_content_data>`,
        },
      ],
      response_format: { type: 'json_object' as const },
      temperature: 0.1,  // Low = mostly deterministic, minimal hallucination
      top_p: 0.7,         // High precision nucleus selection
      max_tokens: 6065,        // Plentiful generation headroom for 20 deep cards
      frequency_penalty: 0.0,   // Allows natural repetition of core technical terms
      presence_penalty: 0.0,
    };

    try {
      const resp = await textBreaker.execute(params) as any;
      const raw = resp.choices[0]?.message?.content || '{}';
      const d = JSON.parse(raw);
      return { success: true, chunk, data: d };
    } catch (e: any) {
      console.warn(`[ORCHESTRATOR] Chunk ${chunk.index} failed: ${e.message}`);
      return { success: false, chunk, error: e };
    }
  });

  const results = await Promise.all(promises);

  for (const res of results) {
    if (!res.success) continue;
    const d = res.data;

    if (d.fields?.theoryContent) {
      mergedTheory += (mergedTheory ? '\n\n' : '') + d.fields.theoryContent;
    }
    if (d.fields?.thingsToRemember) {
      const formattedReminders = formatThingsToRemember(d.fields.thingsToRemember);
      if (formattedReminders) {
        mergedRemember += (mergedRemember ? '\n\n' : '') + formattedReminders;
      }
    }
    if (d.fields?.emotionalAnchor && !emotionalAnchor) {
      emotionalAnchor = d.fields.emotionalAnchor; // Capture anchor from first successful chunk
    }
    if (Array.isArray(d.fields?.references)) {
      mergedRefs.push(...d.fields.references);
    }

    // Robust cards extraction (root cards or fields.cards, normalized keys)
    let cardsList = d.cards;
    if (!Array.isArray(cardsList) && Array.isArray(d.fields?.cards)) {
      cardsList = d.fields.cards;
    }

    if (Array.isArray(cardsList)) {
      const normalized = cardsList
        .map((c: any) => {
          if (!c || typeof c !== 'object') return null;
          return {
            question: c.question ?? c.Question ?? c.q ?? '',
            answer: c.answer ?? c.Answer ?? c.a ?? '',
            subTopic: c.subTopic ?? c.SubTopic ?? c.subtopic ?? '',
            explanation: c.explanation ?? c.Explanation ?? '',
            type: c.type ?? c.Type ?? 'definition',
          };
        })
        .filter((c: any) => c && c.question && c.answer);

      rawCards.push(...normalized);
    }

    successfulChunks++;
  }

  // FUZZY DEDUPLICATION across all chunks
  const uniqueCards = fuzzyDeduplicateCards(rawCards, 0.75).slice(0, MAX_CARDS_PER_IMPORT);

  return {
    fields: {
      theoryContent: mergedTheory || rawText,  // Fallback: raw text if all LLM chunks failed
      thingsToRemember: mergedRemember,
      references: mergedRefs,
      emotionalAnchor: emotionalAnchor,
    },
    cards: uniqueCards,
    metrics: {
      orchestrationTimeMs: performance.now() - t0,
      chunkCount: chunks.length,
      successfulChunks,
      sectionHeadersFound: sectionHeaders.length,
      cardsBeforeDedup: rawCards.length,
      cardsAfterDedup: uniqueCards.length,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format thingsToRemember value to always return a clean markdown bullet list.
 * Safely handles string, array of strings, and object inputs from the LLM.
 * Strictly maps bullet characters to hyphen (-) per prompt rules.
 */
function formatThingsToRemember(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        const clean = trimmed.replace(/^[*~•–—>]\s*/, '').trim();
        return clean.startsWith('-') ? clean : `- ${clean}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (!item) return '';
        if (typeof item === 'string') {
          const trimmed = item.trim();
          const clean = trimmed.replace(/^[*~•–—>]\s*/, '').trim();
          return clean.startsWith('-') ? clean : `- ${clean}`;
        }
        return `- ${JSON.stringify(item)}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => {
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `- **${k}**: ${valStr}`;
      })
      .join('\n');
  }
  return String(value);
}
