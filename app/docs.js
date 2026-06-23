/* Sprout — Documents step: upload from camera/photos/files, show the uploaded
 * file name, and preview what was uploaded. The single file input uses
 * accept="image/*,application/pdf", so on mobile the OS offers Take Photo,
 * Photo Library and Choose File in one sheet. */
(function () {
  'use strict';
  var reqs = document.getElementById('docReqs');
  if (!reqs) return;
  var fileInput = document.getElementById('docFile');
  var draftBtn = document.getElementById('docDraft');

  // requirement catalogue — loaded from the back office (doc_requirements); this
  // built-in list is the offline fallback. National ID comes from e-KYC.
  var DOCS_FALLBACK = [
    { key: 'id', name: 'National ID card', tag: '', sub: 'Added from your KYC scan', icon: '🪪', preset: true },
    { key: 'payslip', name: 'Payslip', tag: 'Required', sub: 'Most recent month', icon: '📄' },
    { key: 'statement', name: 'Bank statement', tag: 'Required', sub: 'Last 3 months', icon: '📄' },
    { key: 'passbook', name: 'Book bank', tag: 'Required', sub: 'Passbook cover · name page', icon: '📑' },
    { key: 'address', name: 'Proof of address', tag: 'Optional', sub: 'Utility bill or lease', icon: '🏠' }
  ];
  var DOCS = DOCS_FALLBACK;

  function mapDoc(r) {
    return {
      key: r.key, name: r.label, sub: r.description, icon: r.icon || '📄',
      tag: r.requirement === 'required' ? 'Required' : (r.requirement === 'optional' ? 'Optional' : ''),
      preset: r.source === 'kyc'
    };
  }
  function loadDocs() {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.docsApi) return;
    fetch(cfg.docsApi, { headers: cfg.docsHeaders || {} })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rows) { if (rows && rows.length) { DOCS = rows.map(mapDoc); render(); } })
      .catch(function () {}); // keep the fallback list
  }
  var files = {};   // key -> { name, size, type, url, isImg }
  var currentKey = null;

  function toast(m) { if (window.SproutToast) window.SproutToast(m); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtSize(b) {
    if (!b && b !== 0) return '';
    return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
  }

  function render() {
    reqs.innerHTML = '';
    DOCS.forEach(function (d) {
      var f = files[d.key];
      var done = !!f || d.preset;
      var row = document.createElement('div');
      row.className = 'docrow' + (done ? ' done' : '');
      row.dataset.key = d.key;

      var sub = f ? (esc(f.name) + (f.size ? ' · ' + fmtSize(f.size) : '') + ' · tap to preview')
                  : esc(d.sub);
      var tag = d.tag === 'Required' ? '<span class="req">Required</span>'
              : d.tag === 'Optional' ? '<span class="opt">Optional</span>' : '';
      var action = done
        ? '<button class="docrow-act del" data-act="del" aria-label="Remove">✕</button>'
        : '<button class="docrow-act" data-act="up" aria-label="Upload">⬆</button>';
      // the preset National ID has no remove button
      if (d.preset && !f) action = '<button class="docrow-act del" data-act="prev" aria-label="Preview">👁</button>';

      row.innerHTML =
        '<span class="docrow-ic">' + (done ? '✓' : d.icon) + '</span>' +
        '<div class="docrow-main"><div class="docrow-name">' + esc(d.name) + ' ' + tag + '</div>' +
        '<div class="tiny muted docrow-sub">' + sub + '</div></div>' + action;
      reqs.appendChild(row);
    });
  }

  function openPicker(key) { currentKey = key; fileInput.click(); }

  function preview(key) {
    var f = files[key];
    // National ID with no uploaded file: preview the captured KYC front, if any
    if (!f && key === 'id' && window.SproutKYC && window.SproutKYC.getShot) {
      var shot = window.SproutKYC.getShot('front');
      if (shot) { lightbox(shot, 'National ID card (front)'); return; }
      toast('National ID was captured during identity verification'); return;
    }
    if (!f) return;
    if (f.isImg && f.url) { lightbox(f.url, f.name); }
    else if (f.url) { window.open(f.url, '_blank'); }   // PDFs open in a new tab
    else { toast('Preview not available'); }
  }

  function lightbox(src, caption) {
    var lb = document.createElement('div');
    lb.className = 'id-lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="Close">✕</button>' +
      '<img src="' + src + '" alt="' + esc(caption) + '">' +
      '<div class="lb-cap">' + esc(caption) + ' — tap ✕ to close</div>';
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb-close')) lb.remove();
    });
    document.body.appendChild(lb);
  }

  function addFile(key, meta) {
    files[key] = {
      name: meta.name || 'file', size: meta.size || 0, type: meta.type || '',
      url: meta.url || null, isImg: /^image\//.test(meta.type || '')
    };
    render();
  }

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f || !currentKey) return;
    var url = (window.URL && URL.createObjectURL) ? URL.createObjectURL(f) : null;
    addFile(currentKey, { name: f.name, size: f.size, type: f.type, url: url });
    toast('📎 ' + f.name + ' uploaded');
    fileInput.value = '';
  });

  // event delegation for the per-row actions
  reqs.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    var row = e.target.closest('.docrow');
    if (!row) return;
    var key = row.dataset.key;
    if (btn) {
      var act = btn.dataset.act;
      if (act === 'up') openPicker(key);
      else if (act === 'del') { delete files[key]; render(); }
      else if (act === 'prev') preview(key);
      return;
    }
    // tapping the body of a completed row previews it
    if (row.classList.contains('done')) preview(key);
  });

  if (draftBtn) draftBtn.addEventListener('click', function () { toast('💾 Draft saved — resume anytime'); });

  render();
  loadDocs(); // override the fallback with the back-office list when available
  window.SproutDocs = { addFile: addFile, files: files }; // test/programmatic hook
})();
