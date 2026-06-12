/**
 * LLM Analysis Orchestrator v3.0
 *
 * Changes from v2.0:
 *  1. 3-Layer audience/subject detection integrated:
 *     - Layer 1: DB user profile (getUserAudienceFromDB)
 *     - Layer 2: Content signal detection (detectFromContent)
 *     - Layer 3: GENERAL fallback
 *
 *  2. Dynamic card count: calculateMaxCards() replaces hardcoded MAX_CARDS_PER_IMPORT.
 *     Card count now adapts to concept density, subject, and audience.
 *
 *  3. Subject-aware prompt: buildSystemPrompt() now receives both audience AND subject.
 *     This activates subject-specific length matrices and card rules.
 *
 *  4. New subjects supported: BUSINESS, FINANCE, STOCK_MARKET.
 *
 *  5. New audience types: BUSINESS_STUDENT, EXECUTIVE, INVESTOR, ENTREPRENEUR, etc.
 *
 *  6. validateAndCleanOutput() runs on every chunk result to catch format errors
 *     before they reach the save layer.
 *
 *  Security (Synchronized & Hardened):
 *  - escapeXmlEntities() on all user content
 *  - FIXED: Content wrapped in <user_content_data> tags to match prompt rules.
 *  - nodeTitle/nodeType sanitized before injection
 *  - Circuit breaker: 4 failures → 45s cooldown, 90s per request
 *
 *  Performance:
 *  - Parallel chunk execution (Promise.all)
 *  - Levenshtein fuzzy dedup at 0.75 threshold (Unicode-safe)
 *  - Section-header injection forces coverage across all source sections
 */

import { performance } from 'perf_hooks'
import { getAdaptiveChunkConfig } from './adaptiveChunker'
import { chunkTextWithOverlap } from './chunker'
import {
  buildSystemPrompt,
  calculateMaxCards,
  validateAndCleanOutput,
  deduplicateCards,
  type AudienceType,
  type Subject,
  type GeneratedCard,
} from './promptBuilder'
import { resolveAudienceAndSubject } from './audienceDetector'
import { nvidiaClient, NVIDIA_MODELS } from '../../lib/nvidia/client'
import { SupportedLang } from './languageDetector'
import { CircuitBreaker } from '../../lib/nvidia/circuitBreaker'

// ── Constants ─────────────────────────────────────────────────────────────

const ABSOLUTE_MAX_CARDS = 20   // Hard cap — never exceed regardless of content
const ABSOLUTE_MIN_CARDS = 5   // Always generate at least this many
const MAX_TOKENS_PER_CHUNK = 4096 // Standard Context Ceiling (Fix #2)

// ── Circuit Breaker ───────────────────────────────────────────────────────

const textBreaker = new CircuitBreaker(
  (params: any) => nvidiaClient.chat.completions.create(params) as any,
  {
    failureThreshold:   4,
    recoveryTimeoutMs:  45_000,
    requestTimeoutMs:   90_000,
  },
)

// ── Security: XML Entity Escaping ─────────────────────────────────────────

function escapeXmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;') // Must be FIRST
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Section Header Extraction ──────────────────────────────────────────────

function extractSectionHeaders(text: string): string[] {
  return text
    .split('\n')
    .filter(line => /^#{1,3}\s/.test(line.trim()))
    .map(line => line.replace(/^#{1,3}\s+/, '').trim())
    .filter(h => h.length > 2 && h.length < 100)
    .filter((h, i, arr) => arr.indexOf(h) === i)
}

function buildRequiredSectionsBlock(headers: string[]): string {
  if (headers.length === 0) return ''
  const list = headers.map((h, i) => `${i + 1}. ${h}`).join('\n')
  return `\nREQUIRED COVERAGE — Generate at least 1 card from EACH of these sections:\n${list}\n`
}

// ── Fuzzy Deduplication (cross-chunk) ────────────────────────────────────

function levenshteinSimilarity(raw_a: string, raw_b: string): number {
  const a = raw_a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const b = raw_b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

  if (!a.length || !b.length) return 0.0
  if (a === b) return 1.0

  const longer  = Math.max(a.length, b.length)
  const shorter = Math.min(a.length, b.length)
  if (shorter / longer < 0.60) return 0.0

  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  const curr = new Array(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }

  return 1 - prev[b.length] / longer
}

function fuzzyDeduplicateAcrossChunks(cards: any[], threshold = 0.75): any[] {
  const unique: any[] = []

  for (const incoming of cards) {
    if (!incoming?.question?.trim()) continue

    let isDuplicate = false

    for (const existing of unique) {
      const sim = levenshteinSimilarity(incoming.question, existing.question)
      if (sim >= threshold) {
        const isHigherBloom = /^(why|how|what causes|what would|explain|calculate|apply|compare|analyze)/i.test(incoming.question)
          && !/^(why|how|what causes|what would|explain|calculate|apply|compare|analyze)/i.test(existing.question)

        if (isHigherBloom) {
          const idx = unique.indexOf(existing)
          unique.splice(idx, 1, incoming)
        }
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) unique.push(incoming)
  }

  return unique
}

// ── formatThingsToRemember helper ────────────────────────────────────────

function formatThingsToRemember(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(line => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        const clean = trimmed.replace(/^[*~•–—>]\s*/, '').trim()
        return clean.startsWith('-') ? clean : `- ${clean}`
      })
      .filter(Boolean)
      .join('\n')
  }
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (!item) return ''
        if (typeof item === 'string') {
          const trimmed = item.trim()
          const clean   = trimmed.replace(/^[*~•–—>]\s*/, '').trim()
          return clean.startsWith('-') ? clean : `- ${clean}`
        }
        return `- ${JSON.stringify(item)}`
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `- **${k}**: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('\n')
  }
  return String(value)
}

// ── Card Normalizer & Sanitizer ──────────────────────────────────────────

const VALID_QUESTION_TYPES  = ['free_recall', 'multiple_choice', 'cloze', 'ordering', 'matching']
const VALID_COGNITIVE_TYPES = ['definition', 'property', 'cause', 'comparison', 'process', 'application', 'formula', 'timeline', 'procedure']

function sanitizeOrderingAnswer(answer: string): string {
  const steps = answer.split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 200)
    .map(s => s.replace(/^[\d\.]+\s*/, '').replace(/::/g, ''))
    .slice(0, 10)
  if (steps.length < 3) return ''
  return steps.join('\n')
}

function sanitizeMatchingAnswer(answer: string): string {
  const pairs = answer.split('\n')
    .map(line => {
      const parts = line.split('::').map(s => s.trim())
      if (parts.length !== 2) return null
      return `${parts[0].replace(/[<>]/g, '').slice(0, 100)}::${parts[1].replace(/[<>]/g, '').slice(0, 200)}`
    })
    .filter((p): p is string => p !== null)
    .slice(0, 8)
  if (pairs.length < 3) return ''
  return pairs.join('\n')
}

function normalizeCards(rawCards: any[]): GeneratedCard[] {
  return rawCards
    .map(c => {
      if (!c || typeof c !== 'object') return null

      // Determine question type
      let questionType: string = c.questionType ?? c.QuestionType ?? 'free_recall'
      if (!VALID_QUESTION_TYPES.includes(questionType)) {
        if (c.question?.includes('___'))  questionType = 'cloze'
        else if (c.explanation?.includes('"options"')) questionType = 'multiple_choice'
        else if (c.answer?.includes('\n') && c.answer.split('\n').length >= 3) questionType = 'ordering'
        else if (c.answer?.includes('::')) questionType = 'matching'
        else questionType = 'free_recall'
      }

      // Sanitize answer by type
      let answer = ''
      switch (questionType) {
        case 'ordering':
          answer = sanitizeOrderingAnswer(c.answer ?? '')
          if (!answer) questionType = 'free_recall'
          break
        case 'matching':
          answer = sanitizeMatchingAnswer(c.answer ?? '')
          if (!answer) questionType = 'free_recall'
          break
        case 'cloze':
          answer = (c.answer ?? '').replace(/[\n\r]/g, ' ').replace(/[<>]/g, '').trim().slice(0, 100)
          break
        default:
          answer = (c.answer ?? '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').slice(0, 500)
      }

      if (!c.question || !answer) return null

      // Sanitize MCQ explanation
      let explanation = c.explanation ?? ''
      if (questionType === 'multiple_choice') {
        try {
          const parsed = JSON.parse(explanation)
          if (!Array.isArray(parsed.options) || parsed.options.length < 2) {
            questionType = 'free_recall'
          } else {
            parsed.options = parsed.options.map((opt: string) => opt.replace(/<[^>]+>/g, '').slice(0, 200))
            explanation = JSON.stringify(parsed)
          }
        } catch {
          questionType = 'free_recall'
        }
      }

      // Determine cognitive type
      let cogType = c.type ?? c.Type ?? 'definition'
      if (!VALID_COGNITIVE_TYPES.includes(cogType)) cogType = 'definition'

      return {
        question:     (c.question ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
        answer,
        subTopic:     c.subTopic ?? c.SubTopic ?? 'General',
        explanation,
        questionType: questionType as GeneratedCard['questionType'],
        type:         cogType,
      } satisfies GeneratedCard
    })
    .filter((c): c is GeneratedCard => c !== null)
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR — v3.0
// ═══════════════════════════════════════════════════════════════

export async function orchestrateLlmAnalysis(
  rawText:   string,
  lang:      SupportedLang | 'auto',
  nodeTitle: string,
  nodeType:  string,
  userId?:   string,
  preResolvedAudience?: AudienceType,
  preResolvedSubject?:  Subject,
) {
  const t0 = performance.now()
  const effectiveLang = (lang === 'auto' ? 'eng' : lang) as SupportedLang

  // ── Step 1: Resolve audience and subject ─────────────────────────────
  let finalAudience: AudienceType = 'GENERAL'
  let finalSubject:  Subject      = 'GENERAL'
  let detectionSource             = 'default'

  if (preResolvedAudience) {
    finalAudience = preResolvedAudience
    finalSubject  = preResolvedSubject ?? 'GENERAL'
    detectionSource = 'caller'
  } else if (userId) {
    const resolution = await resolveAudienceAndSubject(userId, rawText)
    finalAudience = resolution.audience
    finalSubject  = resolution.subject
    detectionSource = resolution.source
  } else {
    const { detectFromContent } = await import('./audienceDetector')
    const result = detectFromContent(rawText)
    finalAudience = result.audience
    finalSubject  = result.subject
    detectionSource = 'content'
  }

  // ── Step 2: Calculate dynamic card count ─────────────────────────────
  const dynamicMaxCards = Math.min(
    ABSOLUTE_MAX_CARDS,
    Math.max(ABSOLUTE_MIN_CARDS, calculateMaxCards(rawText, finalSubject, finalAudience))
  )

  // ── Step 3: Chunk text ────────────────────────────────────────────────
  const { chunkSize, overlap } = getAdaptiveChunkConfig(nodeType)
  const chunks = chunkTextWithOverlap(rawText, chunkSize, overlap)

  // ── Step 4: Extract section headers ──────────────────────────────────
  const sectionHeaders   = extractSectionHeaders(rawText)
  const requiredSections = buildRequiredSectionsBlock(sectionHeaders)

  // ── Step 5: Sanitize metadata ─────────────────────────────────────────
  const safeTitle = nodeTitle.replace(/[<>"']/g, '').slice(0, 200)
  const safeType  = nodeType.replace(/[<>"']/g, '').slice(0, 100)

  // ── Step 6: Parallel chunk processing ────────────────────────────────
  let mergedTheory   = ''
  let mergedRemember = ''
  let emotionalAnchor = ''
  const mergedRefs: any[] = []
  const rawCards: any[]   = []
  let successfulChunks    = 0

  // Track token usage
  let inputTokens = 0;
  let outputTokens = 0;

  const promises = chunks.map(async (chunk) => {
    const escapedContent    = escapeXmlEntities(chunk.content)
    const maxCardsForChunk  = Math.max(3, Math.ceil(dynamicMaxCards / chunks.length))

    const params = {
      model:    NVIDIA_MODELS.text,
      messages: [
        {
          role:    'system' as const,
          content: buildSystemPrompt(effectiveLang, maxCardsForChunk, finalAudience, finalSubject),
        },
        {
          role:    'user' as const,
          // FIXED: Wrapped content in <user_content_data> tags instead of <content> to match prompt rules [10]
          content: `Node Title: "${safeTitle}"\nNode Type: "${safeType}"\nDetected Subject: ${finalSubject}\nDetected Audience: ${finalAudience}${requiredSections}\nContent:\n<user_content_data>\n${escapedContent}\n</user_content_data>`,
        },
      ],
      response_format:  { type: 'json_object' as const },
      temperature:      0.1,
      top_p:            0.7,
      max_tokens:       MAX_TOKENS_PER_CHUNK, // Standard Context Ceiling (Fix #2)
      frequency_penalty: 0.0,
      presence_penalty:  0.0,
    }

    try {
      const resp = await textBreaker.execute(params) as any
      const raw  = resp.choices[0]?.message?.content || '{}'

      // Extract tokens from the completion usage payload
      inputTokens  += resp.usage?.prompt_tokens || 0;
      outputTokens += resp.usage?.completion_tokens || 0;

      const cleaned = validateAndCleanOutput(raw)
      if (!cleaned) {
        // Detailed log parsing warnings (Fix #7)
        console.warn(`[ORCHESTRATOR v3] Chunk ${chunk.index} returned invalid JSON:`, raw.slice(0, 200));
        return { 
          success: false, 
          chunk, 
          error: new Error('LLM returned invalid JSON structure'),
          rawOutput: raw.slice(0, 500) 
        }
      }

      return { success: true, chunk, data: cleaned }
    } catch (e: any) {
      console.warn(`[ORCHESTRATOR v3] Chunk ${chunk.index} failed: ${e.message}`)
      return { success: false, chunk, error: e }
    }
  })

  const results = await Promise.all(promises)

  // ── Step 7: Merge results ────────────────────────────────────────────
  for (const res of results) {
    if (!res.success || !res.data) continue
    const d = res.data

    if (d.fields.theoryContent) {
      mergedTheory += (mergedTheory ? '\n\n' : '') + d.fields.theoryContent
    }
    if (d.fields.thingsToRemember) {
      const formatted = formatThingsToRemember(d.fields.thingsToRemember)
      if (formatted) mergedRemember += (mergedRemember ? '\n\n' : '') + formatted
    }
    if (d.fields.emotionalAnchor && !emotionalAnchor) {
      emotionalAnchor = d.fields.emotionalAnchor
    }
    if (Array.isArray(d.fields.references)) {
      mergedRefs.push(...d.fields.references)
    }

    rawCards.push(...d.cards)
    successfulChunks++
  }

  // ── Step 8: Normalize + deduplicate ──────────────────────────────────
  const normalizedCards = normalizeCards(rawCards)
  const crossChunkDeduped = fuzzyDeduplicateAcrossChunks(normalizedCards, 0.75)
  const finalDeduped      = deduplicateCards(crossChunkDeduped)
  const uniqueCards       = finalDeduped.slice(0, dynamicMaxCards)

  const orchestrationMs = performance.now() - t0

  // Telemetry v2.0 calculations
  const cardsGenerated = uniqueCards.length;
  const cardTypes: Record<string, number> = {};
  const bloomDistribution: Record<string, number> = {};
  let totalCardLength = 0;

  uniqueCards.forEach(c => {
    cardTypes[c.questionType] = (cardTypes[c.questionType] || 0) + 1;
    bloomDistribution[c.type] = (bloomDistribution[c.type] || 0) + 1;
    totalCardLength += (c.answer || '').length;
  });

  const avgCardLength = cardsGenerated > 0 ? totalCardLength / cardsGenerated : 0;
  const deduplicationRate = rawCards.length > 0 
    ? (rawCards.length - uniqueCards.length) / rawCards.length 
    : 0;

  return {
    fields: {
      theoryContent:    mergedTheory || rawText,
      thingsToRemember: mergedRemember,
      references:       mergedRefs,
      emotionalAnchor,
    },
    cards: uniqueCards,
    meta: {
      detectedSubject:    finalSubject,
      detectedAudience:   finalAudience,
      detectionSource,
      orchestrationTimeMs: orchestrationMs,
      chunkCount:          chunks.length,
      successfulChunks,
      dynamicMaxCards,
      sectionHeadersFound: sectionHeaders.length,
      cardsBeforeDedup:    rawCards.length,
      cardsAfterDedup:     uniqueCards.length,
      
      // Telemetry fields
      cardsGenerated,
      cardTypes,
      deduplicationRate,
      avgCardLength,
      bloomDistribution,
      inputTokens,
      outputTokens,
      estimatedCostUsd: 0.00,
      llmProvider: 'nvidia_nim',
      llmModel: NVIDIA_MODELS.text,
    },
  }
}
