# Sprout — Test Results

Run date: 2026-06-18 03:54 UTC
Scope: searchable occupation typeahead (seeded ISCO list) + working pay-type
dropdown, on top of e-KYC camera capture and prior work. Every button & field exercised.

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

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 10b · No dead-end screens

• 11 · No internal jargon for customers

================================================
  158 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`
Updated for occupation search + pay-type select. Not executed in-container
(Chromium download blocked); runs in CI / locally.
