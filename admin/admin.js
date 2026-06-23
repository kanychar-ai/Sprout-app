/* Sprout back office — manage the loan-product catalogue in Supabase.
   Auth: Supabase email/password. Writes are gated by RLS (authenticated only). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const C = window.SPROUT_CONFIG || {};
const sb = createClient(C.supabaseUrl, C.supabaseKey);

const $ = (id) => document.getElementById(id);
const FIELDS = ['name', 'tag', 'tag_class', 'description', 's1l', 's1v', 's2l', 's2v', 'sort'];

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
  $('topActions').hidden = !signedIn;
  if (signedIn) { loadProducts(); loadRules(); }
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
  fatca:        { type: 'toggle', note: 'Pass only when the FATCA / CRS question has been answered (Yes or No).' },
  credit_score: { type: 'number', field: 'min_score', label: 'Minimum score' },
  income:       { type: 'number', field: 'min_income', label: 'Minimum monthly income (THB)' },
  dsr:          { type: 'number', field: 'max_dsr', label: 'Maximum DSR (%)' },
  nationality:  { type: 'toggle', note: 'Pass only Thai nationals / residents.' }
};

let rulesCache = [];

async function loadRules() {
  msg($('rulesMsg'), '', 'err');
  const { data, error } = await sb.from('prescreen_rules').select('*').order('sort', { ascending: true });
  if (error) {
    msg($('rulesMsg'), 'Could not load rules: ' + error.message + ' — have you run supabase/prescreen.sql?');
    $('rulesList').innerHTML = '';
    return;
  }
  rulesCache = data || [];
  renderRules();
}

function renderRules() {
  const host = $('rulesList');
  host.innerHTML = '';
  if (!rulesCache.length) {
    host.innerHTML = '<div class="muted tiny">No rules yet — run supabase/prescreen.sql to seed them.</div>';
    return;
  }
  rulesCache.forEach((r) => {
    const meta = RULE_META[r.key] || { type: 'toggle' };
    const cfg = r.config || {};
    const card = document.createElement('div');
    card.className = 'rule' + (r.enabled ? '' : ' off');
    card.dataset.key = r.key;

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
        '<label class="bo-switch"><input type="checkbox" class="rule-on"' + (r.enabled ? ' checked' : '') + '><span class="track"></span></label>' +
        '<b>' + esc(r.label) + '</b><span class="tiny muted">' + esc(r.key) + '</span>' +
      '</div><div class="rule-cfg">' + editor + '</div>';

    card.querySelector('.rule-on').addEventListener('change', (e) => {
      card.classList.toggle('off', !e.target.checked);
    });
    host.appendChild(card);
  });
}

async function saveRules() {
  const rows = [];
  document.querySelectorAll('#rulesList .rule').forEach((card) => {
    const key = card.dataset.key;
    const src = rulesCache.find((x) => x.key === key) || {};
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
    rows.push({ key: key, label: src.label, enabled: enabled, config: config, sort: src.sort });
  });
  $('rulesSave').disabled = true;
  const { error } = await sb.from('prescreen_rules').upsert(rows, { onConflict: 'key' });
  $('rulesSave').disabled = false;
  if (error) { msg($('rulesMsg'), 'Save failed: ' + error.message); return; }
  toast('Pre-screening rules saved'); loadRules();
}
function numOrNull(v) { return v === '' || v == null ? null : (parseInt(v, 10) || 0); }

$('rulesSave').addEventListener('click', saveRules);

refresh();
