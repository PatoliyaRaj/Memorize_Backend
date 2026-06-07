export type SupportedLang = 'eng' | 'hin' | 'guj';

export function detectLanguageFromText(text: string): SupportedLang {
  if (!text) return 'eng';
  let dev = 0, guj = 0, lat = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0900 && c <= 0x097F) dev++;
    else if (c >= 0x0A80 && c <= 0x0AFF) guj++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
  }
  if (dev + guj === 0) return 'eng';
  if (guj > dev) return guj > lat * 0.1 ? 'guj' : 'eng';
  return dev > lat * 0.1 ? 'hin' : 'eng';
}
