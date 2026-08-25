const CURRENT_DOCUMENT_VERSION = 2;
let currentDocument = null;

const DEFAULT_MANUSCRIPT_PREFERENCES = {
  fontFamily: 'Georgia', fontSize: 12, lineSpacing: 1,
  header: '', footer: '', pageNumbers: false
};

export function createDocument() {
  return {
    id: crypto.randomUUID(),
    version: CURRENT_DOCUMENT_VERSION,
    title: 'Untitled Document',
    type: 'document',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      author: '', notes: '',
      chapters: [{ id: crypto.randomUUID(), title: 'Chapter 1', content: '' }],
      characters: [], locations: [], research: [], timeline: [],
      manuscriptPreferences: { ...DEFAULT_MANUSCRIPT_PREFERENCES }
    }
  };
}

export function migrateDocument(document) {
  if (!document) return document;
  const d = structuredClone(document);
  d.version = Number(d.version || 1);
  d.metadata = d.metadata || {};
  d.metadata.chapters = Array.isArray(d.metadata.chapters) ? d.metadata.chapters : [{ id: crypto.randomUUID(), title: 'Chapter 1', content: '' }];
  d.metadata.chapters.forEach(chapter => {
    chapter.id = chapter.id || crypto.randomUUID();
    chapter.title = chapter.title || 'Chapter';
    if (!('content' in chapter)) chapter.content = '';
  });
  for (const key of ['characters', 'locations', 'research', 'timeline']) if (!Array.isArray(d.metadata[key])) d.metadata[key] = [];
  const old = d.metadata.manuscriptPreferences || {};
  d.metadata.manuscriptPreferences = {
    ...DEFAULT_MANUSCRIPT_PREFERENCES,
    ...old,
    lineSpacing: Number(old.lineSpacing ?? old.lineHeight ?? 1) || 1
  };
  delete d.metadata.manuscriptPreferences.lineHeight;
  d.version = CURRENT_DOCUMENT_VERSION;
  return d;
}

export function getCurrentDocument() { return currentDocument; }
export function setCurrentDocument(document) { currentDocument = migrateDocument(document); }
export function updateDocumentContent(content) { if (currentDocument) { currentDocument.content = content; currentDocument.updatedAt = new Date().toISOString(); } }
export function updateDocumentTitle(title) { if (currentDocument) { currentDocument.title = title || 'Untitled Document'; currentDocument.updatedAt = new Date().toISOString(); } }
export function getDocumentVersion() { return CURRENT_DOCUMENT_VERSION; }
