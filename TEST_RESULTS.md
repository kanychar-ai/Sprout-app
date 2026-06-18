# Sprout — Test Results

Run date: 2026-06-18 04:56 UTC
Scope: functional Documents step (upload via camera/photos/files, shows file name,
preview uploaded files) redesigned to the 7.4a layout; plus prior work.

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
  169 passed, 0 failed
================================================
```

## 2. Playwright E2E — `npm run test:e2e` (real browser; not run in-container, Chromium blocked).
