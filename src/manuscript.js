export function createManuscript(title = 'Untitled Manuscript') {
  return {
    id: crypto.randomUUID(), type: 'manuscript', title,
    chapters: [], characters: [], notes: [], metadata: { author: '', genre: '', description: '' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

export function createChapter(title = 'Chapter 1', order = 0) {
  return { id: crypto.randomUUID(), title, order, scenes: [], notes: '' };
}

export function createScene(title = 'Scene', order = 0) {
  return { id: crypto.randomUUID(), title, order, content: '', notes: '' };
}
