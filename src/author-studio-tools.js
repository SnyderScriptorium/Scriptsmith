import { getCurrentDocument } from './document.js';
import { saveToLibrary } from './filesystem.js';

export function wordCount(text=''){return String(text).trim()?String(text).trim().split(/\s+/).length:0}
export function characterCount(text=''){return String(text).length}
export function manuscriptStatistics(document=getCurrentDocument()){
 if(!document)return {words:0,characters:0,pages:0,chapters:[],sessions:[]};
 const words=wordCount(document.content||'');
 const chapters=(document.metadata?.chapters||[]).map(c=>({id:c.id,title:c.title||'Chapter',words:wordCount(c.content||'')}));
 return {words,characters:characterCount(document.content||''),pages:Math.max(1,Math.ceil(words/250)),chapters,sessions:document.metadata?.sessions||[]};
}
export async function startWritingSession(document=getCurrentDocument()){
 if(!document)return null;
 const session={id:crypto.randomUUID(),startedAt:new Date().toISOString(),startWords:wordCount(document.content||''),endedAt:null,endWords:null,wordsWritten:0};
 document.metadata=document.metadata||{};document.metadata.sessions=Array.isArray(document.metadata.sessions)?document.metadata.sessions:[];document.metadata.sessions.push(session);await saveToLibrary(document);return session;
}
export async function finishWritingSession(sessionId,document=getCurrentDocument()){
 if(!document)return null;const session=(document.metadata?.sessions||[]).find(s=>s.id===sessionId);if(!session)return null;session.endedAt=new Date().toISOString();session.endWords=wordCount(document.content||'');session.wordsWritten=Math.max(0,session.endWords-(session.startWords||0));await saveToLibrary(document);return session;
}
export function buildTableOfContents(document=getCurrentDocument()){
 if(!document)return [];
 const toc=document.metadata?.tableOfContents||{mode:'automatic',entries:[]};
 if(toc.mode==='manual')return toc.entries||[];
 return (document.metadata?.chapters||[]).map((c,i)=>({id:c.id,title:c.title||`Chapter ${i+1}`,type:'chapter',index:i}));
}
export function setTableOfContentsMode(mode,document=getCurrentDocument()){if(!document)return;document.metadata=document.metadata||{};document.metadata.tableOfContents={...(document.metadata.tableOfContents||{}),mode:mode==='manual'?'manual':'automatic'};}
export function addManualTocEntry(title,document=getCurrentDocument()){if(!document)return;document.metadata=document.metadata||{};document.metadata.tableOfContents=document.metadata.tableOfContents||{mode:'manual',entries:[]};document.metadata.tableOfContents.mode='manual';document.metadata.tableOfContents.entries.push({id:crypto.randomUUID(),title:String(title||'Untitled')});}
export async function addTimelineItem(item,document=getCurrentDocument()){
 if(!document)return null;document.metadata=document.metadata||{};document.metadata.timeline=Array.isArray(document.metadata.timeline)?document.metadata.timeline:[];const record={id:crypto.randomUUID(),type:item.type||'event',title:item.title||'Untitled Event',date:item.date||'',description:item.description||'',order:document.metadata.timeline.length,...item};document.metadata.timeline.push(record);document.updatedAt=new Date().toISOString();await saveToLibrary(document);return record;
}
export async function addBook(item,document=getCurrentDocument()){return addTimelineItem({...item,type:'book'},document)}
export async function reorderTimeline(id,newIndex,document=getCurrentDocument()){
 if(!document)return;const list=document.metadata?.timeline||[];const from=list.findIndex(x=>x.id===id);if(from<0)return;const [item]=list.splice(from,1);list.splice(Math.max(0,Math.min(newIndex,list.length)),0,item);list.forEach((x,i)=>x.order=i);document.updatedAt=new Date().toISOString();await saveToLibrary(document);
}
export function newNote(title='Untitled Note',content=''){return {id:crypto.randomUUID(),title,content,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}
export function characterQuestionnaire(){return {identity:{name:'',aliases:'',nickname:'',age:'',birthday:'',birthplace:'',nationality:'',languages:'',occupation:'',education:''},physical:{height:'',build:'',hair:'',eyes:'',style:'',scars:'',tattoos:'',voice:''},psychology:{personality:'',temperament:'',coreDesire:'',greatestFear:'',flaws:'',strengths:'',values:'',beliefs:'',secrets:'',trauma:'',defenses:'',habits:'',motivations:''},relationships:{parents:'',siblings:'',children:'',friends:'',enemies:'',mentor:'',romance:'',familyTree:''},favorites:{food:'',drink:'',music:'',songs:'',books:'',movies:'',shows:'',games:'',hobbies:'',pets:''},lifestyle:{fashion:'',home:'',vehicle:'',routine:'',possessions:'',socialLife:''},story:{backstory:'',adventure:'',goal:'',internalConflict:'',externalConflict:'',arc:'',growth:'',ending:''},writerNotes:''}}
export function prologueTemplate(){return 'PROLOGUE\n\nPurpose: establish a compelling entry point before Chapter 1.\n\n[Write the prologue here.]'}
export function epilogueTemplate(){return 'EPILOGUE\n\nPurpose: show what follows the main story and provide closure.\n\n[Write the epilogue here.]'}
