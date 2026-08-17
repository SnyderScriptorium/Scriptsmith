let currentDocument = null;

export function createDocument() {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Document',
    type: 'document',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { author: '', notes: '' }
  };
}

export function getCurrentDocument() { return currentDocument; }
export function setCurrentDocument(document) { currentDocument = structuredClone(document); }
export function updateDocumentContent(content) { if (currentDocument) { currentDocument.content = content; currentDocument.updatedAt = new Date().toISOString(); } }
export function updateDocumentTitle(title) { if (currentDocument) { currentDocument.title = title || 'Untitled Document'; currentDocument.updatedAt = new Date().toISOString(); } }
