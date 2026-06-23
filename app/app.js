/* Sprout app shell — full customer-journey routing, live EIR/DSR calc, PWA registration.
   Flow mirrors the design gallery:
   onboard → create → otp → login → role → home → products → calc →
   kyc → income → bank → docs → tax → esign → prescreen → status → repay (+ me)            */
(function () {
  'use strict';

  var LIMIT = 180000;          // approved indicative ceiling
  var NOMINAL_ANNUAL = 0.1599; // base nominal rate; EIR derived from compounding + fee
  var FEE = 0.005;             // small processing component folded into the effective rate

  // [title, subtitle] for the shared top bar. `null` ⇒ screen draws its own header (hero/immersive).
  var TITLES = {
    onboard:  null,
    create:   ['Create account', ''],
    otp:      ['Verify mobile', ''],
    login:    null,
    role:     null,
    home:     ['Sprout', 'Transparent lending'],
    alerts:   ['Notifications', 'Updates on your application'],
    activity: ['Recent activity', 'Your application timeline'],
    products: ['Loan products', 'Choose what fits'],
    calc:     ['EIR calculator', 'Personal Loan'],
    kyc:      ['Verify identity', 'Step 1 of 4 · e-KYC'],
    income:   ['Income', 'Step 2 of 4'],
    bank:     ['Receiving account', 'Step 3 of 4'],
    docs:     ['Documents', 'Step 4 of 4 · Upload'],
    tax:      ['Tax & compliance', 'Regulatory declarations'],
    esign:    ['Loan agreement', 'Review & e-sign'],
    prescreen:null,
    status:   ['Application status', '#SPR-240615-0291'],
    repay:    ['Repay loan', 'PromptPay QR'],
    me:       ['Profile', 'Account & settings']
  };

  // Screens that draw their own full-bleed header (no shared top bar).
  var IMMERSIVE = { home: 1, onboard: 1, login: 1, role: 1, prescreen: 1 };
  // Screens that show the bottom tab bar (the "app" surfaces, not the linear flow).
  var SHOW_NAV  = { home: 1, calc: 1, status: 1, repay: 1, me: 1 };
  // Which bottom-tab is highlighted for a given view.
  var NAV_FOR   = { home: 'home', calc: 'calc', status: 'status', repay: 'status', me: 'me' };

  var views = {};
  document.querySelectorAll('.view').forEach(function (v) { views[v.dataset.view] = v; });
  var navBtns = Array.prototype.slice.call(document.querySelectorAll('.app-nav button'));
  var nav = document.querySelector('.app-nav');
  var title = document.getElementById('title');
  var subtitle = document.getElementById('subtitle');
  var back = document.getElementById('back');
  var shell = document.getElementById('shell');
  var history = ['home'];

  function baht(n) { return '฿' + Math.round(n).toLocaleString('en-US'); }

  function show(name, push) {
    if (!views[name]) name = 'home';
    Object.keys(views).forEach(function (k) { views[k].hidden = (k !== name); });

    var immersive = !!IMMERSIVE[name];
    shell.classList.toggle('immersive', immersive);
    nav.style.display = SHOW_NAV[name] ? '' : 'none';
    navBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.go === NAV_FOR[name]); });

    if (TITLES[name]) {
      title.textContent = TITLES[name][0];
      subtitle.textContent = TITLES[name][1];
      subtitle.style.display = TITLES[name][1] ? '' : 'none';
    }
    back.hidden = immersive;   // hero screens own their navigation; flow screens get a back arrow

    if (push !== false) { if (history[history.length - 1] !== name) history.push(name); }
    if (location.hash !== '#' + name) location.hash = name;
    views[name].scrollTop = 0;

    if (name === 'prescreen') runPrescreen();
    if (name === 'status' && typeof renderStatusOutcome === 'function') renderStatusOutcome();
    if (name === 'role') setTimeout(function () { if (location.hash === '#role') show('home'); }, 1400);
  }

  // navigation wiring (data-go on any element)
  document.body.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t && !t.disabled) { show(t.dataset.go); }
  });
  back.addEventListener('click', function () {
    history.pop();
    show(history[history.length - 1] || 'home', false);
  });
  window.addEventListener('hashchange', function () {
    var n = location.hash.replace('#', '');
    if (n && views[n] && views[n].hidden) show(n);
  });

  // ---- consent / accept checkboxes ----
  document.querySelectorAll('[data-toggle]').forEach(function (el) {
    el.addEventListener('click', function () { el.querySelector('.ck').classList.toggle('on'); });
  });

  // ---- segmented Yes/No toggles (tax & compliance) ----
  document.querySelectorAll('.seg.toggle').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  });

  // ---- OTP entry: auto-advance + countdown ----
  var otpRow = document.getElementById('otpRow');
  if (otpRow) {
    var boxes = Array.prototype.slice.call(otpRow.querySelectorAll('.otp-box'));
    boxes.forEach(function (box, i) {
      box.addEventListener('input', function () {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
    });
    var t = 24, timer = document.getElementById('otpTimer');
    setInterval(function () {
      if (t > 0) t--;
      timer.textContent = '0:' + (t < 10 ? '0' : '') + t;
    }, 1000);
  }

  // ---- password show / hide toggles ----
  document.querySelectorAll('[data-eye]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = document.getElementById(btn.dataset.eye);
      if (!f) return;
      var show = f.type === 'password';
      f.type = show ? 'text' : 'password';
      btn.classList.toggle('on', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  // ---- occupation typeahead (income step) — searchable, ISCO-08 ----
  var OCCUPATIONS = [
    { name: 'Engineer', isco: 'ISCO 2140' },
    { name: 'Civil Engineer', isco: 'ISCO 2142' },
    { name: 'Electrical Engineer', isco: 'ISCO 2151' },
    { name: 'Software Developer', isco: 'ISCO 2512' },
    { name: 'Teacher', isco: 'ISCO 2330' },
    { name: 'Nurse', isco: 'ISCO 2221' },
    { name: 'Doctor', isco: 'ISCO 2211' },
    { name: 'Accountant', isco: 'ISCO 2411' },
    { name: 'Sales Representative', isco: 'ISCO 3322' },
    { name: 'Government Officer', isco: 'ISCO 3343' },
    { name: 'Business Owner', isco: 'ISCO 1120' },
    { name: 'Student', isco: 'ISCO —' },
    { name: 'Driver', isco: 'ISCO 8322' },
    { name: 'Farmer', isco: 'ISCO 6111' },
    { name: 'Police Officer', isco: 'ISCO 5412' }
  ];
  var occList = document.getElementById('occList');
  var occField = document.getElementById('occField');
  if (occList && occField) {
    var renderOcc = function () {
      var q = (occField.value || '').trim().toLowerCase();
      var matches = OCCUPATIONS.filter(function (o) { return o.name.toLowerCase().indexOf(q) !== -1; });
      occList.innerHTML = '';
      if (!matches.length) {
        occList.innerHTML = '<div class="tiny muted" style="padding:8px 10px">No match — type to search, or pick "Other".</div>';
        return;
      }
      matches.forEach(function (o) {
        var row = document.createElement('div');
        var on = o.name.toLowerCase() === q;
        row.className = 'occ' + (on ? ' on' : '');
        row.dataset.occ = o.name;
        row.innerHTML = '<b class="tiny"' + (on ? ' style="color:var(--cobalt)"' : '') + '>' + o.name + '</b>' +
          '<div class="tiny muted">' + o.isco + '</div>';
        occList.appendChild(row);
      });
      var foot = document.createElement('div');
      foot.className = 'tiny muted';
      foot.style.padding = '6px 10px 2px';
      foot.textContent = '↑ from Occupation API · ISCO-08';
      occList.appendChild(foot);
    };
    occField.addEventListener('input', renderOcc);
    occField.addEventListener('focus', renderOcc);
    occList.addEventListener('click', function (e) {
      var o = e.target.closest('.occ'); if (!o) return;
      occField.value = o.dataset.occ;
      renderOcc();
    });
    renderOcc(); // initial list (all occupations)
  }

  // ---- bank picker (receiving account step) ----
  var bankPick = document.getElementById('bankPick');
  if (bankPick) {
    bankPick.addEventListener('click', function (e) {
      var b = e.target.closest('.bank'); if (!b) return;
      bankPick.querySelectorAll('.bank').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  }

  // ---- document add (mock) ----
  document.querySelectorAll('[data-add]').forEach(function (el) {
    el.addEventListener('click', function () { showToast('📎 Document added to your application'); });
  });

  // ---- live calculator ----
  var amt = document.getElementById('amt');
  var term = document.getElementById('term');
  var income = document.getElementById('income');
  var debt = document.getElementById('debt');

  function calc() {
    var P = +amt.value;
    var n = +term.value;
    var inc = Math.max(1, +(income.value || 0));
    var existing = +(debt.value || 0);

    var iMonthly = NOMINAL_ANNUAL / 12;
    var pmt = P * iMonthly / (1 - Math.pow(1 + iMonthly, -n));
    var total = pmt * n;
    var eir = (Math.pow(1 + iMonthly, 12) - 1) + FEE; // effective annual
    var dsr = (existing + pmt) / inc;
    var overLimit = P > LIMIT;
    var overDsr = dsr > 0.70;
    var eirPct = (eir * 100).toFixed(1);

    document.getElementById('amtLabel').textContent = baht(P);
    document.getElementById('termLabel').textContent = n + ' months';
    document.getElementById('pmt').textContent = baht(pmt);
    document.getElementById('eir').textContent = eirPct + '%';
    document.getElementById('total').textContent = baht(total);

    // credit limit
    var pct = Math.min(100, Math.round(P / LIMIT * 100));
    var bar = document.getElementById('limitBar');
    var badge = document.getElementById('limitBadge');
    bar.style.width = pct + '%';
    if (overLimit) {
      bar.style.background = 'var(--soft-red)';
      badge.className = 'badge red'; badge.textContent = '✗ ' + pct + '% of ฿180k';
    } else {
      bar.style.background = 'linear-gradient(90deg,var(--cobalt),var(--lime))';
      badge.className = 'badge ok'; badge.textContent = '✓ ' + baht(P) + ' of ฿180k';
    }

    // dsr
    var dsrPct = Math.round(dsr * 100);
    var dsrBar = document.getElementById('dsrBar');
    var dsrBadge = document.getElementById('dsrBadge');
    dsrBar.style.width = Math.min(100, Math.round(dsr / 0.70 * 100)) + '%';
    dsrBadge.textContent = dsrPct + '% / 70%';
    if (overDsr) {
      dsrBar.style.background = 'var(--soft-red)';
      dsrBadge.className = 'badge red';
    } else if (dsr > 0.55) {
      dsrBar.style.background = 'linear-gradient(90deg,var(--cobalt),var(--amber))';
      dsrBadge.className = 'badge amber';
    } else {
      dsrBar.style.background = 'linear-gradient(90deg,var(--cobalt),var(--lime))';
      dsrBadge.className = 'badge ok';
    }

    // over-limit / over-dsr blocking
    var ol = document.getElementById('overLimit');
    var olMsg = document.getElementById('overLimitMsg');
    var apply = document.getElementById('applyBtn');
    if (overLimit || overDsr) {
      ol.hidden = false;
      olMsg.textContent = overLimit
        ? (baht(P) + ' exceeds your ฿180,000 ceiling by ' + baht(P - LIMIT) + '. Reduce the amount or verify higher income.')
        : ('Your DSR ' + dsrPct + '% exceeds the 70% responsible-lending cap. Reduce the amount or term.');
      apply.disabled = true; apply.textContent = overLimit ? 'Apply · over limit' : 'Apply · DSR too high';
      apply.removeAttribute('data-go');
    } else {
      ol.hidden = true;
      apply.disabled = false; apply.textContent = 'Apply · ' + baht(P);
      apply.setAttribute('data-go', 'kyc');
    }

    // sync downstream screens (e-sign, status)
    document.getElementById('statusAmt').textContent = baht(P);
    document.getElementById('statusTerms').textContent = 'EIR ' + eirPct + '% · ' + baht(pmt) + ' / mo · ' + n + ' mo';
    setText('esPrincipal', baht(P));
    setText('esEir', eirPct + '% p.a.');
    setText('esMonthly', baht(pmt) + ' × ' + n);
    setText('esTotal', baht(total));
  }
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  [amt, term, income, debt].forEach(function (el) { el.addEventListener('input', calc); });
  calc();

  // ---- loan products (data-driven; served by the back-office API) -----------
  // When the Supabase back office is wired up, window.SPROUT_CONFIG.productsApi
  // points at its REST endpoint and the same render path uses live data; until
  // then we fall back to this built-in catalogue so the app always works.
  var CFG = window.SPROUT_CONFIG || {};
  var PRODUCTS_FALLBACK = [
    { name: 'Personal Loan', tag: 'Popular', tag_class: 'lime', desc: 'Unsecured · ฿20k–฿2M · 6–60 mo',
      stat1_label: 'EIR from', stat1_value: '15.99%', stat2_label: 'Max term', stat2_value: '60 mo', featured: true },
    { name: 'Salaryman Quick', tag: 'Fast', tag_class: 'info', desc: 'For payroll customers · ฿10k–฿300k',
      stat1_label: 'EIR from', stat1_value: '18.50%', stat2_label: 'Decision', stat2_value: '~1 day' },
    { name: 'Nano / Micro', tag: 'Reg. capped', tag_class: 'ghost', desc: 'Small ticket · ≤ ฿20,000',
      stat1_label: 'EIR cap', stat1_value: '33%', stat2_label: 'Term', stat2_value: '≤ 24 mo' }
  ];
  var prodList = document.getElementById('prodList');
  var prodEmpty = document.getElementById('prodEmpty');
  var prodContinue = document.getElementById('prodContinue');
  var selectedProduct = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function selectProduct(i, cards, products) {
    selectedProduct = products[i];
    cards.forEach(function (c, j) { c.classList.toggle('sel', j === i); });
    if (prodContinue) prodContinue.textContent = 'Continue with ' + selectedProduct.name;
    setText('calcProd', selectedProduct.name + ' · EIR calculator');
  }

  function renderProducts(products) {
    if (!prodList) return;
    var list = (products || []).slice();
    prodList.innerHTML = '';
    if (prodEmpty) prodEmpty.hidden = list.length > 0;
    if (prodContinue) prodContinue.hidden = list.length === 0;
    var cards = [];
    list.forEach(function (p, i) {
      var card = document.createElement('div');
      card.className = 'card prod' + (i > 0 ? ' flat' : ''); // spacing via #prodList gap
      card.innerHTML =
        '<div class="row between"><b>' + esc(p.name) + '</b>' +
          (p.tag ? '<span class="badge ' + esc(p.tag_class || 'ghost') + '">' + esc(p.tag) + '</span>' : '') + '</div>' +
        '<div class="tiny muted mt6">' + esc(p.desc) + '</div>' +
        '<div class="row gap12 mt12">' +
          '<div><div class="tiny muted">' + esc(p.stat1_label) + '</div><div class="amount" style="font-size:20px' +
            (p.featured ? ';color:var(--cobalt)' : '') + '">' + esc(p.stat1_value) + '</div></div>' +
          '<div><div class="tiny muted">' + esc(p.stat2_label) + '</div><div class="amount" style="font-size:20px">' +
            esc(p.stat2_value) + '</div></div>' +
        '</div>';
      card.addEventListener('click', function () { selectProduct(i, cards, list); });
      prodList.appendChild(card);
      cards.push(card);
    });
    if (list.length) selectProduct(0, cards, list); // default to the first product
  }

  function loadProducts() {
    if (CFG.productsApi) {
      fetch(CFG.productsApi, { headers: CFG.productsHeaders || {} })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (rows) { renderProducts(rows && rows.length ? rows : PRODUCTS_FALLBACK); })
        .catch(function () { renderProducts(PRODUCTS_FALLBACK); });
    } else {
      renderProducts(PRODUCTS_FALLBACK);
    }
  }
  loadProducts();

  // ---- home application tracker (single source of truth) --------------------
  // The 4-step verification wizard. WIZARD_DONE = how many are completed, so the
  // home card, the "X steps left" badge and the "Continue" target all stay in
  // sync with the per-screen "Step X of 4" labels and the activity feed.
  var WIZARD = [
    { view: 'kyc',    label: 'Verify identity' },
    { view: 'income', label: 'Income' },
    { view: 'bank',   label: 'Receiving account' },
    { view: 'docs',   label: 'Upload documents' }
  ];
  var WIZARD_DONE = 1; // identity verified; customer is now on step 2 (income)

  function renderProgress() {
    var total = WIZARD.length;
    var cur = Math.min(WIZARD_DONE, total - 1); // 0-based index of the current step
    var dotsEl = document.getElementById('homeSteps');
    if (dotsEl) {
      var html = '';
      for (var i = 0; i < total; i++) {
        html += '<i class="' + (i < WIZARD_DONE ? 'done' : (i === cur ? 'on' : '')) + '"></i>';
      }
      dotsEl.innerHTML = html;
    }
    var left = total - WIZARD_DONE;
    setText('homeStepsLeft', left + (left === 1 ? ' step left' : ' steps left'));
    setText('homeStepMsg', 'Identity verified. Next: ' + WIZARD[cur].label.toLowerCase() +
      ' (step ' + (cur + 1) + ' of ' + total + ') to turn your indicative offer into a real one.');
    var btn = document.getElementById('homeContinue');
    if (btn) {
      btn.textContent = 'Continue · Step ' + (cur + 1) + ' of ' + total;
      btn.dataset.go = WIZARD[cur].view;
    }
  }
  renderProgress();

  // ---- pre-screening checklist driven by back-office rules -----------------
  // customer-friendly wording for each enabled rule; falls back to the static
  // list in the HTML if the rules can't be loaded.
  var PS_LABELS = {
    age: 'Confirming your age', gender: 'Checking eligibility',
    occupation: 'Reviewing your occupation', paytype: 'Reviewing your income type',
    documents: 'Checking your documents', fatca: 'Tax declaration (FATCA / CRS)',
    credit_score: 'Checking your credit history', income: 'Verifying your income',
    dsr: "Making sure it's affordable", nationality: 'Confirming residency'
  };
  var prescreenRules = [];   // enabled rules (with config) loaded from the back office
  function renderPrescreenList(rules) {
    var host = document.getElementById('psList');
    if (!host || !rules || !rules.length) return; // keep the static fallback
    host.innerHTML = '';
    rules.forEach(function (r) {
      var label = String(PS_LABELS[r.key] || r.label || r.key).replace(/[<>&]/g, '');
      var div = document.createElement('div');
      div.className = 'row gap10 psitem';
      div.style.fontSize = '13px';
      div.innerHTML = '<span class="dot"></span> ' + label + ' <span class="psck">…</span>';
      host.appendChild(div);
    });
  }
  function loadPrescreenRules() {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.prescreenApi) return;
    fetch(cfg.prescreenApi, { headers: cfg.prescreenHeaders || {} })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rows) { prescreenRules = rows || []; renderPrescreenList(rows); })
      .catch(function () {}); // keep static fallback on any failure
  }
  loadPrescreenRules();
  window.SproutPrescreen = { render: renderPrescreenList, evaluate: evaluateApplication,
    setRules: function (r) { prescreenRules = r || []; } }; // test hook

  // ---- evaluation: check the customer's answers against the enabled rules ----
  // Real inputs are read live (FATCA/CRS answers, occupation, pay type); the rest
  // use a sensible mock profile so the demo only flips to "Under review" when an
  // actual answer breaks a rule.
  function complianceAnswers() {
    var out = [];
    document.querySelectorAll('[data-view="tax"] .seg.toggle').forEach(function (seg) {
      var on = seg.querySelector('button.on');
      out.push(on ? on.textContent.trim() : 'No');
    });
    return out; // [US person, tax resident outside TH, PEP]
  }
  function buildProfile() {
    var occ = (document.getElementById('occField') || {}).value || 'Engineer';
    var pay = (document.getElementById('payType') || {}).value || 'Payroll';
    return {
      age: 32, gender: 'male', occupation: occ, paytype: pay, docsComplete: true,
      compliance: complianceAnswers(), credit_score: 720, income: 45000, dsr: 19, thai: true
    };
  }
  function hasList(c) { return c && Array.isArray(c.allowed) && c.allowed.length; }
  function ruleFails(rule, p) {
    var c = rule.config || {};
    switch (rule.key) {
      case 'age':          return !(p.age >= (c.min || 0) && p.age <= (c.max || 999));
      case 'gender':       return hasList(c) ? c.allowed.indexOf(p.gender) === -1 : false;
      case 'occupation':   return hasList(c) ? c.allowed.indexOf(p.occupation) === -1 : false;
      case 'paytype':      return hasList(c) ? c.allowed.indexOf(p.paytype) === -1 : false;
      case 'documents':    return !p.docsComplete;
      // every compliance declaration must be an allowed answer (e.g. all "Yes")
      case 'fatca':        return hasList(c) ? !p.compliance.every(function (a) { return c.allowed.indexOf(a) !== -1; }) : false;
      case 'credit_score': return c.min_score ? p.credit_score < c.min_score : false;
      case 'income':       return c.min_income ? p.income < c.min_income : false;
      case 'dsr':          return c.max_dsr ? p.dsr > c.max_dsr : false;
      case 'nationality':  return !p.thai;
      default:             return false;
    }
  }
  function evaluateApplication() {
    if (!prescreenRules || !prescreenRules.length) return { ok: true, fails: [] };
    var p = buildProfile();
    var fails = prescreenRules.filter(function (r) { return ruleFails(r, p); });
    return { ok: fails.length === 0, fails: fails };
  }

  // paint the status screen from the evaluation outcome
  function renderStatusOutcome() {
    var card = document.getElementById('statusCard');
    if (!card) return;
    var res = evaluateApplication();
    var head = document.getElementById('statusHead');
    var badge = document.getElementById('statusBadge');
    var amt = document.getElementById('statusAmt');
    var terms = document.getElementById('statusTerms');
    var reasons = document.getElementById('statusReasons');
    var cta = document.getElementById('statusCta');
    var step = document.getElementById('statusStep');
    var dot = document.getElementById('statusDot');
    if (res.ok) {
      card.style.background = 'var(--ok-bg)'; card.style.borderColor = 'var(--ok)';
      head.textContent = '🎉 Approved'; head.style.color = 'var(--ok)';
      badge.textContent = 'Offer ready'; badge.className = 'badge ok';
      amt.hidden = false; terms.hidden = false; reasons.hidden = true;
      cta.textContent = 'Accept & continue'; cta.className = 'btn lime sm mt12'; cta.dataset.go = 'repay';
      if (step) step.textContent = 'Approved · 15:40';
      if (dot) dot.style.background = 'var(--ok)';
    } else {
      card.style.background = 'var(--amber-bg)'; card.style.borderColor = 'var(--amber)';
      head.textContent = '⏳ Under review'; head.style.color = 'var(--amber)';
      badge.textContent = 'In review'; badge.className = 'badge amber';
      amt.hidden = true;
      terms.hidden = false; terms.textContent = "A few things need a closer look — an officer will review your application and we'll notify you within 1 business day.";
      var names = res.fails.map(function (r) { return PS_LABELS[r.key] || r.label || r.key; });
      reasons.hidden = false;
      reasons.innerHTML = '<b>Being reviewed:</b> ' + names.map(function (n) { return String(n).replace(/[<>&]/g, ''); }).join(', ');
      cta.textContent = 'Back to home'; cta.className = 'btn ghost sm mt12'; cta.dataset.go = 'home';
      if (step) step.textContent = 'Under review · 14:05';
      if (dot) dot.style.background = 'var(--amber)';
    }
  }

  // ---- pre-screening animation, then auto-route to status ----
  var psRan = false;
  function runPrescreen() {
    var ring = document.getElementById('psRing');
    var pct = document.getElementById('psPct');
    var items = document.querySelectorAll('#psList .psitem');
    // safety net: prescreen is an immersive screen with no back arrow, so it must
    // always move on — route to status even if the animation can't run.
    if (!ring) { setTimeout(function () { if (location.hash === '#prescreen') show('status'); }, 1200); return; }
    psRan = true;
    var p = 0, steps = items.length, done = 0;
    items.forEach(function (it) { it.querySelector('.dot').style.background = 'rgba(255,255,255,.2)'; it.querySelector('.psck').textContent = '…'; });
    var iv = setInterval(function () {
      p += 4;
      if (p > 100) p = 100;
      ring.style.background = 'conic-gradient(var(--lime) ' + p + '%, rgba(255,255,255,.15) 0)';
      pct.textContent = p + '%';
      var shouldDone = Math.floor(p / 100 * steps);
      while (done < shouldDone && done < steps) {
        var it = items[done];
        it.querySelector('.dot').style.background = 'var(--ok)';
        it.querySelector('.psck').textContent = '✓';
        it.style.color = '#dfe7f7';
        done++;
      }
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(function () { if (location.hash === '#prescreen') show('status'); }, 700);
      }
    }, 90);
  }

  // toast
  var toast = document.getElementById('toast');
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }
  window.SproutToast = showToast;   // shared with kyc.js and other modules
  var paid = document.getElementById('paidBtn');
  if (paid) paid.addEventListener('click', function () { showToast('✓ Payment received — instalment 3 marked paid'); });
  var forgot = document.getElementById('liForgot');
  if (forgot) forgot.addEventListener('click', function () { showToast('📩 Reset link sent to your registered number'); });
  document.getElementById('applyBtn').addEventListener('click', function () {
    if (!this.disabled) showToast('✓ Application started — verifying your identity');
  });

  // initial route — first run starts at onboarding; deep links honour the hash
  var start = location.hash.replace('#', '');
  show(views[start] ? start : 'onboard', false);

  // Service worker DISABLED — a previous SW caused stale builds to stick. We now
  // actively unregister any existing SW and clear its caches so every visit loads
  // the live build. (Asset URLs are versioned too.) Re-introduce a network-first
  // SW later only if offline support is needed.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
  }
  if (window.caches && caches.keys) {
    caches.keys().then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
  }
})();
