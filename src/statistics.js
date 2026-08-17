export function countWords(text = '') {
  const cleaned = text.replace(/\u00a0/g, ' ').trim();
  return cleaned ? cleaned.split(/\s+/u).length : 0;
}

export function countCharacters(text = '') {
  return Array.from(text).length;
}

export function writingSnapshot(text = '') {
  return { words: countWords(text), characters: countCharacters(text), recordedAt: new Date().toISOString() };
}
