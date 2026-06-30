/* Sprout back office — manage the loan-product catalogue in Supabase.
   Auth: Supabase email/password. Writes are gated by RLS (authenticated only). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const C = window.SPROUT_CONFIG || {};
const sb = createClient(C.supabaseUrl, C.supabaseKey);

const $ = (id) => document.getElementById(id);
const FIELDS = ['name', 'tag', 'tag_class', 'description', 's1l', 's1v', 's2l', 's2v', 'sort'];
let productNames = [];   // active+inactive product names, for the rule "applies to" dropdown

function msg(el, text, kind) {
  el.textContent = text; el.className = 'bo-msg ' + (kind || 'err'); el.hidden = !text;
}
function toast(t) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---- auth ------------------------------------------------------------------
async function refresh() {
  const { data } = await sb.auth.getSession();
  const signedIn = !!(data && data.session);
  $('loginView').hidden = signedIn;
  $('managerView').hidden = !signedIn;
  $('sidebar').hidden = !signedIn;
  $('topActions').hidden = !signedIn;
  if (signedIn) {
    const email = (data.session.user && data.session.user.email) || '';
    $('sideName').textContent = email;
    $('sideAv').textContent = (email[0] || '?').toUpperCase();
    loadProducts(); loadRules(); loadDocReqs(); loadStaff(); loadBureau();
  }
}

$('loginBtn').addEventListener('click', async () => {
  msg($('loginMsg'), '', 'err');
  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(), password: $('password').value
  });
  if (error) { msg($('loginMsg'), error.message); return; }
  refresh();
});
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
$('logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); refresh(); });

// ---- list ------------------------------------------------------------------
async function loadProducts() {
  msg($('listMsg'), '', 'err');
  const { data, error } = await sb.from('products').select('*').order('sort', { ascending: true });
  if (error) { msg($('listMsg'), 'Could not load: ' + error.message); return; }
  productNames = (data || []).map((p) => p.name);
  refreshRulesUI();   // refresh the product picker + rule cards now product names are known
  $('countLabel').textContent = (data.length || 0) + ' product' + (data.length === 1 ? '' : 's');
  const list = $('list');
  list.innerHTML = '';
  if (!data.length) { list.innerHTML = '<div class="muted tiny">No products yet — add one.</div>'; return; }
  data.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'prow' + (p.active ? '' : ' off');
    row.innerHTML =
      '<div class="grip">#' + p.sort + '</div>' +
      '<div class="meta"><b>' + esc(p.name) + '</b>' +
        (p.tag ? ' <span class="badge ' + esc(p.tag_class) + '">' + esc(p.tag) + '</span>' : '') +
        '<div class="sub">' + esc(p.description || '') + (p.active ? '' : ' · hidden') + '</div></div>' +
      '<div class="acts"></div>';
    const acts = row.querySelector('.acts');
    const edit = document.createElement('button');
    edit.className = 'btn ghost sm'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => openForm(p));
    acts.appendChild(edit);
    list.appendChild(row);
  });
}

// ---- form ------------------------------------------------------------------
function openForm(p) {
  p = p || {};
  $('formTitle').textContent = p.id ? 'Edit product' : 'New product';
  $('f_id').value = p.id || '';
  $('f_name').value = p.name || '';
  $('f_tag').value = p.tag || '';
  $('f_tag_class').value = p.tag_class || 'ghost';
  $('f_description').value = p.description || '';
  $('f_s1l').value = p.stat1_label || '';
  $('f_s1v').value = p.stat1_value || '';
  $('f_s2l').value = p.stat2_label || '';
  $('f_s2v').value = p.stat2_value || '';
  $('f_sort').value = p.id ? p.sort : '';
  $('f_featured').checked = !!p.featured;
  $('f_active').checked = p.id ? !!p.active : true;
  $('deleteBtn').hidden = !p.id;
  msg($('formMsg'), '', 'err');
  $('overlay').hidden = false;
}
function closeForm() { $('overlay').hidden = true; }
$('closeForm').addEventListener('click', closeForm);
$('addBtn').addEventListener('click', () => openForm(null));
$('overlay').addEventListener('click', (e) => { if (e.target === $('overlay')) closeForm(); });

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('f_id').value;
  const sortVal = $('f_sort').value;
  const record = {
    name: $('f_name').value.trim(),
    tag: $('f_tag').value.trim() || null,
    tag_class: $('f_tag_class').value,
    description: $('f_description').value.trim() || null,
    stat1_label: $('f_s1l').value.trim() || null,
    stat1_value: $('f_s1v').value.trim() || null,
    stat2_label: $('f_s2l').value.trim() || null,
    stat2_value: $('f_s2v').value.trim() || null,
    featured: $('f_featured').checked,
    active: $('f_active').checked,
    sort: sortVal === '' ? 0 : parseInt(sortVal, 10) || 0
  };
  if (!record.name) { msg($('formMsg'), 'Name is required.'); return; }
  $('saveBtn').disabled = true;
  const q = id
    ? sb.from('products').update(record).eq('id', id)
    : sb.from('products').insert(record);
  const { error } = await q;
  $('saveBtn').disabled = false;
  if (error) { msg($('formMsg'), error.message); return; }
  closeForm(); toast(id ? 'Saved' : 'Product added'); loadProducts();
});

$('deleteBtn').addEventListener('click', async () => {
  const id = $('f_id').value;
  if (!id || !confirm('Delete this product permanently?')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { msg($('formMsg'), error.message); return; }
  closeForm(); toast('Deleted'); loadProducts();
});

// ---- tabs ------------------------------------------------------------------
document.querySelectorAll('.bo-tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.bo-tab').forEach((x) => x.classList.toggle('on', x === t));
    document.querySelectorAll('.bo-panel').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  });
});

// ---- pre-screening rules ---------------------------------------------------
// these option lists mirror the customer application dropdowns (income step)
const OCCUPATIONS = ['Engineer', 'Civil Engineer', 'Electrical Engineer', 'Software Developer',
  'Teacher', 'Nurse', 'Doctor', 'Accountant', 'Sales Representative', 'Government Officer',
  'Business Owner', 'Student', 'Driver', 'Farmer', 'Police Officer'];
const PAY_TYPES = ['Payroll', 'Self-employed', 'Freelance', 'Business owner', 'Daily wage', 'Commission', 'Other'];

// editor metadata per rule key (the DB stores only key/label/enabled/config/sort)
const RULE_META = {
  age:          { type: 'range',  unit: 'years' },
  gender:       { type: 'multi',  options: ['male', 'female'] },
  occupation:   { type: 'multi',  options: OCCUPATIONS },
  paytype:      { type: 'multi',  options: PAY_TYPES },
  documents:    { type: 'toggle', note: 'Pass only when every required document has been uploaded.' },
  fatca:        { type: 'multi',  options: ['Yes', 'No'] },
  credit_score: { type: 'number', field: 'min_score', label: 'Minimum score' },
  income:       { type: 'number', field: 'min_income', label: 'Minimum monthly income (THB)' },
  dsr:          { type: 'number', field: 'max_dsr', label: 'Maximum DSR (%)' },
  nationality:  { type: 'toggle', note: 'Pass only Thai nationals / residents.' }
};

let rulesCache = [];        // ALL rows: every product's set + the '' default set
let rulesProduct = '';      // which product's set is being edited ('' = default)

async function loadRules() {
  msg($('rulesMsg'), '', 'err');
  const { data, error } = await sb.from('prescreen_rules').select('*').order('sort', { ascending: true });
  if (error) {
    msg($('rulesMsg'), 'Could not load rules: ' + error.message + ' — have you run supabase/prescreen.sql?');
    $('rulesList').innerHTML = '';
    return;
  }
  rulesCache = data || [];
  refreshRulesUI();
}

// keep the product dropdown and the rule cards in sync
function refreshRulesUI() {
  const sel = $('ruleProductSel');
  if (sel) {
    sel.innerHTML = productNames.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    // rules are set per product: default to the first product, keep selection if still valid
    if (productNames.indexOf(rulesProduct) === -1) rulesProduct = productNames[0] || '';
    sel.value = rulesProduct;
  }
  renderRules();
}

function renderRules() {
  const host = $('rulesList');
  host.innerHTML = '';
  const base = rulesCache.filter((r) => r.product === '');   // canonical checks (keys, labels, order)
  if (!base.length) {
    host.innerHTML = '<div class="muted tiny">No rules yet — run supabase/prescreen.sql to seed them.</div>';
    return;
  }
  const hint = $('ruleProductHint');
  if (!productNames.length) {
    host.innerHTML = '<div class="muted tiny">Add a product first, then set up its screening rules.</div>';
    if (hint) hint.textContent = '';
    return;
  }
  const hasOwn = rulesCache.some((r) => r.product === rulesProduct);
  if (hint) hint.textContent = hasOwn
    ? '✏️ Editing ' + rulesProduct + '’s rules.'
    : 'New — pre-filled from a sensible default. Save to create ' + rulesProduct + '’s rules.';

  base.forEach((type) => {
    const meta = RULE_META[type.key] || { type: 'toggle' };
    // effective values: this product's own row if it has one, otherwise the default row
    const own = rulesProduct ? rulesCache.find((r) => r.product === rulesProduct && r.key === type.key) : type;
    const eff = own || type;
    const cfg = eff.config || {};
    const card = document.createElement('div');
    card.className = 'rule' + (eff.enabled ? '' : ' off');
    card.dataset.key = type.key;

    let editor = '';
    if (meta.type === 'range') {
      editor = '<label class="label">Allowed range (' + (meta.unit || '') + ')</label>' +
        '<div class="rule-opts"><label>Min <input class="field rule-num" data-cfg="min" type="number" value="' + (cfg.min ?? '') + '"></label>' +
        '<label>Max <input class="field rule-num" data-cfg="max" type="number" value="' + (cfg.max ?? '') + '"></label></div>';
    } else if (meta.type === 'number') {
      editor = '<label class="label">' + esc(meta.label || 'Value') + '</label>' +
        '<input class="field rule-num" data-cfg="' + meta.field + '" type="number" value="' + (cfg[meta.field] ?? '') + '">';
    } else if (meta.type === 'multi') {
      const allowed = Array.isArray(cfg.allowed) ? cfg.allowed : [];
      editor = '<label class="label">Allowed values (only these pass)</label><div class="rule-opts">' +
        meta.options.map((o) =>
          '<label><input type="checkbox" data-opt="' + esc(o) + '"' + (allowed.indexOf(o) !== -1 ? ' checked' : '') + '> ' + esc(o) + '</label>'
        ).join('') + '</div>';
    } else {
      editor = '<div class="tiny muted">' + esc(meta.note || 'No extra settings.') + '</div>';
    }

    card.innerHTML =
      '<div class="rule-head">' +
        '<label class="bo-switch"><input type="checkbox" class="rule-on"' + (eff.enabled ? ' checked' : '') + '><span class="track"></span></label>' +
        '<b>' + esc(type.label) + '</b><span class="tiny muted">' + esc(type.key) + '</span>' +
      '</div><div class="rule-cfg">' + editor + '</div>';

    card.querySelector('.rule-on').addEventListener('change', (e) => card.classList.toggle('off', !e.target.checked));
    host.appendChild(card);
  });
}

async function saveRules() {
  const base = rulesCache.filter((r) => r.product === '');
  const rows = [];
  document.querySelectorAll('#rulesList .rule').forEach((card) => {
    const key = card.dataset.key;
    const type = base.find((x) => x.key === key) || {};
    const meta = RULE_META[key] || { type: 'toggle' };
    const enabled = card.querySelector('.rule-on').checked;
    let config = {};
    if (meta.type === 'range') {
      config = { min: numOrNull(card.querySelector('[data-cfg="min"]').value), max: numOrNull(card.querySelector('[data-cfg="max"]').value) };
    } else if (meta.type === 'number') {
      config = {}; config[meta.field] = numOrNull(card.querySelector('[data-cfg="' + meta.field + '"]').value);
    } else if (meta.type === 'multi') {
      config = { allowed: Array.from(card.querySelectorAll('[data-opt]:checked')).map((c) => c.dataset.opt) };
    }
    rows.push({ product: rulesProduct, key: key, label: type.label, enabled: enabled, config: config, sort: type.sort });
  });
  $('rulesSave').disabled = true;
  const { error } = await sb.from('prescreen_rules').upsert(rows, { onConflict: 'product,key' });
  $('rulesSave').disabled = false;
  if (error) { msg($('rulesMsg'), 'Save failed: ' + error.message); return; }
  toast(rulesProduct ? ('Saved rules for ' + rulesProduct) : 'Saved default rules'); loadRules();
}
function numOrNull(v) { return v === '' || v == null ? null : (parseInt(v, 10) || 0); }

$('rulesSave').addEventListener('click', saveRules);
$('rulesReset').addEventListener('click', () => { loadRules(); toast('Reverted to saved rules'); });
$('ruleProductSel').addEventListener('change', (e) => { rulesProduct = e.target.value; renderRules(); });

// ---- document requirements -------------------------------------------------
let docsCache = [];
let docsDeleted = [];

async function loadDocReqs() {
  msg($('docsMsg'), '', 'err');
  const { data, error } = await sb.from('doc_requirements').select('*').order('sort', { ascending: true });
  if (error) {
    msg($('docsMsg'), 'Could not load: ' + error.message + ' — have you run supabase/documents.sql?');
    $('docReqList').innerHTML = '';
    return;
  }
  docsCache = data || [];
  docsDeleted = [];
  renderDocReqs();
}

function renderDocReqs() {
  const host = $('docReqList');
  host.innerHTML = '';
  if (!docsCache.length) {
    host.innerHTML = '<div class="muted tiny">No documents yet — run supabase/documents.sql, or add one.</div>';
    return;
  }
  docsCache.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'drow' + (d.active === false ? ' off' : '');
    card.dataset.i = i;
    const req = d.requirement || 'required';
    card.innerHTML =
      '<div class="drow-top">' +
        '<input class="field d-label" placeholder="Document name" value="' + esc(d.label || '') + '" style="flex:1">' +
        '<label class="bo-switch"><input type="checkbox" class="d-active"' + (d.active === false ? '' : ' checked') + '><span class="track"></span></label>' +
      '</div>' +
      '<div class="drow-grid">' +
        '<div style="flex:2"><input class="field d-desc" placeholder="Short description" value="' + esc(d.description || '') + '"></div>' +
        '<div style="flex:0 0 auto"><div class="seg-req">' +
          '<button type="button" data-req="required" class="' + (req === 'required' ? 'on' : '') + '">Required</button>' +
          '<button type="button" data-req="optional" class="' + (req === 'optional' ? 'on' : '') + '">Optional</button>' +
        '</div></div>' +
        '<div style="flex:0 0 auto"><button type="button" class="btn ghost sm danger d-del">Delete</button></div>' +
      '</div>';
    // requirement segmented control
    card.querySelectorAll('.seg-req button').forEach((b) => b.addEventListener('click', () => {
      card.querySelectorAll('.seg-req button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    card.querySelector('.d-active').addEventListener('change', (e) => card.classList.toggle('off', !e.target.checked));
    card.querySelector('.d-del').addEventListener('click', () => {
      if (d.key) docsDeleted.push(d.key);
      docsCache.splice(i, 1); renderDocReqs();
    });
    host.appendChild(card);
  });
}

function slugKey(label) {
  return (label || 'doc').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'doc';
}

async function saveDocReqs() {
  const cards = Array.from(document.querySelectorAll('#docReqList .drow'));
  const rows = cards.map((card, i) => {
    const src = docsCache[i] || {};
    const label = card.querySelector('.d-label').value.trim() || 'Document';
    const reqBtn = card.querySelector('.seg-req button.on');
    return {
      key: src.key || (slugKey(label) + '_' + Date.now().toString(36)),
      label: label,
      description: card.querySelector('.d-desc').value.trim() || null,
      icon: src.icon || '📄',
      requirement: reqBtn ? reqBtn.dataset.req : 'required',
      source: src.source || 'upload',
      active: card.querySelector('.d-active').checked,
      sort: i + 1
    };
  });
  $('docsSave').disabled = true;
  if (docsDeleted.length) {
    const { error: delErr } = await sb.from('doc_requirements').delete().in('key', docsDeleted);
    if (delErr) { $('docsSave').disabled = false; msg($('docsMsg'), 'Delete failed: ' + delErr.message); return; }
  }
  const { error } = await sb.from('doc_requirements').upsert(rows, { onConflict: 'key' });
  $('docsSave').disabled = false;
  if (error) { msg($('docsMsg'), 'Save failed: ' + error.message); return; }
  toast('Document requirements saved'); loadDocReqs();
}

$('docAdd').addEventListener('click', () => {
  docsCache.push({ key: '', label: '', description: '', requirement: 'required', source: 'upload', active: true, sort: docsCache.length + 1 });
  renderDocReqs();
});
$('docsSave').addEventListener('click', saveDocReqs);

// ---- staff roles -----------------------------------------------------------
let staffCache = [];
let staffDeleted = [];
const ROLE_COLOR = { reviewer: 'info', approver: 'lime', admin: 'amber' };

async function loadStaff() {
  msg($('staffMsg'), '', 'err');
  const { data, error } = await sb.from('staff_roles').select('*').order('role');
  if (error) { msg($('staffMsg'), 'Could not load: ' + error.message + ' — run supabase/staff.sql + staff_admin.sql'); $('staffList').innerHTML = ''; return; }
  staffCache = data || []; staffDeleted = [];
  renderStaff();
}
function renderStaff() {
  const host = $('staffList'); host.innerHTML = '';
  if (!staffCache.length) { host.innerHTML = '<div class="muted tiny">No staff yet — add a reviewer or approver.</div>'; return; }
  staffCache.forEach((s, i) => {
    const card = document.createElement('div'); card.className = 'srow'; card.dataset.i = i;
    card.innerHTML =
      '<div style="flex:1.4"><label class="label">Email (login)</label><input class="field s-email" type="email" value="' + esc(s.email || '') + '" placeholder="person@company.com"></div>' +
      '<div style="flex:1.2"><label class="label">Name</label><input class="field s-name" value="' + esc(s.name || '') + '"></div>' +
      '<div style="flex:0 0 150px"><label class="label">Role</label><select class="field s-role">' +
        ['officer', 'manager'].map((r) => '<option value="' + r + '"' + (s.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
      '<div style="flex:0 0 auto"><button type="button" class="btn ghost sm danger s-del">Delete</button></div>';
    card.querySelector('.s-del').addEventListener('click', () => {
      if (s.email) staffDeleted.push(s.email);
      staffCache.splice(i, 1); renderStaff();
    });
    host.appendChild(card);
  });
}
async function saveStaff() {
  const rows = [];
  let bad = false;
  document.querySelectorAll('#staffList .srow').forEach((card) => {
    const email = card.querySelector('.s-email').value.trim().toLowerCase();
    if (!email) return;
    if (email.indexOf('@') === -1) bad = true;
    rows.push({
      email: email, name: card.querySelector('.s-name').value.trim() || null,
      role: card.querySelector('.s-role').value
    });
  });
  if (bad) { msg($('staffMsg'), 'Each staff member needs a valid email.'); return; }
  $('staffSave').disabled = true;
  if (staffDeleted.length) {
    const { error: de } = await sb.from('staff_roles').delete().in('email', staffDeleted);
    if (de) { $('staffSave').disabled = false; msg($('staffMsg'), 'Delete failed: ' + de.message); return; }
  }
  const { error } = await sb.from('staff_roles').upsert(rows, { onConflict: 'email' });
  $('staffSave').disabled = false;
  if (error) { msg($('staffMsg'), 'Save failed: ' + error.message); return; }
  toast('Staff roles saved'); loadStaff();
}
$('staffAdd').addEventListener('click', () => { staffCache.push({ email: '', name: '', role: 'officer' }); renderStaff(); });
$('staffSave').addEventListener('click', saveStaff);

// ---- credit bureau ---------------------------------------------------------
let bureauCache = [];
let bureauDeleted = [];
let bureauSort = 'national_id';   // national_id | first_name | last_name

async function loadBureau() {
  msg($('bureauMsg'), '', 'err');
  const { data, error } = await sb.from('credit_bureau').select('*');
  if (error) { msg($('bureauMsg'), 'Could not load: ' + error.message); $('bureauList').innerHTML = ''; return; }
  bureauCache = data || []; bureauDeleted = [];
  renderBureau();
}
function renderBureau() {
  const host = $('bureauList'); host.innerHTML = '';
  if (!bureauCache.length) { host.innerHTML = '<div class="muted tiny">No records yet — add a National ID and its score.</div>'; return; }
  // sort a display copy by the chosen field; keep editing live against the cache objects
  const view = bureauCache.slice().sort((a, b) =>
    String(a[bureauSort] || '').localeCompare(String(b[bureauSort] || ''), undefined, { numeric: true, sensitivity: 'base' }));
  // column headers once at the top
  host.innerHTML =
    '<div class="bhead"><span>National ID</span><span>First name</span><span>Last name</span><span>Credit score</span><span></span></div>';
  view.forEach((b) => {
    const row = document.createElement('div'); row.className = 'brow';
    row.innerHTML =
      '<input class="field b-nid" value="' + esc(b.national_id || '') + '" placeholder="1-2345-67890-12-3">' +
      '<input class="field b-first" value="' + esc(b.first_name || '') + '" placeholder="First">' +
      '<input class="field b-last" value="' + esc(b.last_name || '') + '" placeholder="Last">' +
      '<input class="field b-score" type="number" inputmode="numeric" placeholder="e.g. 650" value="' + (b.score ?? '') + '">' +
      '<button type="button" class="btn ghost sm danger b-del">Delete</button>';
    // live-sync edits back to the cache object so re-sorting keeps changes
    row.querySelector('.b-nid').addEventListener('input', (e) => { b.national_id = e.target.value; });
    row.querySelector('.b-first').addEventListener('input', (e) => { b.first_name = e.target.value; });
    row.querySelector('.b-last').addEventListener('input', (e) => { b.last_name = e.target.value; });
    row.querySelector('.b-score').addEventListener('input', (e) => { b.score = e.target.value; });
    row.querySelector('.b-del').addEventListener('click', () => {
      if (b.national_id) bureauDeleted.push(b.national_id);
      const idx = bureauCache.indexOf(b); if (idx > -1) bureauCache.splice(idx, 1);
      renderBureau();
    });
    host.appendChild(row);
  });
}
async function saveBureau() {
  const rows = [];
  let bad = false;
  bureauCache.forEach((b) => {
    const nid = String(b.national_id || '').trim();
    if (!nid) return;
    const score = parseInt(b.score, 10);
    if (isNaN(score)) bad = true;
    const first = String(b.first_name || '').trim(), last = String(b.last_name || '').trim();
    rows.push({
      national_id: nid, first_name: first || null, last_name: last || null,
      name: (first + ' ' + last).trim() || null, score: isNaN(score) ? 0 : score
    });
  });
  if (bad) { msg($('bureauMsg'), 'Each record needs a numeric score.'); return; }
  $('bureauSave').disabled = true;
  if (bureauDeleted.length) {
    const { error: de } = await sb.from('credit_bureau').delete().in('national_id', bureauDeleted);
    if (de) { $('bureauSave').disabled = false; msg($('bureauMsg'), 'Delete failed: ' + de.message); return; }
  }
  const { error } = await sb.from('credit_bureau').upsert(rows, { onConflict: 'national_id' });
  $('bureauSave').disabled = false;
  if (error) { msg($('bureauMsg'), 'Save failed: ' + error.message); return; }
  toast('Credit bureau saved'); loadBureau();
}
$('bureauAdd').addEventListener('click', () => { bureauCache.push({ national_id: '', first_name: '', last_name: '', score: '' }); renderBureau(); });
$('bureauSort').addEventListener('change', (e) => { bureauSort = e.target.value; renderBureau(); });
$('bureauSave').addEventListener('click', saveBureau);

refresh();
