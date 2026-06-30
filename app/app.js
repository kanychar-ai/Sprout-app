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
  var history = [];   // back stack of visited screens; last entry = current screen

  function baht(n) { return '฿' + Math.round(n).toLocaleString('en-US'); }

  function show(name, push) {
    if (!views[name]) name = 'home';
    var prev = history[history.length - 1];
    // starting a brand-new loan request from home → reset the application/case id
    if (name === 'products' && prev === 'home' && typeof resetApplication === 'function') resetApplication();
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

    // back stack: forward navigation pushes a new entry; `push === false` replaces
    // the current entry — used for the initial load, redirects off transient screens
    // (role/prescreen), and re-rendering after a back-pop — so Back always returns to
    // the real previous screen, never a loading/redirect screen.
    if (push === false) {
      if (history.length === 0) history.push(name);
      else history[history.length - 1] = name;
    } else if (history[history.length - 1] !== name) {
      history.push(name);
    }
    if (location.hash !== '#' + name) location.hash = name;
    views[name].scrollTop = 0;

    if (name === 'prescreen') { if (typeof submitCase === 'function') submitCase(); runPrescreen(); }
    if (name === 'status' && typeof renderStatusOutcome === 'function') renderStatusOutcome();
    if (typeof fillIdentity === 'function') fillIdentity();
    if (name === 'home' && typeof renderHome === 'function') renderHome();
    if (name === 'income') {
      var ie = document.getElementById('incomeEcho'), inc = document.getElementById('income');
      if (ie && inc) ie.textContent = (+inc.value || 0).toLocaleString('en-US');
    }
    if (name === 'role') setTimeout(function () { if (location.hash === '#role') show('home', false); }, 1400);
  }

  // ---- customer profile (captured at sign-up, shown on home) -----------------
  function getProfile() {
    try { return JSON.parse(localStorage.getItem('sprout_profile') || 'null'); } catch (e) { return null; }
  }
  function saveProfile(p) { try { localStorage.setItem('sprout_profile', JSON.stringify(p)); } catch (e) {} }
  function persistCustomerIncome(email, income) {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.customersApi || !email) return;
    fetch(cfg.customersApi, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, cfg.customersHeaders || {}),
      body: JSON.stringify({ email: email, income: income })
    }).catch(function () {});
  }
  // keep the saved profile's income in step with the calculator field so home updates
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'income') {
      var p = getProfile(); if (p) { p.income = +e.target.value || 0; saveProfile(p); }
    }
  });
  // on login, restore the customer's profile by email so the UI greets the right person
  function loadCustomerProfile(email, token) {
    var cfg = window.SPROUT_CONFIG || {};
    // start from at least the email so the UI never falls back to the demo identity
    var base = getProfile();
    if (!base || base.email !== email) saveProfile({ email: email, income: 0 });
    if (!cfg.customersApi) return Promise.resolve();
    var headers = Object.assign({}, cfg.customersHeaders || {});
    if (token) headers.Authorization = 'Bearer ' + token;   // authenticated → allowed to read the row
    return fetch(cfg.customersApi + '?select=*&email=eq.' + encodeURIComponent(email), { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows[0]) {
          var c = rows[0];
          saveProfile({ email: c.email, full_name: c.full_name, first_name: c.first_name,
            last_name: c.last_name, mobile: c.mobile, income: +c.income || 0 });
        }
      }).catch(function () {});
  }
  function initialsOf(name) {
    return (name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }
  // replace any hard-coded demo identity in the markup with the signed-up customer's
  function fillIdentity() {
    var p = getProfile(); if (!p) return;
    var name = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : '');
    var handle = p.email ? p.email.split('@')[0] : name;
    if (name) document.querySelectorAll('.js-cust-name').forEach(function (el) { el.textContent = name; });
    if (p.email) document.querySelectorAll('.js-cust-email').forEach(function (el) { el.textContent = p.email; });
    if (handle) document.querySelectorAll('.js-cust-handle').forEach(function (el) { el.textContent = handle; });
  }
  // home hero reflects the signed-up customer; credit is 0 until income is provided
  function renderHome() {
    var p = getProfile();
    if (!p) return;   // no signed-up profile yet → keep the static demo defaults
    var display = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : 'there');
    var nameEl = document.querySelector('.hh-name'); if (nameEl) nameEl.textContent = display;
    var avEl = document.querySelector('.hh-av'); if (avEl) avEl.textContent = initialsOf(display);
    var income = (+p.income) || 0;
    var avail = income > 0 ? Math.min(2000000, Math.round(income * 4 / 1000) * 1000) : 0;
    var amtEl = document.querySelector('.hh-amount'); if (amtEl) amtEl.textContent = '฿' + avail.toLocaleString('en-US');
    var subEl = document.querySelector('.hh-sub');
    if (subEl) subEl.innerHTML = avail > 0
      ? '<span class="pill">Pre-bureau</span> EIR from 15.99%'
      : '<span class="pill">Add income</span> to unlock your limit';
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
    if (!n || !views[n] || !views[n].hidden) return;   // ignore hashes we set ourselves
    // browser / hardware back landing on the previous screen → treat it as a back-pop
    if (history.length > 1 && history[history.length - 2] === n) { history.pop(); show(n, false); }
    else show(n);
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

  // ---- applicant inputs + credit-bureau lookup (all from what the user enters) --
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function num(id) { return +val(id) || 0; }
  function currentNID() { return val('nationalId'); }
  function ageFromDob(dob) {
    if (!dob) return 0;
    var d = new Date(dob); if (isNaN(d.getTime())) return 0;
    var now = new Date(), a = now.getFullYear() - d.getFullYear(), m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a < 0 ? 0 : a;
  }
  function computeDsr(income, debt) { return income > 0 ? Math.round(debt / income * 100) : 0; }
  // internal 0–100 score derived from the bureau score (300–900) and affordability (DSR)
  function computeScore(bureau, dsr) {
    var bNorm = bureau ? Math.max(0, Math.min(100, (bureau - 300) / 6)) : 0;
    var afford = Math.max(0, 100 - dsr);
    return Math.round(Math.max(0, Math.min(100, bNorm * 0.7 + afford * 0.3)));
  }
  function ncbFromBureau(bureau) { return !bureau ? 'no-hit' : (bureau >= 600 ? 'clear' : 'review'); }

  var bureauScore = null;     // looked up live by the entered National ID; null until found
  var bureauScoreFor = null;  // which National ID the cached score belongs to
  function loadCreditScore() {
    var cfg = window.SPROUT_CONFIG || {};
    var nid = currentNID();
    if (!cfg.creditBureauApi || !nid) { bureauScore = null; bureauScoreFor = null; return; }
    if (nid === bureauScoreFor) return;
    fetch(cfg.creditBureauApi + '?select=score&national_id=eq.' + encodeURIComponent(nid),
      { headers: cfg.creditBureauHeaders || {} })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { bureauScoreFor = nid; bureauScore = (rows && rows.length) ? rows[0].score : null; })
      .catch(function () {});
  }
  // refresh the bureau score whenever the National ID changes
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'nationalId') loadCreditScore(); });
  // pick the rule set for the chosen product: the product's own rules if it has
  // any, otherwise the shared default set (product ''); then only the enabled ones.
  function rulesForCurrentProduct() {
    var name = (typeof selectedProduct !== 'undefined' && selectedProduct) ? selectedProduct.name : null;
    var own = name ? prescreenRules.filter(function (r) { return r.product === name; }) : [];
    var base = own.length ? own : prescreenRules.filter(function (r) { return !r.product; });
    return base.filter(function (r) { return r.enabled; });
  }
  function renderPrescreenList() {
    var host = document.getElementById('psList');
    var rules = rulesForCurrentProduct();
    if (!host || !rules.length) return; // keep the static fallback
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
    var income = num('income'), debt = num('debt'), nid = currentNID();
    return {
      age: ageFromDob(val('dob')),
      gender: val('gender'),
      occupation: val('occField'),
      paytype: val('payType') || 'Payroll',
      docsComplete: true,
      compliance: complianceAnswers(),
      credit_score: (bureauScore != null ? bureauScore : 0),   // 0 when the bureau has no record (no fake score)
      income: income,
      dsr: computeDsr(income, debt),
      thai: !!nid                                              // treat as Thai resident once an ID is provided
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
    var rules = rulesForCurrentProduct();
    if (!rules.length) return { ok: true, fails: [] };
    var p = buildProfile();
    var fails = rules.filter(function (r) { return ruleFails(r, p); });
    return { ok: fails.length === 0, fails: fails };
  }

  // paint the status card in one of four states
  function paintStatus(kind, opts) {
    opts = opts || {};
    var card = document.getElementById('statusCard'); if (!card) return;
    var head = document.getElementById('statusHead'), badge = document.getElementById('statusBadge');
    var amt = document.getElementById('statusAmt'), terms = document.getElementById('statusTerms');
    var reasons = document.getElementById('statusReasons'), cta = document.getElementById('statusCta');
    var step = document.getElementById('statusStep'), dot = document.getElementById('statusDot');
    reasons.hidden = true; amt.hidden = false; terms.hidden = false;
    if (kind === 'approved') {
      card.style.background = 'var(--ok-bg)'; card.style.borderColor = 'var(--ok)';
      head.textContent = '🎉 Approved'; head.style.color = 'var(--ok)';
      badge.textContent = 'Offer ready'; badge.className = 'badge ok';
      cta.textContent = 'Accept & continue'; cta.className = 'btn lime sm mt12'; cta.dataset.go = 'repay';
      step.textContent = 'Approved · 15:40'; dot.style.background = 'var(--ok)';
    } else if (kind === 'disbursed') {
      card.style.background = 'var(--ok-bg)'; card.style.borderColor = 'var(--ok)';
      head.textContent = '💸 Funds on the way'; head.style.color = 'var(--ok)';
      badge.textContent = 'Disbursed'; badge.className = 'badge ok';
      terms.textContent = 'Your loan has been disbursed to your bank account.';
      cta.textContent = 'Back to home'; cta.className = 'btn ghost sm mt12'; cta.dataset.go = 'home';
      step.textContent = 'Disbursed'; dot.style.background = 'var(--ok)';
    } else if (kind === 'declined') {
      card.style.background = 'var(--soft-red-bg)'; card.style.borderColor = 'var(--soft-red)';
      head.textContent = '✕ Not approved'; head.style.color = 'var(--soft-red)';
      badge.textContent = 'Declined'; badge.className = 'badge red';
      amt.hidden = true; terms.textContent = "We're unable to approve this application right now.";
      reasons.hidden = false; reasons.innerHTML = '<b>Reason:</b> ' + String(opts.reason || 'Did not meet our current lending criteria.').replace(/[<>&]/g, '');
      cta.textContent = 'Back to home'; cta.className = 'btn ghost sm mt12'; cta.dataset.go = 'home';
      step.textContent = 'Not approved · 15:40'; dot.style.background = 'var(--soft-red)';
    } else { // review
      card.style.background = 'var(--amber-bg)'; card.style.borderColor = 'var(--amber)';
      head.textContent = '⏳ Under review'; head.style.color = 'var(--amber)';
      badge.textContent = 'In review'; badge.className = 'badge amber';
      amt.hidden = true; terms.textContent = "An officer is reviewing your application — we'll notify you when there's a decision.";
      if (opts.reasons && opts.reasons.length) {
        reasons.hidden = false;
        reasons.innerHTML = '<b>Being reviewed:</b> ' + opts.reasons.map(function (n) { return String(n).replace(/[<>&]/g, ''); }).join(', ');
      }
      cta.textContent = 'Refresh status'; cta.className = 'btn ghost sm mt12'; cta.removeAttribute('data-go'); cta.dataset.refresh = '1';
      step.textContent = 'Under review · 14:05'; dot.style.background = 'var(--amber)';
    }
  }

  // read the real case from the back office (officer decision), else fall back to
  // the local rule evaluation
  function fetchCase() {
    var cfg = window.SPROUT_CONFIG || {};
    var id = null;
    try { id = window.localStorage && localStorage.getItem('sprout_case'); } catch (e) {}
    if (!cfg.casesApi || !id) return Promise.resolve(null);
    return fetch(cfg.casesApi + '?id=eq.' + encodeURIComponent(id) + '&select=status,decision_reason', { headers: cfg.casesHeaders || {} })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return (rows && rows[0]) || null; })
      .catch(function () { return null; });
  }
  function renderStatusOutcome() {
    if (!document.getElementById('statusCard')) return;
    // show the real case number (matches what the officer sees)
    var cid; try { cid = window.localStorage && localStorage.getItem('sprout_case'); } catch (e) {}
    if (cid) { var st = document.getElementById('subtitle'); if (st) st.textContent = '#' + cid; }
    // 1) paint immediately from the local rule evaluation (instant, works offline)
    var res = evaluateApplication();
    if (res.ok) paintStatus('approved');
    else paintStatus('review', { reasons: res.fails.map(function (r) { return PS_LABELS[r.key] || r.label || r.key; }) });
    // 2) then override with the real officer decision from the back office when it loads
    fetchCase().then(function (c) {
      if (!c || !c.status) return;
      if (c.status === 'approved') paintStatus('approved');
      else if (c.status === 'rejected') paintStatus('declined', { reason: c.decision_reason });
      else if (c.status === 'disbursed') paintStatus('disbursed');
      else paintStatus('review', { reasons: ['Officer review in progress'] });
    });
  }

  // stable id for this application — shared by document uploads (docs step) and
  // the case created at submit, so the officer's docs link to the right case
  function getCaseId() {
    var id = null;
    try { id = window.localStorage && localStorage.getItem('sprout_case'); } catch (e) {}
    if (!id) { id = 'SV' + String(Date.now()).slice(-6); try { localStorage.setItem('sprout_case', id); } catch (e) {} }
    return id;
  }
  window.SproutCaseId = getCaseId;
  // begin a fresh application: drop the previous case id so a new one is generated
  function resetApplication() {
    caseSubmitted = false;
    try { if (window.localStorage) localStorage.removeItem('sprout_case'); } catch (e) {}
  }

  // create the application case in the back office when the customer submits
  var caseSubmitted = false;
  function submitCase() {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.casesApi || caseSubmitted) return;
    caseSubmitted = true;
    var id = getCaseId();
    var amount = num('amt'), term = num('term') || 1;
    var income = num('income'), debt = num('debt'), nid = currentNID();
    var prod = (typeof selectedProduct !== 'undefined' && selectedProduct) ? selectedProduct.name : 'Personal Loan';
    var p = getProfile() || {};
    var name = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : 'Applicant');
    // monthly payment: use the calculator's figure if present, else principal / term
    var pmt = parseInt(((document.getElementById('pmt') || {}).textContent || '').replace(/[^\d]/g, ''), 10);
    var dsr = computeDsr(income, debt);
    // persist the entered income so the home limit and prescreen reflect it
    if (p.email) { p.income = income; saveProfile(p); persistCustomerIncome(p.email, income); }
    var body = {
      id: id, customer_name: name, product: prod, amount: amount, term: term,
      monthly: (pmt > 0 ? pmt : Math.round(amount / Math.max(1, term))), purpose: val('purpose') || 'Personal',
      occupation: val('occField'), employer: val('employer'), income: income, existing_debt: debt,
      phone: p.mobile || '', national_id: nid || null,
      score: computeScore(bureauScore, dsr), dsr: dsr, ncb: ncbFromBureau(bureauScore), status: 'to_review'
    };
    var headers = { 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    var extra = cfg.casesHeaders || {};
    Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
    fetch(cfg.casesApi, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (r) { if (r.ok) { try { localStorage.setItem('sprout_case', id); } catch (e) {} } })
      .catch(function () {});
  }
  window.SproutCase = { submit: submitCase }; // hook
  document.body.addEventListener('click', function (e) {
    if (e.target.closest('[data-refresh]')) renderStatusOutcome();
  });

  // ---- pre-screening animation, then auto-route to status ----
  var psRan = false;
  function runPrescreen() {
    renderPrescreenList(prescreenRules);   // reflect the chosen product before screening
    var ring = document.getElementById('psRing');
    var pct = document.getElementById('psPct');
    var items = document.querySelectorAll('#psList .psitem');
    // safety net: prescreen is an immersive screen with no back arrow, so it must
    // always move on — route to status even if the animation can't run.
    if (!ring) { setTimeout(function () { if (location.hash === '#prescreen') show('status', false); }, 1200); return; }
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
        setTimeout(function () { if (location.hash === '#prescreen') show('status', false); }, 700);
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

  // ---- real login: route staff by role, authenticate customers ---------------
  function loginSubmit() {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.supabaseUrl) { show('role'); return; } // demo/offline fallback (no backend)
    var email = ((document.getElementById('liUser') || {}).value || '').trim();
    var pass = (document.getElementById('liPass') || {}).value || '';
    if (email.indexOf('@') === -1) { showToast('Please log in with your email address'); return; }
    showToast('Signing in…');
    // 1) is this a staff account? (reviewer/approver/admin) → route to their app
    fetch(cfg.supabaseUrl + '/rest/v1/staff_roles?select=role&email=eq.' + encodeURIComponent(email), { headers: { apikey: cfg.supabaseKey } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var role = rows && rows[0] && rows[0].role, q = '?email=' + encodeURIComponent(email);
        if (role === 'admin') { location.href = '../admin/' + q; return; }
        if (role) { location.href = '../staff/' + q; return; } // any staff role → officer app
        // 2) otherwise authenticate as a customer against Supabase Auth
        fetch(cfg.supabaseUrl + '/auth/v1/token?grant_type=password', {
          method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: pass })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (res.ok && res.j.access_token) { loadCustomerProfile(email, res.j.access_token).then(function () { show('role'); }); }
            else { showToast('⚠️ Invalid email or password'); }
          });
      })
      .catch(function () { showToast('Network error — please try again'); });
  }
  var liSubmit = document.getElementById('liSubmit');
  if (liSubmit) liSubmit.addEventListener('click', loginSubmit);
  var liPassEl = document.getElementById('liPass');
  if (liPassEl) liPassEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') loginSubmit(); });

  // ---- real sign-up (create account) -----------------------------------------
  function signupSubmit() {
    var cfg = window.SPROUT_CONFIG || {};
    if (!cfg.supabaseUrl) { show('otp'); return; } // demo fallback
    var email = ((document.getElementById('suUser') || {}).value || '').trim();
    var pass = (document.getElementById('suPass') || {}).value || '';
    var first = ((document.getElementById('suFirst') || {}).value || '').trim();
    var last = ((document.getElementById('suLast') || {}).value || '').trim();
    var fullName = (first + ' ' + last).trim();
    var mobile = ((document.getElementById('suMobile') || {}).value || '').trim();
    if (email.indexOf('@') === -1) { showToast('Please enter a valid email address'); return; }
    if (pass.length < 6) { showToast('Password must be at least 6 characters'); return; }
    // remember the entered profile so the app can greet them by name (credit stays 0 until income)
    var profile = {
      email: email, full_name: fullName,
      first_name: first, last_name: last,
      mobile: mobile, income: 0
    };
    saveProfile(profile);
    if (cfg.customersApi) {
      fetch(cfg.customersApi, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, cfg.customersHeaders || {}),
        body: JSON.stringify(profile)
      }).catch(function () {});   // best-effort; the app already has the profile locally
    }
    showToast('Creating your account…');
    fetch(cfg.supabaseUrl + '/auth/v1/signup', {
      method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          var m = (res.j.msg || res.j.error_description || res.j.error || '').toLowerCase();
          if (m.indexOf('already') !== -1 || m.indexOf('registered') !== -1) showToast('⚠️ This email is already registered — please log in');
          else if (m.indexOf('rate limit') !== -1) showToast('⚠️ Too many sign-up emails — try again later (or ask us to turn off email confirmation)');
          else showToast('⚠️ ' + (res.j.msg || 'Could not create account'));
          return;
        }
        // Supabase returns identities:[] when the email already exists (even with confirm on)
        var user = res.j.user || res.j;
        if (user && Array.isArray(user.identities) && user.identities.length === 0) {
          showToast('⚠️ This email is already registered — please log in'); return;
        }
        showToast('Account created ✓'); show('otp');
      }).catch(function () { showToast('Network error — please try again'); });
  }
  var suSubmit = document.getElementById('suSubmit');
  if (suSubmit) suSubmit.addEventListener('click', signupSubmit);
  // live password-strength meter (was a fixed "Strong" before)
  var suPassEl = document.getElementById('suPass');
  if (suPassEl) suPassEl.addEventListener('input', function () {
    var v = suPassEl.value || '', s = 0;
    if (v.length >= 8) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++; if (v.length >= 12) s++;
    s = Math.min(4, s);
    var bars = document.querySelectorAll('#pwBars .pwbar');
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < s);
    var labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    var help = document.getElementById('pwHelp');
    if (help) help.textContent = v ? (labels[s] + ' · 8+ chars, number & symbol') : 'Use 8+ chars, a number & a symbol';
  });
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
