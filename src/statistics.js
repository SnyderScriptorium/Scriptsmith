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

export function recordWritingHistory(metadata = {}, words, date = new Date()) {
  metadata.writingHistory = Array.isArray(metadata.writingHistory) ? metadata.writingHistory : [];
  const key = date.toISOString().slice(0, 10);
  const existing = metadata.writingHistory.find(x => x.date === key);
  if (existing) existing.completed = words;
  else metadata.writingHistory.push({ date: key, goal: Number(metadata.dailyGoal || 1000), completed: words });
  return metadata.writingHistory;
}

export function filterWritingHistory(history = [], period = 'today', now = new Date()) {
  const end = new Date(now); end.setHours(23,59,59,999);
  const start = new Date(now); start.setHours(0,0,0,0);
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setMonth(start.getMonth() - 1);
  if (period === '3months') start.setMonth(start.getMonth() - 3);
  if (period === 'all') start.setTime(0);
  return history.filter(x => { const d = new Date(`${x.date}T12:00:00`); return d >= start && d <= end; });
}

export function paginate(items = [], page = 1, perPage = 15) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((safePage - 1) * perPage, safePage * perPage), page: safePage, totalPages };
}
