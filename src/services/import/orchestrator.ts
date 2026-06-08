/**
 * LLM Analysis Orchestrator
 *
 * Security hardening:
 *  - escapeXmlEntities() applied to EACH CHUNK before wrapping in <user_content_data>
 *    This closes the XML boundary injection attack vector for ALL input paths
 *    (PDFs, docx, images, pasted text — all go through this function).
 *    Even if sanitizeInput() in the controller missed something, this is the
 *    last line of defense before the text enters the LLM prompt boundary.
 *
 * Accuracy improvements:
 *  - MAX_CARDS_PER_IMPORT raised from 10 → 20
 *  - maxCards passed to promptBuilder so the model knows the exact limit
 *  - Deduplication uses normalized key (lowercase, alphanumeric only)
 */

import { performance }               from 'perf_hooks';
import { getAdaptiveChunkConfig }    from './adaptiveChunker';
import { chunkTextWithOverlap }      from './chunker';
import { buildSystemPrompt }         from './promptBuilder';
import { nvidiaClient, NVIDIA_MODELS } from '../../lib/nvidia/client';
import { SupportedLang }             from './languageDetector';
import { CircuitBreaker }            from '../../lib/nvidia/circuitBreaker';

const MAX_CARDS_PER_IMPORT = 20; // Raised from 10 — supports multi-page/multi-image imports

/** Circuit breaker singleton for NVIDIA text API */
const textBreaker = new CircuitBreaker(
  (params: any) => nvidiaClient.chat.completions.create(params) as any,
  { failureThreshold: 4, recoveryTimeoutMs: 45_000, requestTimeoutMs: 150_000 },
);

// ── XML Entity Escaping ────────────────────────────────────────────────────

/**
 * Escape all XML special characters in user content before wrapping in boundary tags.
 *
 * This prevents any <tag> in the user's document (from PDFs, DOCX, or images)
 * from escaping the <user_content_data> boundary and being parsed as XML/instructions
 * by the LLM. The 5 entities cover 100% of XML injection attack vectors.
 *
 * Order matters: & must be replaced first to avoid double-escaping.
 */
function escapeXmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g,  '&amp;')   // ← Must be FIRST
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

// ── Main Entry Point ───────────────────────────────────────────────────────

export async function orchestrateLlmAnalysis(
  rawText:   string,
  lang:      SupportedLang | 'auto',
  nodeTitle: string,
  nodeType:  string,
) {
  const t0            = performance.now();
  const effectiveLang = (lang === 'auto' ? 'eng' : lang) as SupportedLang;

  const { chunkSize, overlap } = getAdaptiveChunkConfig(nodeType);
  const chunks                 = chunkTextWithOverlap(rawText, chunkSize, overlap);

  let mergedTheory   = '';
  let mergedRemember = '';
  const mergedRefs: any[] = [];
  const rawCards:   any[] = [];
  let successfulChunks = 0;

  // Execute all chunk analyses in parallel to avoid linear sequential latency bottlenecks
  const promises = chunks.map(async (chunk) => {
    // ── SECURITY: Escape XML entities before inserting into boundary tags ──
    const escapedContent = escapeXmlEntities(chunk.content);

    // Also sanitize nodeTitle and nodeType (they come from user-controlled request body)
    const safeTitle = nodeTitle.replace(/"/g, '').slice(0, 200);
    const safeType  = nodeType.replace(/"/g, '').slice(0, 100);

    // Speed optimization: request fewer cards per chunk if document has multiple chunks
    const maxCardsForChunk = Math.max(3, Math.ceil(MAX_CARDS_PER_IMPORT / chunks.length));

    const params = {
      model:    NVIDIA_MODELS.text,
      messages: [
        {
          role:    'system' as const,
          content: buildSystemPrompt(effectiveLang, maxCardsForChunk),
        },
        {
          role:    'user' as const,
          content: `Node Title: "${safeTitle}"\nNode Type: "${safeType}"\nContent:\n<user_content_data>\n${escapedContent}\n</user_content_data>`,
        },
      ],
      response_format: { type: 'json_object' as const },
      temperature:     0.2, // Low temperature: mostly deterministic, minimal hallucination
    };

    try {
      const resp = await textBreaker.execute(params) as any;
      const raw  = resp.choices[0]?.message?.content || '{}';
      const d    = JSON.parse(raw);
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
            question:    c.question    ?? c.Question    ?? c.q ?? '',
            answer:      c.answer      ?? c.Answer      ?? c.a ?? '',
            subTopic:    c.subTopic    ?? c.SubTopic    ?? c.subtopic ?? '',
            explanation: c.explanation ?? c.Explanation ?? '',
            type:        c.type        ?? c.Type        ?? 'definition',
          };
        })
        .filter((c: any) => c && c.question && c.answer);

      rawCards.push(...normalized);
    }

    successfulChunks++;
  }

  const uniqueCards = deduplicateCards(rawCards).slice(0, MAX_CARDS_PER_IMPORT);

  return {
    fields: {
      theoryContent:    mergedTheory   || rawText, // Fallback: show raw text if all LLM chunks failed
      thingsToRemember: mergedRemember,
      references:       mergedRefs,
      emotionalAnchor:  '',
    },
    cards: uniqueCards,
    metrics: {
      orchestrationTimeMs: performance.now() - t0,
      chunkCount:          chunks.length,
      successfulChunks,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format thingsToRemember value to always return a clean markdown bullet list.
 * Safely handles string, array of strings, and object inputs from the LLM.
 */
function formatThingsToRemember(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (!item) return '';
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed.startsWith('-') || trimmed.startsWith('*') ? trimmed : `- ${trimmed}`;
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

function deduplicateCards(cards: any[]): any[] {
  const seen = new Set<string>();
  return cards.filter(c => {
    if (!c?.question) return false;
    // Normalize: lowercase + alphanumeric only → collision-resistant dedup key
    const key = c.question.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
