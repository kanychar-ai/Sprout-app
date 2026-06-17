# Sprout — Test Results

Run date: 2026-06-17 04:55 UTC
Scope: simplified loan request, data-driven & selectable products, bottom-docked
CTAs, aligned application progress (home tracker == per-screen "Step X of 4"),
and pressable bell / "See all" opening the notifications & activity screens.
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

• 5b · Application progress alignment

• 6 · Simplified loan request

• 7 · Products

• 8 · Calculator

• 9 · Application wizard

• 10 · Status / Repay / Profile

• 11 · No internal jargon for customers

================================================
  113 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`

Updated to match: progress alignment, bell → notifications, See all → activity,
selectable products, docked CTAs. NOT EXECUTED in this container (Chromium download
is blocked by the network policy); runs in CI / locally. The jsdom suite above is the
always-runnable equivalent covering the same buttons and fields.
