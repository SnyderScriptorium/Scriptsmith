export function createRevision(document) {
  return { id: crypto.randomUUID(), documentId: document.id, title: document.title, content: document.content, createdAt: new Date().toISOString() };
}

export function addRevision(history = [], document, limit = 50) {
  return [...history, createRevision(document)].slice(-limit);
}
