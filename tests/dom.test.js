/* Sprout app — browserless test suite (jsdom).
 * Exercises EVERY button (data-go navigation, toggles, toasts) and EVERY
 * fill-in field, with no browser download required.  Run with:  npm test
 *
 * The full visual/browser suite lives in tests/app.spec.js (Playwright,
 * `npm run test:e2e`) — this file is the always-runnable equivalent. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP_DIR = path.join(__dirname, '..', 'app');

// ---- tiny assertion harness ------------------------------------------------
let pass = 0, fail = 0;
const fails = [];
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); console.log('  ✗ ' + name); }
}
function group(name) { console.log('\n• ' + name); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- boot the app inside jsdom ---------------------------------------------
function boot() {
  let html = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
  // Drop the external <script>/<link>; we inject the JS ourselves and skip CSS.
  html = html.replace(/<script src="(config|id-verify|app|kyc|docs)\.js(?:\?[^"]*)?"><\/script>/g, '')
             .replace(/<link rel="stylesheet" href="app\.css(?:\?[^"]*)?">/, '');
  // forward console output, but drop jsdom's "Not implemented: canvas getContext"
  // notice (the verifier handles the missing canvas gracefully in headless jsdom)
  const vc = new VirtualConsole();
  vc.sendTo(console, { omitJSDOMErrors: true });
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) console.error(e.message); });
  const dom = new JSDOM(html, {
    url: 'http://localhost/app/index.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  // load modules in the same order as the page: id-verify → app → kyc
  ['id-verify.js', 'app.js', 'kyc.js', 'docs.js'].forEach((f) => {
    dom.window.eval(fs.readFileSync(path.join(APP_DIR, f), 'utf8'));
  });
  return dom;
}

// ---- helpers ---------------------------------------------------------------
function makeApi(dom) {
  const { document, MouseEvent, Event } = dom.window;
  const q = (sel) => document.querySelector(sel);
  return {
    document,
    visible: (view) => {
      const el = document.querySelector(`[data-view="${view}"]`);
      return !!el && el.hidden === false;
    },
    go(view) {
      dom.window.location.hash = '#' + view;
      dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    },
    click(sel) {
      const el = typeof sel === 'string' ? q(sel) : sel;
      if (!el) throw new Error('no element for ' + sel);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    fill(sel, value) {
      const el = q(sel);
      if (!el) throw new Error('no input for ' + sel);
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    val: (sel) => q(sel).value,
    text: (sel) => (q(sel) ? q(sel).textContent.trim() : null),
    type: (sel) => q(sel).getAttribute('type'),
    hasClass: (sel, c) => q(sel).classList.contains(c),
    count: (sel) => document.querySelectorAll(sel).length,
    q,
  };
}

async function run() {
  const dom = boot();
  const a = makeApi(dom);

  // 1 · Onboarding splash ----------------------------------------------------
  group('1 · Onboarding splash');
  check('starts on onboarding', a.visible('onboard'));
  check('title is "Sprout"', a.text('.splash-title') === 'Sprout');
  a.click('#onbStart');
  check('Get started → create', a.visible('create'));
  a.go('onboard');
  a.click('.splash-foot .link');
  check('Log in link → login', a.visible('login'));

  // 2 · Create account — every field + eye + consent + links -----------------
  group('2 · Create account fields');
  a.go('create');
  a.fill('#suName', 'Somchai Jaidee');
  a.fill('#suUser', 'somchai.j');
  a.fill('#suMobile', '081-999-1234');
  a.fill('#suPass', 'NewPass123!');
  check('full name fillable', a.val('#suName') === 'Somchai Jaidee');
  check('username fillable', a.val('#suUser') === 'somchai.j');
  check('mobile fillable', a.val('#suMobile') === '081-999-1234');
  check('password fillable', a.val('#suPass') === 'NewPass123!');
  check('password hidden by default', a.type('#suPass') === 'password');
  a.click('#suEye');
  check('eye reveals password', a.type('#suPass') === 'text');
  a.click('#suEye');
  check('eye hides password again', a.type('#suPass') === 'password');
  check('consent starts checked', a.hasClass('[data-view="create"] [data-toggle="consent"] .ck', 'on'));
  a.click('[data-view="create"] [data-toggle="consent"]');
  check('consent toggles off', !a.hasClass('[data-view="create"] [data-toggle="consent"] .ck', 'on'));
  a.click('[data-view="create"] .link');
  check('create → Log in link → login', a.visible('login'));
  a.go('create');
  a.click('#suSubmit');
  check('Create account button → otp', a.visible('otp'));

  // 3 · Verify mobile — 6 OTP boxes + finish ---------------------------------
  group('3 · Verify mobile (OTP)');
  a.go('otp');
  check('has 6 OTP boxes', a.count('#otpRow .otp-box') === 6);
  const boxes = a.document.querySelectorAll('#otpRow .otp-box');
  const code = ['4', '1', '7', '2', '9', '5'];
  boxes.forEach((b, i) => { b.value = code[i]; b.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  check('all OTP boxes accept a digit', Array.from(boxes).every((b, i) => b.value === code[i]));
  a.click('#otpSubmit');
  check('Verify & finish → role', a.visible('role'));
  await delay(1700);
  check('role auto-advances → home', a.visible('home'));

  // 4 · Login — username/password + eye + forgot + 3 buttons -----------------
  group('4 · Login');
  a.go('login');
  a.fill('#liUser', 'somchai.j');
  a.fill('#liPass', 'MyPassw0rd!');
  check('login username fillable', a.val('#liUser') === 'somchai.j');
  check('login password fillable', a.val('#liPass') === 'MyPassw0rd!');
  check('login password hidden', a.type('#liPass') === 'password');
  a.click('#liEye');
  check('login eye reveals', a.type('#liPass') === 'text');
  a.click('#liForgot');
  check('forgot password shows toast', a.hasClass('#toast', 'show'));
  a.click('[data-view="login"] .splash-alt .link');
  check('login → Create account link → create', a.visible('create'));
  a.go('login');
  a.click('#liGoogle');
  check('Continue with Google → role', a.visible('role'));
  await delay(1700);
  check('Google role → home', a.visible('home'));
  a.go('login');
  a.click('#liSubmit');
  check('Log in button → role', a.visible('role'));
  await delay(1700);
  check('login role → home', a.visible('home'));

  // 5 · Home CTAs + quick actions + bottom nav -------------------------------
  group('5 · Home + navigation');
  const homeRoutes = [
    ['.home-hero [data-go="products"]', 'products'],
    ['.home-hero [data-go="status"]', 'status'],
    ['.hh-bell', 'alerts'],                       // the bell is now pressable
    ['.quick [data-go="calc"]', 'calc'],
    ['.quick [data-go="status"]', 'status'],
    ['.quick [data-go="repay"]', 'repay'],
    ['.quick [data-go="products"]', 'products'],
    ['[data-go="activity"]', 'activity'],         // "See all" is now pressable
  ];
  for (const [sel, view] of homeRoutes) {
    a.go('home');
    a.click(sel);
    check(`home ${sel} → ${view}`, a.visible(view));
  }
  const tabs = [['home', 'home'], ['calc', 'calc'], ['status', 'status'], ['me', 'me']];
  for (const [go, view] of tabs) {
    a.click(`.app-nav [data-go="${go}"]`);
    check(`nav tab ${go} → ${view}`, a.visible(view));
    check(`nav tab ${go} highlighted`, a.hasClass(`.app-nav [data-go="${go}"]`, 'on'));
  }

  // 5b · Application progress is internally consistent -----------------------
  group('5b · Application progress alignment');
  a.go('home');
  // home tracker is driven from one source of truth (WIZARD_DONE = 1 → on step 2)
  check('home shows "3 steps left"', a.text('#homeStepsLeft') === '3 steps left');
  check('home renders 4 progress dots', a.document.querySelectorAll('#homeSteps i').length === 4);
  check('home dots: 1 done, 1 on', a.document.querySelectorAll('#homeSteps i.done').length === 1 &&
    a.document.querySelectorAll('#homeSteps i.on').length === 1);
  check('home "Continue" says Step 2 of 4', /Step 2 of 4/.test(a.text('#homeContinue')));
  a.click('#homeContinue');
  check('home "Continue" resumes at the current step (income)', a.visible('income'));
  // each verification screen shows an explicit, aligned "Step X of 4"
  for (const [v, n] of [['kyc', 1], ['income', 2], ['bank', 3], ['docs', 4]]) {
    const cap = a.q(`[data-view="${v}"] .step-count`);
    check(`${v} shows "Step ${n} of 4"`, !!cap && cap.textContent.trim() === `Step ${n} of 4`);
  }
  // the new notification & activity screens have a working CTA back into the flow
  a.go('alerts');
  a.click('[data-view="alerts"] [data-go="income"]');
  check('notifications CTA → income', a.visible('income'));
  a.go('activity');
  a.click('[data-view="activity"] [data-go="income"]');
  check('activity CTA → income', a.visible('income'));

  // 6 · Simplified loan request — the estimate screen is gone -----------------
  group('6 · Simplified loan request');
  check('estimate screen removed', a.q('[data-view="estimate"]') === null);
  a.go('home');
  a.click('.home-hero [data-go="products"]');
  check('Apply now → products directly (no estimate step)', a.visible('products'));

  // 7 · Products — data-driven, every card selectable, one docked CTA --------
  group('7 · Products');
  a.go('products');
  const prodCards = () => a.document.querySelectorAll('#prodList .prod');
  check('products render from data (3 fallback cards)', prodCards().length === 3);
  check('first product selected by default', prodCards()[0].classList.contains('sel'));
  // EVERY product card must be selectable (the reported bug: only the first worked)
  prodCards().forEach((card, i) => {
    a.click(card);
    const cards = prodCards();
    check(`product card ${i + 1} selectable`, cards[i].classList.contains('sel'));
    check(`selecting card ${i + 1} deselects the others`,
      Array.from(cards).filter((c) => c.classList.contains('sel')).length === 1);
  });
  check('Continue button reflects the chosen product', /Continue with /.test(a.text('#prodContinue')));
  check('Continue button is docked to the bottom', a.hasClass('#prodContinue', 'dock'));
  a.click('#prodContinue');
  check('products Continue → calc', a.visible('calc'));
  check('calculator header reflects the chosen product', /EIR calculator/.test(a.text('#calcProd')));

  // 7b · Products layout must never overlap -----------------------------------
  group('7b · Products layout (no overlapping cards)');
  a.go('products');
  // structure that makes overlap impossible: cards are block siblings in #prodList,
  // and the docked CTA lives OUTSIDE the list so it can't collide with a card
  check('all product cards are direct children of #prodList',
    a.count('#prodList > .prod') === 3 && a.count('#prodList > .prod') === a.count('#prodList .prod'));
  check('every product card is a block <div>',
    Array.from(a.document.querySelectorAll('#prodList .prod')).every((c) => c.tagName === 'DIV'));
  check('docked Continue is a sibling of the list, not inside it',
    a.q('#prodContinue').parentElement.dataset.view === 'products' && !a.q('#prodList').contains(a.q('#prodContinue')));
  // CSS regression guards for the flex-column compression bug that caused the overlap
  const appCss = fs.readFileSync(path.join(APP_DIR, 'app.css'), 'utf8');
  check('CSS forbids flex children from shrinking (.view > * flex-shrink:0)',
    /\.view\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/.test(appCss));
  check('no product/card uses absolute positioning', !/\.(prod|card)[^{]*\{[^}]*position:\s*absolute/.test(appCss));
  // #prodList must stay in block flow: as a flex column the cards became flex items
  // and WebKit collapsed the selected card (nested flex), overlapping the next card
  check('#prodList is block flow (not flex)', /#prodList\s*\{[^}]*display:\s*block/.test(appCss));
  check('#prodList is not a flex container', !/#prodList\s*\{[^}]*display:\s*flex/.test(appCss));
  // ROOT CAUSE of the overlap: a generic ".sel { height:52px }" (pay-type dropdown)
  // collided with the product card's ".prod.sel" selected state, forcing selected
  // cards to 52px and clipping their stats. Guard the class name can't collide again.
  check('no bare ".sel" rule (would collide with .prod.sel and clamp card height)',
    !/(^|[\s,}])\.sel\s*[:{]/.test(appCss));
  check('pay-type dropdown renamed to .selectbox', /\.selectbox\s*\{/.test(appCss));
  check('product selection uses a non-sizing ring (outline)',
    /\.prod\.sel\s*\{[^}]*outline:/.test(appCss) && !/\.prod\.sel\s*\{[^}]*height:/.test(appCss));

  // every primary CTA in the linear loan flow docks to the bottom AND is sized
  // consistently (full-size .btn, never the smaller .sm variant)
  for (const v of ['products', 'calc', 'kyc', 'income', 'bank', 'docs', 'tax', 'esign']) {
    const dockEl = a.q(`[data-view="${v}"] .dock`); // .btn.dock OR a .row.dock of buttons
    check(`${v} screen has a bottom-docked CTA`, dockEl !== null);
    const cta = dockEl && (dockEl.classList.contains('btn') ? dockEl
      : dockEl.querySelector('.btn.primary, .btn.lime'));
    check(`${v} CTA is uniform size (primary/lime, not .sm)`,
      !!cta && cta.classList.contains('btn') && !cta.classList.contains('sm') &&
      (cta.classList.contains('primary') || cta.classList.contains('lime')));
  }

  // 8 · Calculator — sliders + fields + limit guard --------------------------
  group('8 · Calculator');
  a.go('calc');
  a.fill('#amt', '150000');
  a.fill('#term', '36');
  a.fill('#income', '45000');
  a.fill('#debt', '8500');
  check('amount label updates', a.text('#amtLabel') === '฿150,000');
  check('term label updates', a.text('#termLabel') === '36 months');
  check('monthly payment computed', a.text('#pmt').startsWith('฿'));
  check('EIR computed', a.text('#eir').includes('%'));
  check('apply enabled within limit', a.q('#applyBtn').disabled === false);
  a.click('#applyBtn');
  check('Apply (within limit) → kyc', a.visible('kyc'));
  a.go('calc');
  a.fill('#amt', '240000'); // over the ฿180k ceiling
  check('over-limit warning shown', a.q('#overLimit').hidden === false);
  check('apply disabled over limit', a.q('#applyBtn').disabled === true);

  // 9 · Wizard: kyc → income → bank → docs → tax → esign ---------------------
  group('9 · Application wizard');
  a.go('kyc');
  // e-KYC now captures front AND back, each verified before you can continue
  check('kyc Continue disabled until both sides captured', a.q('#kycContinue').disabled === true);
  check('kyc has front & back capture slots', a.count('#kycSlots .idslot') === 2);
  const idImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const rFront = await dom.window.SproutKYC.setSide('front', idImg);
  const rBack = await dom.window.SproutKYC.setSide('back', idImg);
  check('verify returns a result with ok/side/confidence', rFront.ok === true && rFront.side === 'front' && 'confidence' in rFront);
  check('front slot marked verified', a.hasClass('#slotFront', 'done'));
  check('back slot marked verified', a.hasClass('#slotBack', 'done'));
  check('kyc Continue enabled after both sides verified', a.q('#kycContinue').disabled === false);
  void rBack;
  a.click('#kycContinue');
  check('kyc → income after both sides captured', a.visible('income'));

  // occupation: seeded list + real search/typeahead
  check('occupation list seeds many options', a.count('#occList .occ') >= 8);
  a.fill('#occField', 'engine');
  check('typing filters the list', a.count('#occList .occ') === 3); // Engineer, Civil/Electrical Engineer
  a.fill('#occField', 'student');
  check('search finds "Student"', a.count('#occList .occ') === 1 && !!a.q('.occ[data-occ="Student"]'));
  a.fill('#occField', 'zzzz');
  check('no match shows a hint, no rows', a.count('#occList .occ') === 0);
  a.fill('#occField', 'Engineer');
  check('occupation fillable', a.val('#occField') === 'Engineer');
  a.click('.occ[data-occ="Civil Engineer"]');
  check('occupation pick fills field', a.val('#occField') === 'Civil Engineer');
  check('occupation pick highlighted', a.hasClass('.occ[data-occ="Civil Engineer"]', 'on'));
  // pay type is a working dropdown
  check('pay type is a real <select>', a.q('#payType') && a.q('#payType').tagName === 'SELECT');
  check('pay type has multiple options', a.count('#payType option') >= 5);
  const paySel = a.q('#payType');
  paySel.value = 'Freelance';
  paySel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  check('pay type is selectable', a.val('#payType') === 'Freelance');
  a.click('[data-view="income"] [data-go="bank"]');
  check('income Continue → bank', a.visible('bank'));

  for (const b of ['SCB', 'KBank', 'KTB', 'BBL']) {
    a.click(`.bank[data-bank="${b}"]`);
    check(`bank ${b} selectable`, a.hasClass(`.bank[data-bank="${b}"]`, 'on'));
  }
  a.click('[data-view="bank"] [data-go="docs"]');
  check('bank Continue → docs', a.visible('docs'));

  // documents: requirement rows + functional upload (camera/photos/files) + preview
  check('docs renders requirement rows', a.count('#docReqs .docrow') >= 4);
  check('National ID is pre-added (checked from KYC)', a.hasClass('#docReqs .docrow[data-key="id"]', 'done'));
  check('upload input accepts camera + files (image + pdf)',
    /image\/\*/.test(a.q('#docFile').accept) && /pdf/.test(a.q('#docFile').accept));
  check('each requirement row has an upload control before upload',
    !!a.q('#docReqs .docrow[data-key="payslip"] [data-act="up"]'));
  // simulate picking a file from the device
  dom.window.SproutDocs.addFile('payslip', { name: 'Payslip_May.pdf', size: 240000, type: 'application/pdf' });
  check('uploaded file name shows on the row', /Payslip_May\.pdf/.test(a.text('#docReqs .docrow[data-key="payslip"]')));
  check('uploaded row marked done', a.hasClass('#docReqs .docrow[data-key="payslip"]', 'done'));
  check('uploaded row offers preview (tap) + remove', !!a.q('#docReqs .docrow[data-key="payslip"] [data-act="del"]'));
  check('Save draft button present', !!a.q('#docDraft'));
  a.click('[data-view="docs"] [data-go="tax"]');
  check('docs Next → tax', a.visible('tax'));

  const segs = a.document.querySelectorAll('[data-view="tax"] .seg.toggle');
  check('tax has Yes/No segments', segs.length > 0);
  let allYes = true;
  segs.forEach((seg) => {
    const yes = Array.from(seg.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Yes');
    yes.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    if (!yes.classList.contains('on')) allYes = false;
  });
  check('every tax segment toggles to Yes', allYes);
  a.click('[data-view="tax"] [data-go="esign"]');
  check('tax Confirm → esign', a.visible('esign'));

  check('esign consent starts checked', a.hasClass('[data-view="esign"] [data-toggle="esign"] .ck', 'on'));
  a.click('[data-view="esign"] [data-toggle="esign"]');
  check('esign consent toggles', !a.hasClass('[data-view="esign"] [data-toggle="esign"] .ck', 'on'));
  a.click('[data-view="esign"] [data-go="prescreen"]');
  check('esign Accept & sign → prescreen', a.visible('prescreen'));
  // pre-screening checklist is driven by the back-office rules (with static fallback)
  check('prescreen has a checklist (static fallback works offline)', a.count('#psList .psitem') >= 1);
  dom.window.SproutPrescreen.render([
    { key: 'age', label: 'Age within range' },
    { key: 'credit_score', label: 'Minimum credit bureau score' },
    { key: 'documents', label: 'All required documents uploaded' }
  ]);
  check('enabled rules render as checklist items', a.count('#psList .psitem') === 3);
  check('rules use customer-friendly wording', /credit history/.test(a.q('#psList').textContent));
  await delay(3200);
  check('prescreen auto-advances → status', a.visible('status'));

  // 9b · Rule evaluation drives the result (Approved vs Under review) ---------
  group('9b · Pre-screening evaluation');
  const setCompliance = (answer) => {
    a.document.querySelectorAll('[data-view="tax"] .seg.toggle').forEach((seg) => {
      const b = Array.from(seg.querySelectorAll('button')).find((x) => x.textContent.trim() === answer);
      b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
  };
  // FATCA rule requires "Yes"; make the customer answer "No" → should NOT auto-approve
  dom.window.SproutPrescreen.setRules([{ key: 'fatca', label: 'Tax declaration (FATCA / CRS)', config: { allowed: ['Yes'] } }]);
  a.go('tax'); setCompliance('No');
  a.go('home'); a.go('status');
  check('unmet rule → Under review (not Approved)', /Under review/.test(a.text('#statusHead')));
  check('review shows the reasons', a.q('#statusReasons').hidden === false && /FATCA/.test(a.text('#statusReasons')));
  check('review hides the offer amount', a.q('#statusAmt').hidden === true);
  check('review CTA is not "accept" (routes home, no dead end)', a.q('#statusCta').dataset.go === 'home');
  // satisfy the rule: set every compliance toggle to "Yes"
  a.go('tax'); setCompliance('Yes');
  a.go('home'); a.go('status');
  check('all answers satisfy the rule → Approved', /Approved/.test(a.text('#statusHead')));
  check('approved offer amount visible + accept routes to repay',
    a.q('#statusAmt').hidden === false && a.q('#statusCta').dataset.go === 'repay');
  dom.window.SproutPrescreen.setRules([]); // reset for later tests

  // 10 · Status / Repay / Profile --------------------------------------------
  group('10 · Status / Repay / Profile');
  a.go('status');
  a.click('[data-view="status"] [data-go="repay"]');
  check('status Accept & continue → repay', a.visible('repay'));
  a.go('repay');
  a.click('#paidBtn');
  check('repay "I\'ve paid" shows toast', a.hasClass('#toast', 'show'));
  a.go('me');
  a.click('[data-view="me"] [data-go="onboard"]');
  check('profile Sign out → onboard', a.visible('onboard'));

  // 10b · No dead ends — every screen offers next / back / home -------------
  group('10b · No dead-end screens');
  // mirror the routing rules from app.js
  const IMMERSIVE = { home: 1, onboard: 1, login: 1, role: 1, prescreen: 1 };
  const SHOW_NAV = { home: 1, calc: 1, status: 1, repay: 1, me: 1 };
  const allViews = Array.from(a.document.querySelectorAll('.view')).map((v) => v.dataset.view);
  for (const v of allViews) {
    const sec = a.q(`[data-view="${v}"]`);
    const hasBack = !IMMERSIVE[v];                 // non-immersive screens show the back arrow
    const hasNav = !!SHOW_NAV[v];                  // these screens show the bottom tab bar
    const hasGo = sec.querySelectorAll('[data-go]').length > 0;
    // immersive screens without buttons must auto-advance (role, prescreen)
    const autoAdvances = v === 'role' || v === 'prescreen';
    check(`${v} is not a dead end`, hasBack || hasNav || hasGo || autoAdvances);
  }
  // the top-bar avatar is a real control on flow screens (→ profile, which has Home)
  a.go('products');
  a.click('.app-top .avatar');
  check('top-bar avatar → profile (reachable from a flow screen)', a.visible('me'));
  // the back arrow chain always returns toward home
  a.go('home'); a.click('.home-hero [data-go="products"]'); a.click('[data-view="products"] [data-go="calc"]');
  a.click('#back');
  check('back arrow goes one step back (calc → products)', a.visible('products'));
  a.click('#back');
  check('back arrow chain reaches home', a.visible('home'));
  // role auto-advances to home (never a trap)
  a.go('role');
  await delay(1600);
  check('role auto-advances → home', a.visible('home'));

  // 11 · Customer-friendly: no internal/dev jargon shown ---------------------
  group('11 · No internal jargon for customers');
  const bodyText = a.document.body.textContent;
  check('no "SYSTEM · INTERNAL" boxes anywhere', a.count('.sysnote') === 0);
  check('no raw DSR formula visible', !/DSR\s*=\s*\(/.test(bodyText));
  check('no "maker–checker" jargon', !/maker.checker/i.test(bodyText));
  check('no "AML screening" jargon', !/AML/i.test(bodyText));

  // ---- report --------------------------------------------------------------
  console.log(`\n${'='.repeat(48)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log('  failing: ' + fails.join(', '));
  console.log('='.repeat(48));
  dom.window.close();
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
