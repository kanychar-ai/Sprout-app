# Sprout — Test Results

Run date: 2026-06-18 02:42 UTC
Scope: real-camera e-KYC (capture + verify front & back, view photos),
pluggable ID-format verification API, consistent button sizing/position,
plus prior work. Every button and field is exercised.

## 1. Browserless DOM suite — `npm test` (always runnable, no browser needed)

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

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 10b · No dead-end screens

• 11 · No internal jargon for customers

================================================
  151 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`

Updated for the new e-KYC capture flow. NOT EXECUTED in this container
(Chromium download blocked by network policy); runs in CI / locally.
