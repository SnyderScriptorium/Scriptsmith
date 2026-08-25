const DEFAULT_MODULES = {
  writing: true,
  manuscript: true,
  characters: true,
  worldbuilding: true,
  timeline: true,
  research: true,
  notes: true,
  statistics: true,
  tableOfContents: true,
  prologue: true,
  epilogue: true,
  plotBoard: false,
  maps: false,
  familyTrees: false,
  languages: false,
  magicSystem: false,
  species: false,
  publishingCenter: false,
  seriesBible: false
};

export function getDefaultModules(){ return { ...DEFAULT_MODULES }; }
export function getProjectModules(document){ return { ...DEFAULT_MODULES, ...(document?.metadata?.modules || {}) }; }
export function setProjectModule(document, key, enabled){
  if(!document) return;
  document.metadata = document.metadata || {};
  document.metadata.modules = getProjectModules(document);
  if(key in DEFAULT_MODULES) document.metadata.modules[key] = Boolean(enabled);
}
export function toggleProjectModule(document, key){
  const modules = getProjectModules(document);
  setProjectModule(document, key, !modules[key]);
  return getProjectModules(document);
}
export const PROJECT_MODULE_LABELS = {
  writing:'Writing', manuscript:'Manuscript', characters:'Characters', worldbuilding:'Worldbuilding',
  timeline:'Timeline', research:'Research', notes:'Notes', statistics:'Statistics',
  tableOfContents:'Table of Contents', prologue:'Prologue', epilogue:'Epilogue', plotBoard:'Plot Board',
  maps:'Maps', familyTrees:'Family Trees', languages:'Languages', magicSystem:'Magic System',
  species:'Species', publishingCenter:'Publishing Center', seriesBible:'Series Bible'
};
