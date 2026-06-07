// Rule-based only — no AI, runs instantly
const REMEMBER_TRIGGERS = [/^remember[:\s]/i, /^note[:\s]/i, /^important[:\s]/i, /^key[:\s]/i, /^exam tip[:\s]/i, /^tip[:\s]/i, /^summary[:\s]/i];
const ANCHOR_TRIGGERS   = [/^personal[:\s]/i, /^story[:\s]/i, /^analogy[:\s]/i, /^this reminds me/i];
const URL_PATTERN       = /https?:\/\/[^\s]+/g;

interface ParsedFields { theory: string; thingsToRemember: string; references: Array<{ title: string; url: string; type: string }>; emotionalAnchor: string; }

export function parseIntoFields(rawText: string): ParsedFields {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const theoryLines: string[] = [], rememberLines: string[] = [], anchorLines: string[] = [];
  const references: Array<{ title: string; url: string; type: string }> = [];
  let section: 'theory' | 'remember' | 'anchor' = 'theory';

  for (const line of lines) {
    const urls = line.match(URL_PATTERN);
    if (urls) {
      for (const url of urls) references.push({ title: url.replace(/https?:\/\//, '').split('/')[0], url, type: detectUrlType(url) });
      const clean = line.replace(URL_PATTERN, '').trim();
      if (clean.length > 3) theoryLines.push(clean);
      continue;
    }
    if (REMEMBER_TRIGGERS.some(p => p.test(line))) { section = 'remember'; continue; }
    if (ANCHOR_TRIGGERS.some(p => p.test(line)))   { section = 'anchor';   continue; }
    if (section === 'remember') rememberLines.push(line);
    else if (section === 'anchor') anchorLines.push(line);
    else theoryLines.push(line);
  }
  return { theory: theoryLines.join('\n').trim(), thingsToRemember: rememberLines.join('\n').trim(), references, emotionalAnchor: anchorLines.join('\n').trim() };
}

function detectUrlType(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  if (url.includes('github.com')) return 'code';
  if (url.includes('.pdf')) return 'document';
  return 'article';
}
