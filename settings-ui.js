import { getSettings, updateSettings, resetSettings } from './settings.js';

const fields = [
  ['theme','Theme','select',['paper','dark','sepia']],
  ['autosave','Automatic saving','check'],
  ['autosaveIntervalMs','Autosave interval (seconds)','number',1,300],
  ['spellcheck','Spellcheck','check'],
  ['sessionTracking','Track writing sessions','check'],
  ['sessionWordCount','Show session word count','check'],
  ['pageWordCount','Show page word count','check'],
  ['confirmBeforeDelete','Confirm before deleting','check'],
  ['restoreAutosave','Offer autosave recovery','check']
];

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

function openSettings() {
  document.querySelector('#scriptsmith-settings-modal')?.remove();
  const s=getSettings();
  const modal=document.createElement('div'); modal.id='scriptsmith-settings-modal'; modal.className='ss-settings-overlay';
  modal.innerHTML=`<section class="ss-settings-card" role="dialog" aria-modal="true"><header><div><h2>ScriptSmith Settings</h2><p>Program preferences that are separate from the manuscript writing toolbar.</p></div><button data-close>×</button></header><div class="ss-settings-grid"><div><h3>Application</h3>${fields.map(f=>{
    const [key,label,type,a,b]=f;
    if(type==='check') return `<label class="ss-setting-row"><span>${label}</span><input type="checkbox" data-setting="${key}" ${s[key]?'checked':''}></label>`;
    if(type==='select') return `<label class="ss-setting-row"><span>${label}</span><select data-setting="${key}">${a.map(v=>`<option ${s[key]===v?'selected':''}>${v}</option>`).join('')}</select></label>`;
    return `<label class="ss-setting-row"><span>${label}</span><input type="number" min="${a}" max="${b}" data-setting="${key}" value="${key==='autosaveIntervalMs'?Math.round(s[key]/1000):esc(s[key])}"></label>`;
  }).join('')}</div><div><h3>Writing defaults</h3><label class="ss-setting-row"><span>Default font</span><input data-setting="fontFamily" value="${esc(s.fontFamily)}"></label><label class="ss-setting-row"><span>Default font size</span><input type="number" min="8" max="72" data-setting="fontSize" value="${s.fontSize}"></label><label class="ss-setting-row"><span>Default line spacing</span><select data-setting="lineSpacing">${['1','1.15','1.5','2','2.5','3'].map(v=>`<option value="${v}" ${s.lineSpacing===v?'selected':''}>${v==='1'?'Single':v==='1.15'?'1.15':v==='1.5'?'1.5':v==='2'?'Double':v==='2.5'?'2.5':'Triple'}</option>`).join('')}</select></label><label class="ss-setting-row"><span>Reading mode</span><select data-setting="readingMode"><option value="page">Page</option><option value="focus">Focus</option><option value="continuous">Continuous</option></select></label><p class="ss-settings-note">Font, color, size, line spacing, spellcheck, page numbers, headers, and footers are manuscript controls and live on the Writing toolbar.</p></div></div><footer><button data-reset>Reset defaults</button><span></span><button data-close>Cancel</button><button class="primary-action" data-save>Save settings</button></footer></section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.remove());
  modal.querySelector('[data-reset]').onclick=()=>{resetSettings();modal.remove();openSettings();};
  modal.querySelector('[data-save]').onclick=()=>{
    const changes={}; modal.querySelectorAll('[data-setting]').forEach(el=>{let v=el.type==='checkbox'?el.checked:el.value;if(el.dataset.setting==='autosaveIntervalMs')v=Math.max(1000,Number(v)*1000);if(el.type==='number'&&el.dataset.setting!=='autosaveIntervalMs')v=Number(v);changes[el.dataset.setting]=v;});
    updateSettings(changes); modal.remove();
  };
}

export function installSettingsUI(){
  document.addEventListener('click',e=>{const b=e.target.closest('[data-view="settings"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openSettings();},true);
  document.addEventListener('click',e=>{if(e.target.id==='home-settings')openSettings();});
}
