export function createTimelineEvent(title = 'New Event', date = '') {
  return { id: crypto.randomUUID(), title, date, description: '', characters: [], locations: [], order: 0 };
}

export function sortTimeline(events = []) {
  return [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.order - b.order);
}
