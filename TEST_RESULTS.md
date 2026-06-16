# Sprout — Test Results

Run date: 2026-06-16 09:13 UTC
Scope: customer-friendly rewrite of the borrowing-estimate screen + removal of all
internal "SYSTEM · INTERNAL" boxes. Every button and every fill-in field is exercised.

## 1. Browserless DOM suite — `npm test` (always runnable, no browser needed)

```

> sprout-los@1.0.0 test
> node tests/dom.test.js


• 1 · Onboarding splash

• 2 · Create account fields

• 3 · Verify mobile (OTP)

• 4 · Login

• 5 · Home + navigation

• 6 · Borrowing estimate

• 7 · Products

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 11 · No internal jargon for customers

================================================
  90 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`

Updated to match the new estimate screen (estRepay / estComfortBadge, no DSR jargon,
no .sysnote boxes) and an over-stretched-borrower warning case.

NOT EXECUTED in this container: the Chromium binary download is blocked by the
environment's network policy (`npx playwright install chromium` → Download failure).
The suite runs in CI / local where browsers are available; the jsdom suite above is the
always-runnable equivalent and covers the same buttons and fields.
