/* Sprout app shell — full customer-journey routing, live EIR/DSR calc, PWA registration.
   Flow mirrors the design gallery:
   onboard → create → otp → login → role → home → estimate → products → calc →
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
    estimate: ['How much can I borrow?', 'Indicative estimate'],
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

  // ---- occupation typeahead (income step) ----
  var occList = document.getElementById('occList');
  if (occList) {
    occList.addEventListener('click', function (e) {
      var o = e.target.closest('.occ'); if (!o) return;
      occList.querySelectorAll('.occ').forEach(function (x) { x.classList.remove('on'); });
      o.classList.add('on');
      document.getElementById('occField').value = o.dataset.occ;
    });
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

  // ---- borrowing estimate (live DSR + power) ----
  var estIncome = document.getElementById('estIncome');
  var estDebt = document.getElementById('estDebt');
  function estimate() {
    var inc = Math.max(1, +(estIncome.value || 0));
    var existing = +(estDebt.value || 0);
    // headroom to the 70% DSR cap, capitalised over a 36-mo @ nominal rate, capped at the ceiling
    var headroom = Math.max(0, inc * 0.70 - existing);
    var iM = NOMINAL_ANNUAL / 12, n = 36;
    var power = headroom * (1 - Math.pow(1 + iM, -n)) / iM;
    power = Math.min(LIMIT, Math.max(0, Math.round(power / 5000) * 5000));
    var dsrNow = Math.round(existing / inc * 100);
    setText('estPower', baht(power));
    setText('estDsrBadge', 'DSR ' + dsrNow + '%');
    setText('estDsrLabel', dsrNow + '% / 70%');
    var bar = document.getElementById('estDsrBar');
    if (bar) bar.style.width = Math.min(100, Math.round(dsrNow / 70 * 100)) + '%';
    var cap = document.getElementById('estCapBadge');
    if (cap) { cap.textContent = dsrNow <= 70 ? 'Within 70% cap' : 'Over 70% cap'; cap.className = 'badge ' + (dsrNow <= 70 ? 'ok' : 'red'); }
  }
  if (estIncome && estDebt) { [estIncome, estDebt].forEach(function (el) { el.addEventListener('input', estimate); }); estimate(); }

  // ---- pre-screening animation, then auto-route to status ----
  var psRan = false;
  function runPrescreen() {
    var ring = document.getElementById('psRing');
    var pct = document.getElementById('psPct');
    var items = document.querySelectorAll('#psList .psitem');
    if (!ring) return;
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

  // PWA service worker (works in browser; ignored harmlessly inside WebView)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js').catch(function () {});
    });
  }
})();
