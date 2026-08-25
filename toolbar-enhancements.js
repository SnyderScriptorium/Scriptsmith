import { getSettings, updateSettings } from './settings.js';

const fonts={
  'Classic Serif':['Georgia','Garamond','Baskerville','Palatino Linotype','Book Antiqua','Cambria','Constantia','Bodoni 72','Didot','Hoefler Text','Iowan Old Style','Libre Baskerville','Cormorant Garamond','Crimson Text'],
  'Modern Serif':['Times New Roman','Times','Charter','Merriweather','Roboto Slab','Source Serif Pro','Noto Serif','PT Serif','Lora','Bitter','Arvo','Zilla Slab'],
  'Sans Serif':['Arial','Calibri','Aptos','Verdana','Tahoma','Trebuchet MS','Segoe UI','Helvetica','Gill Sans','Century Gothic','Futura','Montserrat','Open Sans','Roboto'],
  'Typewriter':['Courier New','Courier Prime','Consolas','Lucida Console','Special Elite','American Typewriter'],
  'Display & Fantasy':['Cinzel','IM FELL English','Uncial Antiqua','MedievalSharp','Rye','Almendra','Creepster','Abril Fatface']
};
const allFonts=[...new Set(Object.values(fonts).flat())];

function ensureToolbar(){
 const toolbar=document.querySelector('.toolbar'); if(!toolbar||toolbar.dataset.ssEnhanced)return;
 toolbar.dataset.ssEnhanced='true';
 const font=document.querySelector('#font'); if(font){font.innerHTML=Object.entries(fonts).map(([group,list])=>`<optgroup label="${group}">${list.map(f=>`<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}</optgroup>`).join('');font.title=`${allFonts.length} fonts`;}
 const separator=document.createElement('span');separator.className='toolbar-separator';
 const controls=document.createElement('span');controls.className='ss-toolbar-controls';
 controls.innerHTML=`<select id="line-spacing" title="Line spacing"><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option><option value="2.5">2.5</option><option value="3">Triple</option></select><button id="spellcheck-toggle" title="Spellcheck">✓ Spellcheck</button><button id="page-number-toggle" title="Page numbers"># Pages</button><button id="header-toggle" title="Header">Header</button><button id="footer-toggle" title="Footer">Footer</button>`;
 toolbar.append(separator,controls);
 const s=getSettings();
 const editor=document.querySelector('#editor'); if(editor)editor.spellcheck=!!s.spellcheck;
 const ls=document.querySelector('#line-spacing'); if(ls)ls.value=s.lineSpacing;
 function toggleSetting(key,button){const value=!getSettings()[key];updateSettings({[key]:value});button.classList.toggle('active',value);if(key==='spellcheck'&&editor)editor.spellcheck=value;applyPageDecorations();}
 document.querySelector('#spellcheck-toggle').onclick=()=>toggleSetting('spellcheck',document.querySelector('#spellcheck-toggle'));
 document.querySelector('#page-number-toggle').onclick=()=>toggleSetting('pageNumbers',document.querySelector('#page-number-toggle'));
 document.querySelector('#header-toggle').onclick=()=>toggleSetting('headers',document.querySelector('#header-toggle'));
 document.querySelector('#footer-toggle').onclick=()=>toggleSetting('footers',document.querySelector('#footer-toggle'));
 ls.onchange=()=>{updateSettings({lineSpacing:ls.value});if(editor)editor.style.lineHeight=ls.value;};
 ['spellcheck','pageNumbers','headers','footers'].forEach(k=>document.querySelector(`#${k==='pageNumbers'?'page-number':k}-toggle`)?.classList.toggle('active',!!s[k]));
 applyPageDecorations();
}

function applyPageDecorations(){
 const e=document.querySelector('#editor');if(!e)return;const s=getSettings();e.style.lineHeight=s.lineSpacing;e.spellcheck=s.spellcheck;e.classList.toggle('ss-page-numbers',s.pageNumbers);e.classList.toggle('ss-has-header',s.headers);e.classList.toggle('ss-has-footer',s.footers);
}

export function installToolbarEnhancements(){
 const observer=new MutationObserver(()=>ensureToolbar());observer.observe(document.body,{childList:true,subtree:true});ensureToolbar();
 document.addEventListener('change',e=>{if(e.target.matches('#font'))updateSettings({fontFamily:e.target.value});if(e.target.matches('#size'))updateSettings({fontSize:Number(e.target.value)});});
}
