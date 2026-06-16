# Sprout — Test Results

Run date: 2026-06-16 09:55 UTC
Scope: simplified loan request (estimate screen removed), data-driven & fully
selectable loan products, and a consistent bottom-docked CTA across the flow.
Every button and every fill-in field is exercised.

## 1. Browserless DOM suite — `npm test` (always runnable, no browser needed)

```

> sprout-los@1.0.0 test
> node tests/dom.test.js


• 1 · Onboarding splash

• 2 · Create account fields

• 3 · Verify mobile (OTP)

• 4 · Login

• 5 · Home + navigation

• 6 · Simplified loan request

• 7 · Products

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 11 · No internal jargon for customers

================================================
  100 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`

Updated to the new flow: estimate screen gone, every product card selectable,
docked CTAs on every linear-flow screen.

NOT EXECUTED in this container: the Chromium binary download is blocked by the
environment's network policy (`npx playwright install chromium` fails). The suite
runs in CI / locally where browsers are available; the jsdom suite above is the
always-runnable equivalent and covers the same buttons and fields.
