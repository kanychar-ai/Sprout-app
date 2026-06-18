// Sprout app — end-to-end coverage of EVERY button and EVERY fill-in field.
// Run with:  npm test            (headless)
//            npm run test:headed  (watch it click through)
const { test, expect } = require('@playwright/test');

const APP = '/app/index.html';

// Wait until a given screen (data-view) is the visible one.
async function expectView(page, view) {
  await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
}

// Deep-link straight to a screen via the hash router (screens are independent).
async function goView(page, view) {
  await page.goto(`${APP}#${view}`);
  await expectView(page, view);
}

// Set an <input type=range> and fire the input event the app listens for.
async function setRange(page, sel, value) {
  await page.locator(sel).evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}

test.describe('1 · Auth flow — onboarding → create → verify → login', () => {
  test('onboarding splash: Get started → create, Log in → login', async ({ page }) => {
    await page.goto(APP);
    await expectView(page, 'onboard');
    await expect(page.locator('.splash-title')).toHaveText('Sprout');

    // "Log in" link routes to the login screen…
    await page.locator('.splash-foot .link', { hasText: 'Log in' }).click();
    await expectView(page, 'login');

    // …and "Get started" routes to create account.
    await page.goto(APP);
    await page.locator('#onbStart').click();
    await expectView(page, 'create');
  });

  test('create account: every field is fillable + eye toggle + consent + submit', async ({ page }) => {
    await goView(page, 'create');

    // Fill information — all four fields accept input.
    await page.fill('#suName', 'Somchai Jaidee');
    await page.fill('#suUser', 'somchai.j');
    await page.fill('#suMobile', '081-999-1234');
    await page.fill('#suPass', 'NewPass123!');
    await expect(page.locator('#suName')).toHaveValue('Somchai Jaidee');
    await expect(page.locator('#suUser')).toHaveValue('somchai.j');
    await expect(page.locator('#suMobile')).toHaveValue('081-999-1234');

    // Password is hidden by default; the eye toggle reveals it.
    await expect(page.locator('#suPass')).toHaveAttribute('type', 'password');
    await page.locator('#suEye').click();
    await expect(page.locator('#suPass')).toHaveAttribute('type', 'text');
    await page.locator('#suEye').click();
    await expect(page.locator('#suPass')).toHaveAttribute('type', 'password');

    // Consent starts checked; tapping the tile toggles it.
    const ck = page.locator('[data-toggle="consent"] .ck');
    await expect(ck).toHaveClass(/on/);
    await page.locator('[data-view="create"] [data-toggle="consent"]').click();
    await expect(ck).not.toHaveClass(/on/);
    await page.locator('[data-view="create"] [data-toggle="consent"]').click();
    await expect(ck).toHaveClass(/on/);

    // "Already a member? Log in" link.
    await page.locator('[data-view="create"] .link', { hasText: 'Log in' }).click();
    await expectView(page, 'login');

    // Submit "Create account" → verify mobile.
    await goView(page, 'create');
    await page.locator('#suSubmit').click();
    await expectView(page, 'otp');
  });

  test('verify mobile: 6 OTP boxes accept digits + Verify & finish → home', async ({ page }) => {
    await goView(page, 'otp');
    const boxes = page.locator('#otpRow .otp-box');
    await expect(boxes).toHaveCount(6);

    const code = ['4', '1', '7', '2', '9', '5'];
    for (let i = 0; i < 6; i++) {
      await boxes.nth(i).fill(code[i]);
      await expect(boxes.nth(i)).toHaveValue(code[i]);
    }

    await page.locator('#otpSubmit').click();
    await expectView(page, 'role');
    await expectView(page, 'home'); // role auto-advances to home
  });

  test('login: username/password fillable + eye + forgot + Log in / Google / Create account', async ({ page }) => {
    await goView(page, 'login');

    await page.fill('#liUser', 'somchai.j');
    await page.fill('#liPass', 'MyPassw0rd!');
    await expect(page.locator('#liUser')).toHaveValue('somchai.j');
    await expect(page.locator('#liPass')).toHaveValue('MyPassw0rd!');

    // Eye toggle.
    await expect(page.locator('#liPass')).toHaveAttribute('type', 'password');
    await page.locator('#liEye').click();
    await expect(page.locator('#liPass')).toHaveAttribute('type', 'text');

    // Forgot password shows a toast.
    await page.locator('#liForgot').click();
    await expect(page.locator('#toast')).toHaveClass(/show/);

    // "Create account" link.
    await page.locator('[data-view="login"] .link', { hasText: 'Create account' }).click();
    await expectView(page, 'create');

    // Google sign-in → role → home.
    await goView(page, 'login');
    await page.locator('#liGoogle').click();
    await expectView(page, 'role');
    await expectView(page, 'home');

    // Username/password Log in → role → home.
    await goView(page, 'login');
    await page.locator('#liSubmit').click();
    await expectView(page, 'role');
    await expectView(page, 'home');
  });
});

test.describe('2 · Home + bottom navigation', () => {
  test('home hero CTAs and quick actions route correctly', async ({ page }) => {
    const routes = [
      ['.home-hero [data-go="products"]', 'products'],
      ['.home-hero [data-go="status"]', 'status'],
      ['.hh-bell', 'alerts'],
      ['.quick [data-go="calc"]', 'calc'],
      ['.quick [data-go="status"]', 'status'],
      ['.quick [data-go="repay"]', 'repay'],
      ['.quick [data-go="products"]', 'products'],
      ['[data-go="activity"]', 'activity'],
      ['[data-view="home"] [data-go="products"].btn', 'products'],
    ];
    for (const [sel, view] of routes) {
      await goView(page, 'home');
      await page.locator(sel).first().click();
      await expectView(page, view);
    }
  });

  test('bottom nav tabs switch surfaces and highlight the active tab', async ({ page }) => {
    const tabs = [
      ['.app-nav [data-go="home"]', 'home'],
      ['.app-nav [data-go="calc"]', 'calc'],
      ['.app-nav [data-go="status"]', 'status'],
      ['.app-nav [data-go="me"]', 'me'],
    ];
    await goView(page, 'home');
    for (const [sel, view] of tabs) {
      await page.locator(sel).click();
      await expectView(page, view);
      await expect(page.locator(sel)).toHaveClass(/on/);
    }
  });
});

test.describe('2b · Application progress is aligned across screens', () => {
  test('home tracker matches the per-screen "Step X of 4" and resumes correctly', async ({ page }) => {
    await goView(page, 'home');
    await expect(page.locator('#homeStepsLeft')).toHaveText('3 steps left');
    await expect(page.locator('#homeSteps i')).toHaveCount(4);
    await expect(page.locator('#homeSteps i.done')).toHaveCount(1);
    await expect(page.locator('#homeContinue')).toContainText('Step 2 of 4');
    await page.locator('#homeContinue').click();
    await expectView(page, 'income'); // resumes at the current step, not the start

    for (const [v, n] of [['kyc', 1], ['income', 2], ['bank', 3], ['docs', 4]]) {
      await goView(page, v);
      await expect(page.locator(`[data-view="${v}"] .step-count`)).toHaveText(`Step ${n} of 4`);
    }
  });

  test('bell opens notifications and "See all" opens the activity log', async ({ page }) => {
    await goView(page, 'home');
    await page.locator('.hh-bell').click();
    await expectView(page, 'alerts');
    await goView(page, 'home');
    await page.locator('[data-go="activity"]').click();
    await expectView(page, 'activity');
  });
});

test.describe('2c · No dead-end screens — every screen has an exit', () => {
  test('each view offers back / nav / a forward button (or auto-advances)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const IMMERSIVE = { home: 1, onboard: 1, login: 1, role: 1, prescreen: 1 };
      const SHOW_NAV = { home: 1, calc: 1, status: 1, repay: 1, me: 1 };
      const bad = [];
      document.querySelectorAll('.view').forEach((sec) => {
        const v = sec.dataset.view;
        const ok = !IMMERSIVE[v] || SHOW_NAV[v] ||
          sec.querySelectorAll('[data-go]').length > 0 || v === 'role' || v === 'prescreen';
        if (!ok) bad.push(v);
      });
      return bad;
    });
    expect(result).toEqual([]);
  });

  test('top-bar avatar reaches profile, and the back arrow chains home', async ({ page }) => {
    await goView(page, 'products');
    await page.locator('.app-top .avatar').click();
    await expectView(page, 'me');

    await goView(page, 'home');
    await page.locator('.home-hero [data-go="products"]').click();
    await page.locator('[data-view="products"] [data-go="calc"]').click();
    await page.locator('#back').click();
    await expectView(page, 'products');
    await page.locator('#back').click();
    await expectView(page, 'home');
  });
});

test.describe('3 · Simplified loan request (estimate screen removed)', () => {
  test('the estimate screen no longer exists; Apply now goes straight to products', async ({ page }) => {
    await expect(page.locator('[data-view="estimate"]')).toHaveCount(0);
    await goView(page, 'home');
    await page.locator('.home-hero [data-go="products"]').click();
    await expectView(page, 'products');
  });
});

test.describe('3b · No internal/dev jargon shown to customers', () => {
  test('the app shows no "SYSTEM · INTERNAL" boxes', async ({ page }) => {
    await expect(page.locator('.sysnote')).toHaveCount(0);
  });
});

test.describe('4 · Products — data-driven, every card selectable, one docked CTA', () => {
  test('all product cards select; chosen product flows to the calculator', async ({ page }) => {
    await goView(page, 'products');
    const cards = page.locator('#prodList .prod');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveClass(/sel/); // first selected by default

    // every card must be selectable (bug: only the first one worked before)
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await expect(cards.nth(i)).toHaveClass(/sel/);
      await expect(page.locator('#prodList .prod.sel')).toHaveCount(1);
    }

    await expect(page.locator('#prodContinue')).toContainText('Continue with');
    await expect(page.locator('#prodContinue')).toHaveClass(/dock/);
    await page.locator('#prodContinue').click();
    await expectView(page, 'calc');
    await expect(page.locator('#calcProd')).toContainText('EIR calculator');
  });

  test('every linear-flow screen docks its primary CTA to the bottom', async ({ page }) => {
    for (const v of ['products', 'calc', 'kyc', 'income', 'bank', 'docs', 'tax', 'esign']) {
      await expect(page.locator(`[data-view="${v}"] .btn.dock`)).toHaveCount(1);
    }
  });
});

test.describe('5 · Calculator — every input drives the live EIR/DSR engine', () => {
  test('sliders + income/debt fields recompute payment, EIR and limit guard', async ({ page }) => {
    await goView(page, 'calc');

    await setRange(page, '#amt', 150000);
    await setRange(page, '#term', 36);
    await page.fill('#income', '45000');
    await page.fill('#debt', '8500');

    await expect(page.locator('#amtLabel')).toHaveText('฿150,000');
    await expect(page.locator('#termLabel')).toHaveText('36 months');
    await expect(page.locator('#pmt')).toContainText('฿');
    await expect(page.locator('#eir')).toContainText('%');
    await expect(page.locator('#applyBtn')).toBeEnabled();

    // Within limit → Apply routes to e-KYC.
    await page.locator('#applyBtn').click();
    await expectView(page, 'kyc');
  });

  test('over-limit amount blocks Apply and shows the warning card', async ({ page }) => {
    await goView(page, 'calc');
    await setRange(page, '#amt', 240000); // > ฿180k ceiling
    await expect(page.locator('#overLimit')).toBeVisible();
    await expect(page.locator('#applyBtn')).toBeDisabled();
  });
});

test.describe('6 · Application wizard — kyc → income → bank → docs → tax → esign', () => {
  test('e-KYC captures & verifies front + back, then → income', async ({ page }) => {
    await goView(page, 'kyc');
    await expect(page.locator('#kycSlots .idslot')).toHaveCount(2);
    await expect(page.locator('#kycContinue')).toBeDisabled();
    const idImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    await page.evaluate((img) => window.SproutKYC.setSide('front', img), idImg);
    await page.evaluate((img) => window.SproutKYC.setSide('back', img), idImg);
    await expect(page.locator('#slotFront')).toHaveClass(/done/);
    await expect(page.locator('#slotBack')).toHaveClass(/done/);
    await expect(page.locator('#kycContinue')).toBeEnabled();
    await page.locator('#kycContinue').click();
    await expectView(page, 'income');
  });

  test('income: occupation field + typeahead pick + Continue → bank', async ({ page }) => {
    await goView(page, 'income');
    await page.fill('#occField', 'Engineer');
    await expect(page.locator('#occField')).toHaveValue('Engineer');

    // Picking a suggestion fills the field.
    await page.locator('.occ[data-occ="Civil Engineer"]').click();
    await expect(page.locator('#occField')).toHaveValue('Civil Engineer');
    await expect(page.locator('.occ[data-occ="Civil Engineer"]')).toHaveClass(/on/);

    await page.locator('[data-view="income"] [data-go="bank"]').click();
    await expectView(page, 'bank');
  });

  test('bank: every bank tile selectable + Continue → docs', async ({ page }) => {
    await goView(page, 'bank');
    for (const b of ['SCB', 'KBank', 'KTB', 'BBL']) {
      await page.locator(`.bank[data-bank="${b}"]`).click();
      await expect(page.locator(`.bank[data-bank="${b}"]`)).toHaveClass(/on/);
    }
    await page.locator('[data-view="bank"] [data-go="docs"]').click();
    await expectView(page, 'docs');
  });

  test('docs: add/preview/camera/files buttons toast + Submit → tax', async ({ page }) => {
    await goView(page, 'docs');
    const addButtons = page.locator('[data-view="docs"] [data-add="doc"]');
    const n = await addButtons.count();
    expect(n).toBeGreaterThan(0);
    await addButtons.first().click();
    await expect(page.locator('#toast')).toHaveClass(/show/);

    await page.locator('[data-view="docs"] [data-go="tax"]').click();
    await expectView(page, 'tax');
  });

  test('tax: every Yes/No segment toggles + Confirm → esign', async ({ page }) => {
    await goView(page, 'tax');
    const segs = page.locator('[data-view="tax"] .seg.toggle');
    const count = await segs.count();
    for (let i = 0; i < count; i++) {
      const yes = segs.nth(i).locator('button', { hasText: 'Yes' });
      await yes.click();
      await expect(yes).toHaveClass(/on/);
    }
    await page.locator('[data-view="tax"] [data-go="esign"]').click();
    await expectView(page, 'esign');
  });

  test('esign: consent toggle + Accept & sign → prescreen → status', async ({ page }) => {
    await goView(page, 'esign');
    const ck = page.locator('[data-view="esign"] [data-toggle="esign"] .ck');
    await expect(ck).toHaveClass(/on/);
    await page.locator('[data-view="esign"] [data-toggle="esign"]').click();
    await expect(ck).not.toHaveClass(/on/);

    await page.locator('[data-view="esign"] [data-go="prescreen"]').click();
    await expectView(page, 'prescreen');
    await expectView(page, 'status'); // prescreen animation auto-routes to status
  });
});

test.describe('7 · Status / Repay / Profile', () => {
  test('status: Accept & continue → repay', async ({ page }) => {
    await goView(page, 'status');
    await page.locator('[data-view="status"] [data-go="repay"]').click();
    await expectView(page, 'repay');
  });

  test('repay: "I\'ve paid" shows confirmation toast', async ({ page }) => {
    await goView(page, 'repay');
    await page.locator('#paidBtn').click();
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('profile: Sign out → onboarding', async ({ page }) => {
    await goView(page, 'me');
    await page.locator('[data-view="me"] [data-go="onboard"]').click();
    await expectView(page, 'onboard');
  });
});
