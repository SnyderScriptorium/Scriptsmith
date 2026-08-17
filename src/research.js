export function createResearchItem(title = 'New Research Item') {
  return { id: crypto.randomUUID(), title, type: 'note', source: '', url: '', content: '', tags: [], createdAt: new Date().toISOString() };
}
