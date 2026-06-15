/* Sprout app shell — routing, live EIR/DSR calc, PWA registration */
(function () {
  'use strict';

  var LIMIT = 180000;          // approved indicative ceiling
  var NOMINAL_ANNUAL = 0.1599; // base nominal rate; EIR derived from compounding + fee
  var FEE = 0.005;             // small processing component folded into the effective rate

  var TITLES = {
    home:   ['Sprout', 'เงินกู้ที่โปร่งใส · transparent lending'],
    calc:   ['EIR calculator', 'Personal Loan'],
    status: ['Application status', '#SPR-240615-0291'],
    repay:  ['Repay loan', 'PromptPay QR']
  };

  var views = {};
  document.querySelectorAll('.view').forEach(function (v) { views[v.dataset.view] = v; });
  var navBtns = Array.prototype.slice.call(document.querySelectorAll('.app-nav button'));
  var title = document.getElementById('title');
  var subtitle = document.getElementById('subtitle');
  var back = document.getElementById('back');
  var history = ['home'];

  function baht(n) { return '฿' + Math.round(n).toLocaleString('en-US'); }

  function show(name, push) {
    if (!views[name]) name = 'home';
    Object.keys(views).forEach(function (k) { views[k].hidden = (k !== name); });
    navBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.go === name); });
    title.textContent = TITLES[name][0];
    subtitle.textContent = TITLES[name][1];
    if (push !== false) { if (history[history.length - 1] !== name) history.push(name); }
    back.hidden = (name === 'home');
    if (location.hash !== '#' + name) location.hash = name;
    views[name].scrollTop = 0;
  }

  // navigation wiring
  document.body.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t) { show(t.dataset.go); }
  });
  back.addEventListener('click', function () {
    history.pop();
    show(history[history.length - 1] || 'home', false);
  });
  window.addEventListener('hashchange', function () {
    var n = location.hash.replace('#', '');
    if (n && views[n] && views[n].hidden) show(n);
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

    document.getElementById('amtLabel').textContent = baht(P);
    document.getElementById('termLabel').textContent = n + ' months';
    document.getElementById('pmt').textContent = baht(pmt);
    document.getElementById('eir').textContent = (eir * 100).toFixed(1) + '%';
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
      apply.setAttribute('data-go', 'status');
    }

    // sync status + repay
    document.getElementById('statusAmt').textContent = baht(P);
    document.getElementById('statusTerms').textContent = 'EIR ' + (eir * 100).toFixed(1) + '% · ' + baht(pmt) + ' / mo · ' + n + ' mo';
  }
  [amt, term, income, debt].forEach(function (el) {
    el.addEventListener('input', calc);
  });
  calc();

  // toast
  var toast = document.getElementById('toast');
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }
  document.getElementById('paidBtn').addEventListener('click', function () {
    showToast('✓ Payment received — instalment 3 marked paid');
  });
  document.getElementById('applyBtn').addEventListener('click', function () {
    if (!this.disabled) showToast('✓ Application submitted — pre-screening started');
  });

  // initial route
  var start = location.hash.replace('#', '');
  show(views[start] ? start : 'home', false);

  // PWA service worker (works in browser; ignored harmlessly inside WebView)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js').catch(function () {});
    });
  }
})();
