export interface ExistingCard { id: string; question: string; answer: string; orderIndex: number; explanation: string | null; }
export interface IncomingCard { question: string; answer: string; questionType: string; subTopic?: string; explanation?: string; }

export interface SyncResult {
  cardsToCreate: IncomingCard[];
  cardIdsToSoftDelete: string[];
  cardsToUpdate: { id: string; question: string; answer: string; orderIndex: number; explanation: string }[];
  telemetry: { avgSimilarity: number; perfectMatches: number; };
}

export function syncImportedCards(existing: ExistingCard[], incoming: IncomingCard[], threshold = 0.85): SyncResult {
  const toCreate: IncomingCard[] = [];
  const toUpdate: SyncResult['cardsToUpdate'] = [];
  const matched = new Set<string>();
  let simSum = 0, perfect = 0, checked = 0;

  incoming.forEach((inc, idx) => {
    let bestId: string | null = null, bestSim = 0;
    
    for (const ex of existing) {
      if (matched.has(ex.id)) continue;
      
      const s = levOptimized(inc.question, ex.question, threshold);
      if (s > bestSim) { 
        bestSim = s; 
        bestId = ex.id; 
      }
    }
    
    if (bestSim > 0) { 
      simSum += bestSim; 
      checked++; 
      if (bestSim === 1) perfect++; 
    }
    
    const meta = JSON.stringify({ subTopic: inc.subTopic || 'General', text: inc.explanation || '' });

    if (bestId && bestSim >= threshold) {
      matched.add(bestId);
      const ex = existing.find(e => e.id === bestId)!;
      if (ex.answer !== inc.answer || ex.orderIndex !== idx || ex.explanation !== meta) {
        toUpdate.push({ id: bestId, question: inc.question, answer: inc.answer, orderIndex: idx, explanation: meta });
      }
    } else {
      toCreate.push(inc);
    }
  });

  const toSoftDelete = existing.filter(e => !matched.has(e.id)).map(e => e.id);
  
  return { 
    cardsToCreate: toCreate, 
    cardIdsToSoftDelete: toSoftDelete, 
    cardsToUpdate: toUpdate, 
    telemetry: { 
      avgSimilarity: checked ? simSum / checked : 1, 
      perfectMatches: perfect 
    } 
  };
}

// Algorithmic Complexity Protection: Prevents O(N*M) CPU exhaustion attacks on long strings
function levOptimized(a: string, b: string, threshold: number): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  // COMPLEXITY PROTECTION: If the absolute length difference is too large to meet the similarity threshold,
  // exit immediately with 0.0 rather than calculating the matrix.
  const maxLen = Math.max(s1.length, s2.length);
  const minLen = Math.min(s1.length, s2.length);
  if (minLen / maxLen < threshold) {
    return 0.0;
  }

  const m = Array.from({ length: s2.length + 1 }, (_, j) => 
    Array.from({ length: s1.length + 1 }, (_, i) => i === 0 ? j : j === 0 ? i : 0)
  );

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      m[j][i] = Math.min(
        m[j][i-1] + 1,
        m[j-1][i] + 1,
        m[j-1][i-1] + (s1[i-1] === s2[j-1] ? 0 : 1)
      );
    }
  }
  
  return (maxLen - m[s2.length][s1.length]) / maxLen;
}
