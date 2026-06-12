/**
 * Audience & Subject Detector — 3-Layer Detection System v1.1
 *
 * Layer 1: DB-driven (most authoritative — uses user's actual profile from DB)
 * Layer 2: Content signal detection (keyword scoring from raw text)
 * Layer 3: LLM fallback (the prompt itself handles this; Layer 3 = GENERAL default)
 *
 * Resolution rule:
 *   Layer 1 result ≠ GENERAL → use Layer 1 (user's chosen profile wins)
 *   Layer 1 result = GENERAL → use Layer 2
 *   Layer 2 confidence < threshold → use GENERAL
 */

import { getDb } from '@/db'
import { userProfiles } from '@/db/schemas/userProfiles'
import { eq } from 'drizzle-orm'
import {
  AudienceType,
  Subject,
  detectSubject,
  detectAudienceFromContent,
} from './promptBuilder'

// ── In-Memory Cache (5-minute TTL) ─────────────────────────────────────────
const audienceCache = new Map<string, { 
  audience: AudienceType; 
  timestamp: number 
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearAudienceCache(userId?: string): void {
  if (userId) {
    audienceCache.delete(userId);
  } else {
    audienceCache.clear();
  }
}

// ── DB PROFILE → AUDIENCE TYPE MAPPING ──────────────────────────────────────
const DB_AUDIENCE_MAP: Record<string, AudienceType> = {
  // School students
  'school':           'STUDENT_SCHOOL',
  'class_10':         'STUDENT_SCHOOL',
  'class_12':         'STUDENT_SCHOOL',
  'high_school':      'STUDENT_SCHOOL',

  // College / competitive exam students
  'bca':              'STUDENT_COLLEGE',
  'mca':              'STUDENT_COLLEGE',
  'b_tech':           'STUDENT_COLLEGE',
  'b_sc':             'STUDENT_COLLEGE',
  'b_com':            'STUDENT_COLLEGE',
  'ba':               'STUDENT_COLLEGE',
  'student':          'STUDENT_COLLEGE',
  'jee':              'STUDENT_COLLEGE',
  'neet':             'STUDENT_COLLEGE',
  'upsc':             'STUDENT_COLLEGE',
  'gate':             'STUDENT_COLLEGE',
  'cat':              'STUDENT_COLLEGE',
  'exam':             'STUDENT_COLLEGE',

  // Professional
  'developer':        'PROGRAMMER',
  'software_engineer':'PROGRAMMER',
  'engineer':         'PROGRAMMER',
  'programmer':       'PROGRAMMER',
  'upskilling':       'PROFESSIONAL',
  'professional':     'PROFESSIONAL',
  'cfa':              'INVESTOR',
  'finance':          'INVESTOR',

  // Senior technical
  'senior_developer': 'PROGRAMMER_ADVANCED',
  'tech_lead':        'PROGRAMMER_ADVANCED',
  'architect':        'PROGRAMMER_ADVANCED',
  'engineering_manager':'PROGRAMMER_ADVANCED',

  // Research
  'researcher':       'RESEARCHER',
  'academic':         'RESEARCHER',
  'scientist':        'RESEARCHER',
  'phd':              'RESEARCHER',
  'postdoc':          'RESEARCHER',
  'msc':              'RESEARCHER',

  // Teaching
  'teacher':          'TEACHER',
  'professor':        'TEACHER',
  'instructor':       'TEACHER',
  'tutor':            'TEACHER',
  'educator':         'TEACHER',

  // Medical
  'mbbs':             'MEDICAL',
  'doctor':           'MEDICAL',
  'medical_student':  'MEDICAL',
  'pharmacist':       'MEDICAL',
  'nurse':            'MEDICAL',
  'dentist':          'MEDICAL',

  // Business
  'mba':              'BUSINESS_STUDENT',
  'bba':              'BUSINESS_STUDENT',
  'business_student': 'BUSINESS_STUDENT',
  'management':       'BUSINESS_STUDENT',

  // Entrepreneur
  'entrepreneur':     'ENTREPRENEUR',
  'founder':          'ENTREPRENEUR',
  'startup':          'ENTREPRENEUR',
  'product_manager':  'ENTREPRENEUR',

  // Investor
  'investor':         'INVESTOR',
  'trader':           'INVESTOR',
  'stock_market':     'INVESTOR',
  'fund_manager':     'INVESTOR',

  // Executive
  'ceo':              'EXECUTIVE',
  'cto':              'EXECUTIVE',
  'coo':              'EXECUTIVE',
  'cfo':              'EXECUTIVE',
  'executive':        'EXECUTIVE',
  'vp':               'EXECUTIVE',
  'director':         'EXECUTIVE',
  'manager':          'EXECUTIVE',

  // Critical Thinker
  'consultant':       'CRITICAL_THINKER',
  'analyst':          'CRITICAL_THINKER',
  'problem_solver':   'CRITICAL_THINKER',
  'data_analyst':     'CRITICAL_THINKER',
  'strategist':       'CRITICAL_THINKER',
}

// ── LAYER 1 — DB-DRIVEN AUDIENCE RESOLUTION ────────────────────────────────
export async function getUserAudienceFromDB(userId: string): Promise<AudienceType> {
  const cached = audienceCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.audience;
  }

  try {
    const db = getDb();
    const [profile] = await db
      .select({
        academicLevel: userProfiles.academicLevel,
        studyGoals:    userProfiles.studyGoals,
        occupation:    userProfiles.occupation,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    if (!profile) {
      audienceCache.set(userId, { audience: 'GENERAL', timestamp: Date.now() });
      return 'GENERAL';
    }

    // Combine all profile fields into one search string
    const allFields = [
      profile.occupation,
      profile.studyGoals,
      profile.academicLevel,
    ]
      .filter(Boolean)
      .map(f => (f as string).toLowerCase().trim().replace(/\s+/g, '_'))

    // Try exact match first
    for (const field of allFields) {
      const mapped = DB_AUDIENCE_MAP[field]
      if (mapped) {
        audienceCache.set(userId, { audience: mapped, timestamp: Date.now() });
        return mapped;
      }
    }

    // Unambiguous partial matches (Fix #6)
    const UNAMBIGUOUS_PARTIAL_MATCHES = [
      'jee', 'neet', 'upsc', 'gate', 'cat',
      'mbbs', 'bca', 'mca', 'b_tech',
      'phd', 'msc',
      'ceo', 'cto', 'founder', 'entrepreneur',
      'investor', 'trader'
    ];

    // Try partial match only for unambiguous terms
    for (const field of allFields) {
      for (const key of UNAMBIGUOUS_PARTIAL_MATCHES) {
        if (field.includes(key)) {
          const mapped = DB_AUDIENCE_MAP[key];
          if (mapped) {
            audienceCache.set(userId, { audience: mapped, timestamp: Date.now() });
            return mapped;
          }
        }
      }
    }

    audienceCache.set(userId, { audience: 'GENERAL', timestamp: Date.now() });
    return 'GENERAL'
  } catch (err) {
    console.error('[AUDIENCE DETECTOR] DB query failed, using GENERAL fallback:', err)
    return 'GENERAL'
  }
}

// ── LAYER 2 — CONTENT SIGNAL DETECTION ──────────────────────────────────────
interface ContentDetectionResult {
  audience:   AudienceType
  subject:    Subject
  confidence: number // 0.0 to 1.0
}

export function detectFromContent(rawText: string): ContentDetectionResult {
  const subject    = detectSubject(rawText)
  const audience   = detectAudienceFromContent(rawText, subject)
  const text       = rawText.toLowerCase()

  const audienceSignals: Record<AudienceType, string[]> = {
    STUDENT_SCHOOL:      ['class 10', 'class 12', 'ncert', 'cbse', 'icse', 'board exam', 'school'],
    STUDENT_COLLEGE:     ['jee', 'neet', 'upsc', 'cat ', 'gate ', 'entrance', 'semester', 'b.tech', 'bca', 'mca'],
    PROFESSIONAL:        ['at work', 'workplace', 'industry', 'best practice', 'project', 'team'],
    RESEARCHER:          ['et al', 'methodology', 'empirical', 'hypothesis', 'literature review', 'phd', 'research paper'],
    TEACHER:             ['teaching', 'lesson plan', 'learning objectives', 'common misconception', 'students will'],
    MEDICAL:             ['patient', 'diagnosis', 'clinical', 'contraindication', 'drug mechanism', 'pharmacology'],
    NEUROSCIENCE_EXPERT: ['synapse', 'hippocampus', 'axon', 'dendrite', 'neurotransmitter', 'cortex'],
    PROGRAMMER:          ['function', 'variable', 'algorithm', 'runtime', 'git', 'debug'],
    PROGRAMMER_ADVANCED: ['microservice', 'distributed', 'architecture', 'kubernetes', 'system design', 'tech lead'],
    MATHEMATICIAN:       ['proof', 'theorem', 'derive', 'rigorous', 'mathematical induction', 'formal'],
    BUSINESS_STUDENT:    ['mba', 'case study', 'b-school', 'bba', 'business school', 'porter', 'swot'],
    ENTREPRENEUR:        ['startup', 'founder', 'pitch deck', 'product market fit', 'unit economics', 'fundraising'],
    INVESTOR:            ['value investing', 'buffett', 'p/e', 'margin of safety', 'portfolio', 'nse', 'bse', 'nifty'],
    EXECUTIVE:           ['ceo', 'board', 'quarterly', 'strategic planning', 'capital allocation', 'organizational'],
    CRITICAL_THINKER:    ['consulting', 'mece', 'case framework', 'root cause', 'hypothesis driven', 'mckinsey'],
    GENERAL:             [],
  }

  const matchCount = (audienceSignals[audience] ?? []).filter(sig => text.includes(sig)).length
  const confidence = Math.min(1.0, matchCount / 4) // 4+ signals = 100% confidence

  return { audience, subject, confidence }
}

// ── MAIN RESOLVER — 3-LAYER ORCHESTRATION ────────────────────────────────────
export interface AudienceResolution {
  audience:       AudienceType
  subject:        Subject
  source:         'db' | 'content' | 'default'
  dbAudience:     AudienceType
  contentResult:  ContentDetectionResult
}

export async function resolveAudienceAndSubject(
  userId:  string,
  rawText: string
): Promise<AudienceResolution> {
  // Layer 1: DB-driven (most authoritative)
  const dbAudience = await getUserAudienceFromDB(userId)

  // Layer 2: Content signal detection (always runs, used as fallback or subject override)
  const contentResult = detectFromContent(rawText)

  // Resolution logic:
  // DB result wins unless it's GENERAL (meaning no profile data)
  let finalAudience: AudienceType
  let source: 'db' | 'content' | 'default'

  if (dbAudience !== 'GENERAL') {
    // DB profile is specific — trust it
    finalAudience = dbAudience
    source = 'db'
  } else if (contentResult.confidence >= 0.25) {
    // DB has no profile, but content signals are strong enough
    finalAudience = contentResult.audience
    source = 'content'
  } else {
    // Neither layer is confident — use GENERAL
    finalAudience = 'GENERAL'
    source = 'default'
  }

  return {
    audience:      finalAudience,
    subject:       contentResult.subject,  // Subject always comes from content (never from profile)
    source,
    dbAudience,
    contentResult,
  }
}