# Sprout — Test Results

Run date: 2026-06-18 04:18 UTC
Scope: fix product-card overlap (flex-column compression) + regression tests,
occupation search, pay-type dropdown, e-KYC camera, cache-busting. All buttons/fields exercised.

## 1. Browserless DOM suite — `npm test`

```

> sprout-los@1.0.0 test
> node tests/dom.test.js


• 1 · Onboarding splash

• 2 · Create account fields

• 3 · Verify mobile (OTP)

• 4 · Login

• 5 · Home + navigation

• 5b · Application progress alignment

• 6 · Simplified loan request

• 7 · Products

• 7b · Products layout (no overlapping cards)

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 10b · No dead-end screens

• 11 · No internal jargon for customers

================================================
  163 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`
Adds a real-geometry check that product cards never overlap. Not executed in-container (Chromium blocked); runs in CI.
