import { getCurrentDocument } from './document.js';

function timelineData() {
  const d = getCurrentDocument();
  d.metadata = d.metadata || {};
  d.metadata.timeline = Array.isArray(d.metadata.timeline) ? d.metadata.timeline : [];
  return d.metadata.timeline;
}

function markDirty() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = 'Unsaved changes';
}

function toast(message) {
  let el = document.querySelector('#sprint19-toast');
  if (!el) { el = document.createElement('div'); el.id = 'sprint19-toast'; document.body.appendChild(el); }
  el.textContent = message; el.hidden = false;
  clearTimeout(el._timelineTimer);
  el._timelineTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

function eventId(node) {
  return node?.dataset?.timelineId || node?.dataset?.eventId || node?.dataset?.id || node?.querySelector('[data-timeline-id]')?.dataset?.timelineId || node?.querySelector('[data-event-id]')?.dataset?.eventId || '';
}

function timelineNodes(panel) {
  const explicit = [...panel.querySelectorAll('[data-timeline-id], [data-event-id], .timeline-event, .timeline-item, .timeline-node, .timeline-row')];
  if (explicit.length) return [...new Set(explicit)].filter(n => !n.closest('.sprint19-timeline-controls'));
  const list = panel.querySelector('.explorer-list');
  if (!list) return [];
  return [...list.children].filter(n => !n.classList.contains('feature-placeholder') && n.querySelector('button, strong, h3'));
}

function syncOrder(nodes) {
  const data = timelineData();
  if (!data.length) return;
  const ids = nodes.map((node, index) => eventId(node) || String(index));
  const ordered = [];
  ids.forEach(id => { const found = data.find(e => String(e.id || e.eventId || '') === String(id)); if (found) ordered.push(found); });
  if (ordered.length === data.length) {
    ordered.forEach((event, index) => { event.order = index; });
    data.splice(0, data.length, ...ordered);
    markDirty();
  }
}

function moveNode(panel, node, direction) {
  const nodes = timelineNodes(panel);
  const index = nodes.indexOf(node);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= nodes.length) return;
  if (direction < 0) node.parentNode.insertBefore(node, nodes[target]);
  else node.parentNode.insertBefore(node, nodes[target].nextSibling);
  syncOrder(timelineNodes(panel));
  toast(direction < 0 ? 'Timeline event moved up' : 'Timeline event moved down');
  refreshControls(panel);
}

function refreshControls(panel) {
  panel.querySelectorAll('.sprint19-timeline-controls').forEach(x => x.remove());
  timelineNodes(panel).forEach(node => {
    node.classList.add('sprint19-timeline-event');
    node.addEventListener('click', () => selectEvent(panel, node), { once: true });
  });
}

function selectEvent(panel, node) {
  panel.querySelectorAll('.sprint19-timeline-selected').forEach(x => x.classList.remove('sprint19-timeline-selected'));
  panel.querySelectorAll('.sprint19-timeline-controls').forEach(x => x.remove());
  node.classList.add('sprint19-timeline-selected');
  const controls = document.createElement('div');
  controls.className = 'sprint19-timeline-controls';
  const nodes = timelineNodes(panel); const index = nodes.indexOf(node);
  controls.innerHTML = `<button type="button" class="theme-button" data-up ${index === 0 ? 'disabled' : ''}>↑ Move Up</button><button type="button" class="theme-button" data-down ${index === nodes.length - 1 ? 'disabled' : ''}>↓ Move Down</button>`;
  node.appendChild(controls);
  controls.querySelector('[data-up]').onclick = e => { e.stopPropagation(); moveNode(panel, node, -1); };
  controls.querySelector('[data-down]').onclick = e => { e.stopPropagation(); moveNode(panel, node, 1); };
}

export function installTimelineInteractions() {
  let lastPanel = null;
  const enhance = () => {
    const panel = document.querySelector('#workspace-panel');
    const heading = panel?.querySelector('.explorer-header h1');
    if (!panel || !heading || !/^Timeline$/i.test(heading.textContent.trim())) { lastPanel = null; return; }
    if (panel === lastPanel && panel.querySelector('.sprint19-timeline-event')) return;
    lastPanel = panel;
    refreshControls(panel);
  };
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  enhance();
}
