const LOWERCASE_WORDS = new Set(['e', 'di', 'del', 'della', 'con', 'senza', 'da', 'e\'']);

/** Deriva un titolo leggibile ("corallo1.png" -> "Corallo 1") dal nome di un file. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const spaced = base
    .replace(/(\d+)$/, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();

  return spaced
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
