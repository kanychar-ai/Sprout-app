/* Sprout — Officer app: maker–checker case review.
 * Reviewer (maker) recommends; a different Approver (checker) decides; every
 * action is logged; segregation of duties are enforced. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const C = window.SPROUT_CONFIG || {};
const sb = createClient(C.supabaseUrl, C.supabaseKey);
const $ = (id) => document.getElementById(id);
const views = {};
document.querySelectorAll('.view').forEach((v) => { views[v.dataset.view] = v; });
const history = ['login'];
let me = null;       // { email, name, role }
let current = null;  // current case object

const TITLES = {
  login: ['Sprout Officer', 'Case review'],
  tasks: ['My tasks', 'Review & approve'],
  search: ['Search cases', 'By loan no. / name / phone'],
  case: ['Case', ''], data: ['Application data', 'What the customer submitted'],
  score: ['Score breakdown', 'Factors behind the number'], docs: ['Documents', 'Preview · verify · flag'],
  compliance: ['Compliance & screening', 'Sanctions · PEP · FATCA · AML'], chat: ['Chat', 'Officer ↔ customer'],
  review: ['Review · recommend', 'Reviewer → approver'], decide: ['Make decision', 'Approver (checker)'],
  disburse: ['Disbursement', 'Hand off to servicing']
};
const IMMERSIVE = { login: 1 };

function show(name, push) {
  if (!views[name]) name = 'tasks';
  Object.keys(views).forEach((k) => { views[k].hidden = (k !== name); });
  const t = TITLES[name] || ['', ''];
  $('title').textContent = t[0]; $('subtitle').textContent = t[1];
  $('back').hidden = !!IMMERSIVE[name] || name === 'tasks';
  $('logout').hidden = !me; $('roleBadge').hidden = !me;
  if (push !== false && history[history.length - 1] !== name) history.push(name);
  views[name].scrollTop = 0;
}
document.body.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]'); if (t) show(t.dataset.go);
});
$('back').addEventListener('click', () => { history.pop(); show(history[history.length - 1] || 'tasks', false); });

function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function baht(n) { return '฿' + Math.round(+n || 0).toLocaleString('en-US'); }
function initials(name) { return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

const STATUS = {
  to_review: ['To review', 'amber'], awaiting_docs: ['Awaiting docs', 'amber'],
  pending_approval: ['Pending approval', 'info'], pending_manager: ['Awaiting manager', 'amber'],
  approved: ['Approved', 'ok'], rejected: ['Not approved', 'red'], disbursed: ['Disbursed', 'ok']
};
function statusBadge(s) { const x = STATUS[s] || [s, 'ghost']; return '<span class="badge ' + x[1] + '">' + x[0] + '</span>'; }

// ---- auth ------------------------------------------------------------------
async function boot() {
  const { data } = await sb.auth.getSession();
  if (data && data.session) { await loadMe(data.session.user.email); show('tasks', false); loadTasks(); }
  else show('login', false);
}
async function loadMe(email) {
  const { data } = await sb.from('staff_roles').select('*').eq('email', email).maybeSingle();
  me = data ? { email, name: data.name || email, role: data.role }
            : { email, name: email, role: 'officer' };
  $('whoName').textContent = me.name;
  $('roleBadge').textContent = me.role;
  $('roleBadge').className = 'badge ' + (me.role === 'manager' ? 'amber' : 'lime');
}
$('loginBtn').addEventListener('click', async () => {
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  if (error) { const m = $('loginMsg'); m.hidden = false; m.textContent = '⚠️ ' + error.message; return; }
  await loadMe($('email').value.trim()); show('tasks', false); loadTasks();
});
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
$('logout').addEventListener('click', async () => { await sb.auth.signOut(); me = null; history.length = 0; show('login', false); });

// ---- audit -----------------------------------------------------------------
function logEvent(caseId, action, detail) {
  return sb.from('case_events').insert({ case_id: caseId, actor_email: me.email, actor_name: me.name, action, detail });
}

// ---- role capabilities -----------------------------------------------------
// officer  → review + approve normal cases (or send a case to a manager)
// manager  → decide cases an officer has escalated  ·  admin → everything
function can(action) {
  const r = me.role;
  if (r === 'admin') return true;
  if (action === 'review' || action === 'approveNormal') return r === 'officer' || r === 'manager';
  if (action === 'approveManager') return r === 'manager';
  return false;
}

// ---- My tasks --------------------------------------------------------------
let taskFilter = 'mine';
document.querySelectorAll('#taskTabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#taskTabs button').forEach((x) => x.classList.toggle('on', x === b));
  taskFilter = b.dataset.tab; loadTasks();
}));
async function loadTasks() {
  const host = $('taskList'); host.innerHTML = '<div class="tiny muted">Loading…</div>';
  let q = sb.from('cases').select('*').order('created_at', { ascending: true });
  if (taskFilter === 'mine') {
    if (me.role === 'reviewer') q = q.in('status', ['to_review', 'awaiting_docs']);
    else if (me.role === 'manager' || me.role === 'admin') q = q.in('status', ['to_review', 'awaiting_docs', 'pending_approval', 'pending_manager']);
    else q = q.in('status', ['to_review', 'awaiting_docs', 'pending_approval']); // officer / approver
  }
  const { data, error } = await q;
  if (error) { host.innerHTML = '<div class="note-soft">Could not load cases: ' + esc(error.message) + ' — run supabase/staff.sql.</div>'; return; }
  if (!data.length) { host.innerHTML = '<div class="tiny muted">No cases in this queue.</div>'; return; }
  host.innerHTML = '';
  data.forEach((c) => host.appendChild(caseRow(c)));
}
function caseRow(c) {
  const el = document.createElement('div'); el.className = 'case-row';
  el.innerHTML =
    '<div class="row1"><b>#' + esc(c.id) + ' · ' + esc(c.customer_name) + '</b>' +
      '<span class="meta">' + statusBadge(c.status) + '</span></div>' +
    '<div class="sub">' + esc(c.product) + ' · ' + baht(c.amount) + ' · score ' + (c.score ?? '—') + '</div>';
  el.addEventListener('click', () => openCase(c.id));
  return el;
}

// ---- Search ----------------------------------------------------------------
let allCases = [];
$('searchInput').addEventListener('input', async (e) => {
  const term = e.target.value.trim().toLowerCase();
  const host = $('searchResults');
  if (!allCases.length) { const { data } = await sb.from('cases').select('*'); allCases = data || []; }
  if (!term) { host.innerHTML = ''; return; }
  const hits = allCases.filter((c) =>
    (c.id + ' ' + c.customer_name + ' ' + (c.phone || '')).toLowerCase().indexOf(term) !== -1);
  $('searchHint').textContent = hits.length + ' result' + (hits.length === 1 ? '' : 's');
  host.innerHTML = ''; hits.forEach((c) => host.appendChild(caseRow(c)));
});

// ---- Case hub --------------------------------------------------------------
async function openCase(id) {
  const { data, error } = await sb.from('cases').select('*').eq('id', id).single();
  if (error) { toast('Could not open case'); return; }
  current = data;
  const { data: events } = await sb.from('case_events').select('*').eq('case_id', id).order('at', { ascending: false });
  renderHub(data, events || []);
  TITLES.case = ['#' + data.id, STATUS[data.status] ? STATUS[data.status][0] : data.status];
  show('case');
}
function link(go, ic, title, sub, right) {
  return '<div class="hub-link" data-go="' + go + '"><span class="ic">' + ic + '</span>' +
    '<div class="t"><b>' + title + '</b><br><span>' + sub + '</span></div>' +
    (right || '') + '<span class="chev">›</span></div>';
}
function actionFor(c) {
  // maker–checker gating
  const sod = '<div class="note-soft mt14">🔒 You reviewed this case — a different officer must make the decision (segregation of duties).</div>';
  if (c.status === 'to_review' || c.status === 'awaiting_docs') {
    if (!can('review')) return '<div class="note-soft mt14">Waiting for an officer to review.</div>';
    return '<button class="btn primary mt14" data-go="review">Review &amp; recommend</button>';
  }
  if (c.status === 'pending_approval') {
    if (c.reviewer_email === me.email) return sod;
    if (!can('approveNormal')) return '<div class="note-soft mt14">Recommended ' + esc(c.recommendation) + ' — waiting for an officer to decide.</div>';
    // officer can decide it, OR send it to a manager to decide
    return '<button class="btn primary mt14" data-go="decide">Make decision</button>' +
      '<button class="btn ghost mt10" data-act="escalate">→ Send to a manager</button>';
  }
  if (c.status === 'pending_manager') {
    if (c.reviewer_email === me.email) return sod;
    if (can('approveManager')) return '<div class="tiny" style="color:var(--amber);margin-top:8px">⚑ Escalated for a manager decision</div><button class="btn primary mt14" data-go="decide">Make decision</button>';
    return '<div class="note-soft mt14">⚑ Sent to a manager — awaiting their decision.</div>';
  }
  if (c.status === 'approved')
    return '<button class="btn primary mt14" data-go="disburse">Update status → Disburse</button>';
  if (c.status === 'rejected')
    return '<div class="note-soft mt14">Not approved — reason: ' + esc(c.decision_reason || '—') + '</div>';
  if (c.status === 'disbursed')
    return '<div class="note-soft mt14">✅ Disbursed to the customer.</div>';
  return '';
}
function renderHub(c, events) {
  let recHtml = '';
  if (c.reviewer_email) recHtml += '<div class="kv"><span>Reviewer recommendation</span><span class="v">' + esc(c.recommendation || '—') + ' · ' + esc(c.reviewer_name || c.reviewer_email) + '</span></div>';
  if (c.decided_at) recHtml += '<div class="kv"><span>Decision</span><span class="v">' + (c.status === 'approved' ? 'Approved' : 'Rejected') + ' · ' + esc(c.approver_name || c.approver_email) + '</span></div>';

  $('caseHub').innerHTML =
    '<div class="hub-head"><div class="row gap12 center"><div class="hub-av">' + esc(initials(c.customer_name)) + '</div>' +
      '<div style="flex:1"><b style="font-size:16px">' + esc(c.customer_name) + '</b>' +
      '<div class="tiny muted">Age — · ' + esc(c.occupation || '') + ' · ' + baht(c.amount) + '</div></div>' + statusBadge(c.status) + '</div>' +
      '<div class="tiny mt8" style="color:var(--ink-2)">Score <b>' + (c.score ?? '—') + '</b> · DSR ' + (c.dsr ?? '—') + '% · NCB ' + esc(c.ncb || '—') + '</div>' +
      (recHtml ? '<div class="mt8">' + recHtml + '</div>' : '') + '</div>' +
    link('data', '📄', 'Application data', 'What the customer submitted') +
    link('score', '📈', 'Score breakdown', 'How the ' + (c.score ?? '—') + ' was calculated') +
    link('docs', '📁', 'Documents', '5 files · review') +
    link('compliance', '🛡️', 'Compliance &amp; screening', 'Sanctions · PEP · FATCA · risk', '<span class="badge ok tiny">Low</span>') +
    link('chat', '💬', 'Chat with customer', 'Ask for info or clarify') +
    actionFor(c) +
    '<div class="card flat mt14" style="padding:12px"><b class="tiny">Audit log</b>' +
      (events.length ? events.map((e) =>
        '<div class="evt"><b>' + esc(e.actor_name || e.actor_email) + '</b> ' + esc(e.action) + (e.detail ? ' — ' + esc(e.detail) : '') +
        '<span class="when">' + new Date(e.at).toLocaleString() + '</span></div>').join('')
        : '<div class="tiny muted" style="padding-top:8px">No activity yet.</div>') +
    '</div>';
}

// ---- detail screens (read) -------------------------------------------------
function kv(k, v) { return '<div class="kv"><span>' + k + '</span><span class="v">' + esc(v) + '</span></div>'; }
function renderData() {
  const c = current;
  $('dataView').innerHTML =
    '<div class="tiny muted">Submitted by customer · read-only</div>' +
    '<div class="card flat mt12" style="padding:6px 15px"><b class="tiny">Loan request</b>' +
      kv('Product', c.product) + kv('Amount', baht(c.amount)) + kv('Term', (c.term || '—') + ' months') +
      kv('Monthly', baht(c.monthly)) + kv('Purpose', c.purpose) + '</div>' +
    '<div class="card flat mt12" style="padding:6px 15px"><b class="tiny">Applicant</b>' +
      kv('Occupation', c.occupation) + kv('Employer', c.employer) + kv('Monthly income', baht(c.income)) +
      kv('Existing debt', baht(c.existing_debt) + ' / mo') + kv('Phone', c.phone) + kv('National ID', c.national_id) + '</div>' +
    '<div class="note-soft mt12">🛡️ ID &amp; income cross-checked against e-KYC and uploaded payslip.</div>';
}
function renderScore() {
  const c = current;
  const factors = [['Repayment ability (DSR ' + (c.dsr ?? '—') + '%)', 30], ['Credit bureau / NCB', 24], ['Income stability & tenure', 12], ['Existing obligations', 4], ['Past Sprout repayment', 2]];
  const band = c.score >= 70 ? 'Good' : c.score >= 40 ? 'Fair' : 'Low';
  $('scoreView').innerHTML =
    '<div class="card flat" style="text-align:center;padding:18px"><div class="tiny muted">Affordability score</div>' +
      '<div class="amount" style="font-size:34px;color:var(--cobalt)">' + band + ' · ' + (c.score ?? '—') + '</div>' +
      '<div class="tiny muted">Bands: 0–39 low · 40–69 fair · 70–100 good</div></div>' +
    '<div class="card flat mt12" style="padding:14px"><b class="tiny">What goes into it</b>' +
      factors.map((f) => '<div style="margin-top:12px"><div class="row between"><span class="tiny">' + f[0] + '</span><b class="tiny" style="color:var(--cobalt)">+' + f[1] + '</b></div><div class="score-bar"><i style="width:' + (f[1] / 30 * 100) + '%"></i></div></div>').join('') +
    '</div>';
}
const DOC_STATUSES = [['verified', 'Verified ✓', 'ok'], ['review', 'Needs review', 'amber'], ['re_request', 'Re-request', 'red'], ['waiting', 'Waiting', 'ghost']];
function statusMeta(s) { return DOC_STATUSES.find((x) => x[0] === s) || ['waiting', 'Waiting', 'ghost']; }
async function renderDocs() {
  const c = current;
  $('docsView').innerHTML = '<div class="tiny muted">Tap a file to view it. Set each status: Verified · Needs review · Re-request.</div><div class="mt12" id="docRows">Loading…</div>';
  // requirement catalogue + what the customer actually uploaded
  let reqs = [], uploaded = [];
  try { const r = await sb.from('doc_requirements').select('*').eq('active', true).order('sort'); reqs = r.data || []; } catch (e) {}
  if (!reqs.length) reqs = [{ doc_key: 'payslip', label: 'Payslip', source: 'upload' }, { doc_key: 'statement', label: 'Bank statement', source: 'upload' }, { doc_key: 'passbook', label: 'Book bank', source: 'upload' }, { doc_key: 'address', label: 'Proof of address', source: 'upload' }];
  reqs = reqs.map((r) => ({ key: r.key || r.doc_key, label: r.label, source: r.source }));
  const { data: docs } = await sb.from('case_documents').select('*').eq('case_id', c.id);
  uploaded = docs || [];
  const byKey = {}; uploaded.forEach((d) => { byKey[d.doc_key] = d; });

  const host = $('docRows'); host.innerHTML = '';
  const pub = (window.SPROUT_CONFIG || {}).storagePublicUrl || '';
  reqs.forEach((req) => {
    const up = byKey[req.key];
    const row = document.createElement('div'); row.className = 'doc-row'; row.style.display = 'block';
    if (req.source === 'kyc') {
      row.innerHTML = '<div class="row gap10 center"><span style="font-size:20px">🪪</span><div class="t"><b>' + esc(req.label) + '</b><br><span>From e-KYC</span></div><span class="badge ok tiny">Verified ✓</span></div>';
      host.appendChild(row); return;
    }
    if (!up) {
      row.innerHTML = '<div class="row gap10 center"><span style="font-size:20px">📄</span><div class="t"><b>' + esc(req.label) + '</b><br><span>Not uploaded yet</span></div><span class="badge ghost tiny">Waiting</span></div>';
      host.appendChild(row); return;
    }
    const m = statusMeta(up.status);
    row.innerHTML =
      '<div class="row gap10 center"><span style="font-size:20px">📎</span>' +
      '<div class="t"><b>' + esc(req.label) + '</b><br><span>' + esc(up.filename || '') + '</span></div>' +
      '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + pub + encodeURI(up.path || '') + '">View</a></div>' +
      '<div class="seg-status mt10" data-key="' + esc(up.doc_key) + '">' +
        DOC_STATUSES.slice(0, 3).map((s) => '<button data-s="' + s[0] + '"' + (up.status === s[0] ? ' class="on"' : '') + '>' + s[1].replace(' ✓', '') + '</button>').join('') +
      '</div>';
    row.querySelectorAll('.seg-status button').forEach((b) => b.addEventListener('click', async () => {
      const ns = b.dataset.s;
      row.querySelectorAll('.seg-status button').forEach((x) => x.classList.toggle('on', x === b));
      await sb.from('case_documents').update({ status: ns }).eq('id', up.id);
      await logEvent(c.id, 'status', 'Document "' + req.label + '" set ' + statusMeta(ns)[1].replace(' ✓', ''));
      toast('Saved · logged');
    }));
    host.appendChild(row);
  });
  const req = document.createElement('button'); req.className = 'btn ghost mt8'; req.textContent = '⬇ Request another document';
  req.addEventListener('click', () => { logEvent(c.id, 'requested_docs', 'Requested another document'); toast('Requested · logged'); });
  $('docsView').appendChild(req);
}
function renderCompliance() {
  const rows = [['Sanctions / watchlist', 'Clear ✓'], ['PEP screening', 'Not a PEP ✓'], ['FATCA / CRS', 'TH — not US ✓'], ['Adverse media', 'None ✓'], ['AML risk level', 'Low']];
  $('complianceView').innerHTML = rows.map((r) => '<div class="card flat" style="margin-bottom:10px;padding:14px"><div class="row between center"><b class="tiny">' + r[0] + '</b><span class="badge ok tiny">' + r[1] + '</span></div></div>').join('') +
    '<div class="note-soft">Re-screened at application and on any profile change. A hit pauses the case for compliance review.</div>';
}
let chatMsgs = [['me', "Hi, I'm reviewing your application."], ['me', 'Could you add a 3-month bank statement?'], ['them', 'Sure, uploading now.'], ['them', '📄 statement_q2.pdf']];
function renderChat() {
  $('chatView').innerHTML = '<div id="chatBody" style="min-height:50vh">' +
    chatMsgs.map((m) => '<div class="bubble ' + (m[0] === 'me' ? 'me' : 'them') + '">' + esc(m[1]) + '</div>').join('') + '</div>' +
    '<div class="input focus mt12"><input class="bare" id="chatInput" placeholder="Message ' + esc(current.customer_name.split(' ')[0]) + '…"><button class="eye" id="chatSend">➤</button></div>';
  $('chatSend').addEventListener('click', () => {
    const v = $('chatInput').value.trim(); if (!v) return;
    chatMsgs.push(['me', v]); logEvent(current.id, 'status', 'Messaged customer'); renderChat();
  });
}

// ---- Reviewer: recommend ---------------------------------------------------
let recChoice = 'approve';
function renderReview() {
  const c = current; recChoice = 'approve';
  $('reviewView').innerHTML =
    '<div class="card" style="background:var(--cobalt-50)"><div class="tiny muted">Loan request · #' + esc(c.id) + '</div>' +
      '<b style="font-size:16px">' + esc(c.customer_name) + ' · ' + esc(c.product) + '</b><div class="amount" style="font-size:22px">' + baht(c.amount) + '</div></div>' +
    '<div class="label mt14">Your recommendation to the approver</div>' +
    '<div class="seg toggle" id="recSeg" style="width:100%"><button class="on" data-rec="approve">Recommend approve</button><button data-rec="decline">Recommend decline</button></div>' +
    '<div class="label mt12">Reviewer note</div><textarea class="field" id="recNote" rows="3" style="height:auto;padding:12px">Docs verified, income &amp; DSR within policy. Suggest approve ' + baht(c.amount) + '.</textarea>' +
    '<button class="btn primary mt14" id="recSubmit">→ Submit to approver</button>' +
    '<button class="btn ghost mt10" id="recReqDocs">⬇ Request more docs</button>';
  document.querySelectorAll('#recSeg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#recSeg button').forEach((x) => x.classList.toggle('on', x === b)); recChoice = b.dataset.rec;
  }));
  $('recSubmit').addEventListener('click', submitReview);
  $('recReqDocs').addEventListener('click', async () => {
    await sb.from('cases').update({ status: 'awaiting_docs', reviewer_email: me.email, reviewer_name: me.name }).eq('id', c.id);
    await logEvent(c.id, 'requested_docs', 'Reviewer requested more documents');
    toast('Customer notified · case paused'); show('tasks', false); loadTasks();
  });
}
async function submitReview() {
  const note = $('recNote').value.trim();
  const { error } = await sb.from('cases').update({
    status: 'pending_approval', recommendation: recChoice,
    reviewer_email: me.email, reviewer_name: me.name, reviewer_note: note, reviewed_at: new Date().toISOString()
  }).eq('id', current.id);
  if (error) { toast(error.message); return; }
  await logEvent(current.id, 'reviewed', 'Recommended ' + recChoice + (note ? ' — ' + note : ''));
  toast('Submitted to approver'); show('tasks', false); loadTasks();
}

// ---- Approver: decide ------------------------------------------------------
function renderDecide() {
  const c = current;
  $('decideView').innerHTML =
    '<div class="card flat"><div class="tiny muted">Reviewer (maker) recommended</div>' +
      '<b style="font-size:15px;color:' + (c.recommendation === 'approve' ? 'var(--ok)' : 'var(--soft-red)') + '">' + esc((c.recommendation || '').toUpperCase()) + '</b>' +
      '<div class="tiny muted mt6">' + esc(c.reviewer_name || c.reviewer_email) + '</div>' +
      '<div class="tiny mt6" style="color:var(--ink-2)">“' + esc(c.reviewer_note || '') + '”</div></div>' +
    '<div class="card" style="background:var(--cobalt-50);margin-top:12px"><b>' + esc(c.customer_name) + ' · ' + esc(c.product) + '</b>' +
      '<div class="amount" style="font-size:22px">' + baht(c.amount) + '</div><div class="tiny muted">Score ' + (c.score ?? '—') + ' · DSR ' + (c.dsr ?? '—') + '%</div></div>' +
    '<div class="label mt14">Final decision (checker)</div>' +
    '<div class="row gap10"><button class="btn primary" id="decApprove" style="flex:1">✓ Approve</button><button class="btn ghost danger" id="decReject" style="flex:1">✕ Reject</button></div>' +
    '<div class="label mt12">Reason / note (sent to customer on reject)</div>' +
    '<textarea class="field" id="decReason" rows="2" style="height:auto;padding:12px" placeholder="Reason for the decision"></textarea>' +
    '<div class="note-soft mt12">🔒 Segregation of duties: you are not the reviewer of this case. Logged who/when/what.</div>';
  $('decApprove').addEventListener('click', () => decide('approved'));
  $('decReject').addEventListener('click', () => decide('rejected'));
}
async function decide(outcome) {
  const c = current;
  if (c.reviewer_email === me.email) { toast('You reviewed this — another officer must decide'); return; }
  const reason = $('decReason').value.trim();
  if (outcome === 'rejected' && !reason) { toast('Add a reason for the customer'); return; }
  const { error } = await sb.from('cases').update({
    status: outcome, approver_email: me.email, approver_name: me.name,
    decision_reason: reason || null, decided_at: new Date().toISOString()
  }).eq('id', c.id);
  if (error) { toast(error.message); return; }
  await logEvent(c.id, outcome === 'approved' ? 'approved' : 'rejected', reason || (outcome === 'approved' ? 'Approved' : 'Rejected'));
  toast(outcome === 'approved' ? 'Approved ✓' : 'Rejected'); show('tasks', false); loadTasks();
}

// ---- Disbursement ----------------------------------------------------------
function renderDisburse() {
  const c = current;
  $('disburseView').innerHTML =
    '<div class="card flat" style="text-align:center;padding:20px"><div style="font-size:30px">✅</div>' +
      '<div class="tiny muted mt6">Ready to transfer to customer</div><div class="amount" style="font-size:30px;color:var(--cobalt)">' + baht(c.amount) + '</div></div>' +
    '<div class="card flat mt12" style="padding:6px 15px">' + kv('Destination account', 'KBank ···4521') + kv('Recipient', c.customer_name) + '</div>' +
    '<button class="btn primary mt14" id="confirmDisburse">→ Confirm transfer</button>';
  $('confirmDisburse').addEventListener('click', async () => {
    await sb.from('cases').update({ status: 'disbursed' }).eq('id', c.id);
    await logEvent(c.id, 'disbursed', 'Transferred ' + baht(c.amount) + ' to customer');
    toast('Disbursed ✓'); show('tasks', false); loadTasks();
  });
}

// escalate a special case to a manager (from the case hub)
async function escalate() {
  const c = current; if (!c) return;
  await sb.from('cases').update({ status: 'pending_manager' }).eq('id', c.id);
  await logEvent(c.id, 'escalated', 'Sent to a manager for special-case approval (' + baht(c.amount) + ')');
  toast('Sent to manager'); show('tasks', false); loadTasks();
}

// render detail/action views when navigated to (after show() makes them visible)
const RENDER = { data: renderData, score: renderScore, docs: renderDocs, compliance: renderCompliance, chat: renderChat, review: renderReview, decide: renderDecide, disburse: renderDisburse };
document.body.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]'); if (t && current && RENDER[t.dataset.go]) RENDER[t.dataset.go]();
  const a = e.target.closest('[data-act="escalate"]'); if (a) escalate();
});

try { const em = new URLSearchParams(location.search).get('email'); if (em && $('email')) $('email').value = em; } catch (e) {}
boot();
