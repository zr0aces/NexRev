/* ── Sales Dashboard — app.js ─────────────────────────── */

const STAGES = ['Prospecting','Qualification','Discovery','Demo','Proposal','Negotiation','Closed Won','Closed Lost'];
const STAGE_COLORS = {
  Prospecting:'gray', Qualification:'blue', Discovery:'teal', Demo:'blue',
  Proposal:'amber', Negotiation:'amber', 'Closed Won':'green', 'Closed Lost':'red'
};
const STORAGE_KEY = 'sales_dashboard_opps';
const API_KEY_KEY = 'sales_dashboard_api_key';

let opps = [];
let selectedId = null;
let stageFilter = 'All';

// ── Persistence ──────────────────────────────────────────
function loadData() {
  try { opps = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { opps = []; }
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opps));
}

// ── API Key ───────────────────────────────────────────────
function getApiKey() { return localStorage.getItem(API_KEY_KEY) || ''; }
function setApiKey(k) { localStorage.setItem(API_KEY_KEY, k); }

// ── Utils ─────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,dd] = d.split('-');
  return `${m}/${dd}/${y.slice(2)}`;
}
function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d) - new Date(today())) / 86400000);
}
function isOverdue(d) { return d && d < today(); }
function badge(stage) {
  const c = STAGE_COLORS[stage] || 'gray';
  return `<span class="badge badge-${c}">${stage}</span>`;
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Panel routing ─────────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.querySelector(`.nav-tab[data-panel="${id}"]`).classList.add('active');
  if (id === 'digest') renderDigest();
  if (id === 'pipeline') renderPipeline();
  if (id === 'log') renderLog();
}

// ── API Banner ────────────────────────────────────────────
function renderApiBanner(containerId) {
  const key = getApiKey();
  const el = document.getElementById(containerId);
  if (!el) return;
  if (key) {
    el.innerHTML = `<div class="api-banner">
      <span>AI features active &#x2713; &nbsp;<a href="#" onclick="clearApiKey();return false">Change API key</a></span>
    </div>`;
  } else {
    el.innerHTML = `<div class="api-banner">
      <span>Enter your Anthropic API key to enable AI summarization &amp; SF note generation.
      <a href="https://console.anthropic.com/api-keys" target="_blank">Get a key ↗</a></span>
      <input type="password" id="api-key-input" placeholder="sk-ant-..." onchange="saveApiKeyInput()">
    </div>`;
  }
}
function saveApiKeyInput() {
  const v = document.getElementById('api-key-input')?.value?.trim();
  if (v) { setApiKey(v); renderDigest(); }
}
function clearApiKey() {
  localStorage.removeItem(API_KEY_KEY);
  renderDigest();
}

// ── Metrics ───────────────────────────────────────────────
function renderMetrics() {
  const active = opps.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');
  const totalVal = active.reduce((s,o) => s + (parseFloat(o.value)||0), 0);
  const overdue = active.filter(o => isOverdue(o.followup)).length;
  const won = opps.filter(o => o.stage === 'Closed Won').length;
  document.getElementById('metrics-row').innerHTML = `
    <div class="metric-card"><div class="metric-label">Active opportunities</div><div class="metric-val">${active.length}</div></div>
    <div class="metric-card"><div class="metric-label">Pipeline value</div><div class="metric-val">$${(totalVal/1000).toFixed(0)}k</div></div>
    <div class="metric-card"><div class="metric-label">Overdue follow-ups</div><div class="metric-val" style="color:${overdue>0?'var(--red)':'inherit'}">${overdue}</div></div>
    <div class="metric-card"><div class="metric-label">Closed won</div><div class="metric-val" style="color:var(--teal)">${won}</div></div>
  `;
}

// ── Digest ────────────────────────────────────────────────
function renderDigest() {
  renderMetrics();
  renderApiBanner('digest-api-banner');

  const pending = opps
    .filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost' && (o.followup || o.nextStep))
    .sort((a,b) => {
      if (!a.followup && b.followup) return 1;
      if (a.followup && !b.followup) return -1;
      return (a.followup||'').localeCompare(b.followup||'');
    });

  const list = document.getElementById('digest-list');
  if (!pending.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x25A1;</div><div>No pending actions. Add opportunities to get started.</div></div>';
    return;
  }

  list.innerHTML = pending.map(o => {
    const d = daysUntil(o.followup);
    let urgency = '', dotColor = 'var(--text-tertiary)';
    if (o.followup) {
      if (d < 0)    { urgency = `<span class="overdue">Overdue ${Math.abs(d)}d</span>`; dotColor = 'var(--red)'; }
      else if (d===0){ urgency = `<span class="due-today">Due today</span>`; dotColor = 'var(--amber-mid)'; }
      else if (d<=3) { urgency = `<span class="due-soon">In ${d}d</span>`; dotColor = 'var(--amber-mid)'; }
      else           { urgency = `<span style="color:var(--text-tertiary)">In ${d}d (${fmtDate(o.followup)})</span>`; }
    }
    return `<div class="digest-item">
      <div class="digest-dot" style="background:${dotColor}"></div>
      <div class="digest-body">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="digest-name">${esc(o.name)}</span>
          ${badge(o.stage)}
          ${urgency}
        </div>
        ${o.nextStep ? `<div class="digest-sub">Next: ${esc(o.nextStep)}</div>` : ''}
        ${o.contact ? `<div class="digest-date">${esc(o.contact)}</div>` : ''}
      </div>
      <button class="btn btn-sm" onclick="selectAndView('${o.id}')">View</button>
    </div>`;
  }).join('');
}

// ── Pipeline ──────────────────────────────────────────────
function renderPipeline() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  const sort = document.getElementById('sort-select')?.value || 'name';

  // stage chips
  const filters = ['All', ...STAGES];
  document.getElementById('stage-filter').innerHTML = filters.map(f =>
    `<button class="filter-chip${stageFilter===f?' active':''}" onclick="setFilter('${f}')">${f}</button>`
  ).join('');

  let list = [...opps];
  if (stageFilter !== 'All') list = list.filter(o => o.stage === stageFilter);
  if (q) list = list.filter(o =>
    o.name.toLowerCase().includes(q) ||
    (o.contact||'').toLowerCase().includes(q) ||
    (o.notes||'').toLowerCase().includes(q)
  );
  if (sort === 'value') list.sort((a,b) => (parseFloat(b.value)||0) - (parseFloat(a.value)||0));
  else if (sort === 'due') list.sort((a,b) => (a.followup||'9999').localeCompare(b.followup||'9999'));
  else if (sort === 'stage') list.sort((a,b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  else list.sort((a,b) => a.name.localeCompare(b.name));

  const container = document.getElementById('opp-list');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No opportunities match your search</div>';
    return;
  }
  container.innerHTML = list.map(o => `
    <div class="opp-card${selectedId===o.id?' selected':''}" onclick="renderDetail('${o.id}')">
      <div class="opp-header">
        <span class="opp-name">${esc(o.name)}</span>
        ${badge(o.stage)}
      </div>
      <div class="opp-meta">
        ${o.value ? `<span>$${Number(o.value).toLocaleString()}</span>` : ''}
        ${o.contact ? `<span>${esc(o.contact)}</span>` : ''}
        ${o.followup ? `<span class="${isOverdue(o.followup)?'overdue':''}">&#x25CF; ${fmtDate(o.followup)}</span>` : ''}
      </div>
    </div>`).join('');
}

function setFilter(f) { stageFilter = f; renderPipeline(); }

function selectAndView(id) {
  selectedId = id;
  showPanel('pipeline');
  renderPipeline();
  renderDetail(id);
}

// ── Detail Panel ──────────────────────────────────────────
function renderDetail(id) {
  selectedId = id;
  const o = opps.find(x => x.id === id);
  if (!o) return;

  // highlight in list
  document.querySelectorAll('.opp-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.opp-card').forEach(c => {
    if (c.getAttribute('onclick')?.includes(id)) c.classList.add('selected');
  });

  const activities = (o.activities || []).slice().reverse();
  const checks = o.nextSteps || [];

  document.getElementById('detail-panel').innerHTML = `
    <div class="detail-header">
      <span class="detail-name">${esc(o.name)}</span>
      ${badge(o.stage)}
      <button class="btn btn-sm" onclick="openEditModal('${o.id}')">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="deleteOpp('${o.id}')">Delete</button>
    </div>

    <div class="detail-meta-grid">
      ${o.contact ? `<div class="detail-meta-item"><span class="detail-meta-label">Contact:</span><span>${esc(o.contact)}</span></div>` : ''}
      ${o.value ? `<div class="detail-meta-item"><span class="detail-meta-label">Value:</span><span>$${Number(o.value).toLocaleString()}</span></div>` : ''}
      ${o.close ? `<div class="detail-meta-item"><span class="detail-meta-label">Close:</span><span>${fmtDate(o.close)}</span></div>` : ''}
      ${o.followup ? `<div class="detail-meta-item"><span class="detail-meta-label">Follow-up:</span><span class="${isOverdue(o.followup)?'overdue':''}">${fmtDate(o.followup)}</span></div>` : ''}
      ${o.notes ? `<div class="detail-meta-item" style="grid-column:1/-1"><span class="detail-meta-label">Notes:</span><span>${esc(o.notes)}</span></div>` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Next steps checklist</div>
      <div id="checklist-${id}">
        ${checks.length ? checks.map((s,i) => `
          <div class="checklist-item${s.done?' done':''}">
            <input type="checkbox" ${s.done?'checked':''} onchange="toggleCheck('${id}',${i})">
            <span>${esc(s.text)}</span>
            <button class="rm-btn" onclick="removeCheck('${id}',${i})" title="Remove">&times;</button>
          </div>`).join('') : '<div style="font-size:12px;color:var(--text-tertiary)">No steps yet</div>'}
      </div>
      <div class="next-step-row">
        <input type="text" id="ns-input-${id}" placeholder="Add next step..." onkeydown="if(event.key==='Enter')addCheck('${id}')">
        <button class="btn btn-sm btn-primary" onclick="addCheck('${id}')">Add</button>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Log activity / meeting notes</div>
      <textarea id="log-input-${id}" placeholder="Paste raw meeting notes, call summary, or any activity..."></textarea>
      <div class="log-actions">
        <button class="btn btn-sm btn-primary" onclick="logActivity('${id}', false)">Log note</button>
        <button class="btn btn-sm" onclick="logActivity('${id}', true)">&#x2728; AI summarize</button>
        <button class="btn btn-sm" onclick="genSfUpdate('${id}')">&#x25A0; SF update note</button>
      </div>
      <div id="ai-out-${id}"></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Activity history (${activities.length})</div>
      ${activities.length ? activities.map(a => `
        <div class="activity-item">
          <div class="activity-meta">
            ${a.ai ? '<span class="badge badge-ai" style="font-size:10px">AI</span>' : ''}
            <span style="font-size:12px">${esc(a.summary || a.raw)}</span>
          </div>
          ${a.summary && a.raw !== a.summary ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">Raw: ${esc(a.raw.slice(0,80))}${a.raw.length>80?'…':''}</div>` : ''}
          <div class="activity-date">${a.date}</div>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-tertiary)">No activities yet</div>'}
    </div>
  `;
}

// ── Checklist ops ─────────────────────────────────────────
function addCheck(id) {
  const inp = document.getElementById('ns-input-' + id);
  const txt = inp.value.trim();
  if (!txt) return;
  const o = opps.find(x => x.id === id);
  if (!o.nextSteps) o.nextSteps = [];
  o.nextSteps.push({ text: txt, done: false });
  saveData(); inp.value = ''; renderDetail(id);
}
function toggleCheck(id, i) {
  const o = opps.find(x => x.id === id);
  o.nextSteps[i].done = !o.nextSteps[i].done;
  saveData(); renderDetail(id);
}
function removeCheck(id, i) {
  const o = opps.find(x => x.id === id);
  o.nextSteps.splice(i, 1);
  saveData(); renderDetail(id);
}

// ── AI calls ──────────────────────────────────────────────
async function callClaude(systemPrompt, userContent) {
  const key = getApiKey();
  if (!key) throw new Error('No API key. Please enter your Anthropic API key above.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function logActivity(id, doAI) {
  const inp = document.getElementById('log-input-' + id);
  const raw = inp.value.trim();
  if (!raw) return;
  const o = opps.find(x => x.id === id);
  if (!o.activities) o.activities = [];
  const outEl = document.getElementById('ai-out-' + id);

  if (doAI) {
    outEl.innerHTML = `<div class="ai-box"><span class="spinner"></span>Summarizing with AI...</div>`;
    try {
      const summary = await callClaude(
        'You are a sales assistant. Given raw meeting or call notes, produce a concise structured summary with: 1) Key discussion points (2-3 bullets) 2) Decisions made 3) Action items. Keep it under 150 words. Plain text, no markdown headers, use dashes for bullets.',
        raw
      );
      o.activities.push({ date: today(), raw, summary, ai: true });
      saveData();
      outEl.innerHTML = `<div class="ai-label">AI Summary</div><div class="ai-box">${esc(summary)}</div>`;
      inp.value = '';
      renderDetail(id);
    } catch(e) {
      outEl.innerHTML = `<div class="ai-box" style="color:var(--red)">${esc(e.message)}</div>`;
    }
  } else {
    o.activities.push({ date: today(), raw, ai: false });
    saveData(); inp.value = ''; outEl.innerHTML = '';
    renderDetail(id);
  }
}

async function genSfUpdate(id) {
  const o = opps.find(x => x.id === id);
  const recentActs = (o.activities || []).slice(-3).map(a => a.summary || a.raw).join('\n---\n');
  if (!recentActs) { alert('Log some activities first before generating an SF note.'); return; }
  const outEl = document.getElementById('ai-out-' + id);
  outEl.innerHTML = `<div class="ai-box"><span class="spinner"></span>Generating Salesforce note...</div>`;
  try {
    const sf = await callClaude(
      'You are a Salesforce CRM assistant. Given recent sales activity notes, produce a Salesforce activity note in this exact format:\nDATE: [date]\nACTIVITY TYPE: [Call/Meeting/Email]\nSUMMARY: [1-2 sentences]\nNEXT STEP: [specific action, with date if known]\n\nUnder 80 words. Professional. CRM-ready.',
      `Account: ${o.name}\nStage: ${o.stage}\nContact: ${o.contact||'N/A'}\nRecent activities:\n${recentActs}\nNext step on file: ${o.nextStep||'None'}`
    );
    outEl.innerHTML = `<div class="ai-label" style="margin-top:10px">Salesforce-ready note — copy &amp; paste directly</div><div class="sf-box">${esc(sf)}</div>`;
  } catch(e) {
    outEl.innerHTML = `<div class="ai-box" style="color:var(--red)">${esc(e.message)}</div>`;
  }
}

// ── Activity Log ──────────────────────────────────────────
function renderLog() {
  const all = [];
  opps.forEach(o => (o.activities||[]).forEach(a => all.push({ ...a, oppName: o.name, oppId: o.id })));
  all.sort((a,b) => b.date.localeCompare(a.date));
  const el = document.getElementById('global-log');
  el.innerHTML = all.length ? all.map(a => `
    <div class="activity-item">
      <div class="activity-meta">
        <span class="activity-opp">${esc(a.oppName)}</span>
        ${a.ai ? '<span class="badge badge-ai" style="font-size:10px">AI</span>' : ''}
      </div>
      <div style="font-size:13px;color:var(--text)">${esc(a.summary || a.raw)}</div>
      <div class="activity-date">${a.date}</div>
    </div>`).join('')
    : '<div class="empty-state">No activities logged yet</div>';
}

// ── Modal ─────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add opportunity';
  ['name','contact','value','nextstep','notes'].forEach(f => document.getElementById('f-'+f).value = '');
  document.getElementById('f-stage').value = 'Prospecting';
  document.getElementById('f-close').value = '';
  document.getElementById('f-followup').value = '';
  document.getElementById('f-edit-id').value = '';
  document.getElementById('add-modal').classList.remove('hidden');
  document.getElementById('f-name').focus();
}
function openEditModal(id) {
  const o = opps.find(x => x.id === id);
  if (!o) return;
  document.getElementById('modal-title').textContent = 'Edit opportunity';
  document.getElementById('f-name').value = o.name;
  document.getElementById('f-contact').value = o.contact || '';
  document.getElementById('f-value').value = o.value || '';
  document.getElementById('f-stage').value = o.stage;
  document.getElementById('f-close').value = o.close || '';
  document.getElementById('f-followup').value = o.followup || '';
  document.getElementById('f-nextstep').value = o.nextStep || '';
  document.getElementById('f-notes').value = o.notes || '';
  document.getElementById('f-edit-id').value = id;
  document.getElementById('add-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('add-modal').classList.add('hidden'); }

function saveOpp() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { alert('Account name is required'); return; }
  const editId = document.getElementById('f-edit-id').value;
  const data = {
    name,
    contact: document.getElementById('f-contact').value.trim(),
    value: document.getElementById('f-value').value,
    stage: document.getElementById('f-stage').value,
    close: document.getElementById('f-close').value,
    followup: document.getElementById('f-followup').value,
    nextStep: document.getElementById('f-nextstep').value.trim(),
    notes: document.getElementById('f-notes').value.trim()
  };
  if (editId) {
    Object.assign(opps.find(x => x.id === editId), data);
  } else {
    opps.push({ ...data, id: uid(), activities: [], nextSteps: [] });
  }
  saveData(); closeModal();
  const activePanel = document.querySelector('.panel.active')?.id;
  if (activePanel === 'panel-pipeline') { renderPipeline(); if (editId && selectedId === editId) renderDetail(editId); }
  else renderDigest();
}

function deleteOpp(id) {
  if (!confirm('Delete this opportunity? This cannot be undone.')) return;
  opps = opps.filter(x => x.id !== id);
  saveData(); selectedId = null;
  document.getElementById('detail-panel').innerHTML = `
    <div class="empty-state" style="padding-top:4rem">
      <div class="empty-icon">&#x25A1;</div>
      <div>Select an opportunity to view details</div>
    </div>`;
  renderPipeline(); renderDigest();
}

// ── Export Markdown ───────────────────────────────────────
function exportMd() {
  const active = opps.filter(o => o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');
  const lines = [
    '# Sales Dashboard', '',
    `_Exported: ${today()}_`, '',
    '## Summary', '',
    `- Active opportunities: ${active.length}`,
    `- Pipeline value: $${active.reduce((s,o) => s+(parseFloat(o.value)||0),0).toLocaleString()}`,
    `- Overdue follow-ups: ${active.filter(o => isOverdue(o.followup)).length}`,
    `- Closed won (all time): ${opps.filter(o=>o.stage==='Closed Won').length}`,
    '', '---', '', '## Opportunities', ''
  ];
  opps.forEach(o => {
    lines.push(`### ${o.name}`, '');
    lines.push(`- **Stage:** ${o.stage}`);
    if (o.contact) lines.push(`- **Contact:** ${o.contact}`);
    if (o.value) lines.push(`- **Value:** $${Number(o.value).toLocaleString()}`);
    if (o.close) lines.push(`- **Close date:** ${fmtDate(o.close)}`);
    if (o.followup) lines.push(`- **Follow-up:** ${fmtDate(o.followup)}${isOverdue(o.followup)?' ⚠️ OVERDUE':''}`);
    if (o.nextStep) lines.push(`- **Next step:** ${o.nextStep}`);
    if (o.notes) lines.push('', '**Notes:**', '', o.notes);
    if (o.nextSteps?.length) {
      lines.push('', '**Checklist:**', '');
      o.nextSteps.forEach(s => lines.push(`- [${s.done?'x':' '}] ${s.text}`));
    }
    if (o.activities?.length) {
      lines.push('', '**Activity log:**', '');
      o.activities.slice().reverse().forEach(a => {
        lines.push(`_${a.date}${a.ai?' · AI summary':''}_`, '');
        lines.push(a.summary || a.raw, '');
      });
    }
    lines.push('---', '');
  });
  download(`sales-dashboard-${today()}.md`, lines.join('\n'), 'text/markdown');
}

function exportJson() {
  download(`sales-dashboard-backup-${today()}.json`, JSON.stringify(opps, null, 2), 'application/json');
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      if (!confirm(`Import ${imported.length} opportunities? This will merge with existing data.`)) return;
      const existingIds = new Set(opps.map(o => o.id));
      imported.forEach(o => { if (!existingIds.has(o.id)) opps.push(o); });
      saveData(); renderDigest();
      alert(`Imported successfully. Total: ${opps.length} opportunities.`);
    } catch(err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // inject API banner placeholder into digest card
  const digestCard = document.querySelector('#panel-digest .card');
  const banner = document.createElement('div');
  banner.id = 'digest-api-banner';
  digestCard.parentNode.insertBefore(banner, digestCard);

  // nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => showPanel(tab.dataset.panel));
  });

  // search & sort
  document.getElementById('search-input').addEventListener('input', renderPipeline);
  document.getElementById('sort-select').addEventListener('change', renderPipeline);

  // buttons
  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-export-md').addEventListener('click', exportMd);
  document.getElementById('btn-export-json').addEventListener('click', exportJson);
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', saveOpp);

  // close modal on overlay click
  document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-modal')) closeModal();
  });

  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); openAddModal();
    }
  });

  renderDigest();
});
