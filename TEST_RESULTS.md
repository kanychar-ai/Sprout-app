# Sprout — Test Results

Run date: 2026-06-17 12:58 UTC
Scope: full navigation audit — every screen offers a way to go next, go back,
or reach home (no dead ends); all buttons are wired; plus the earlier work
(simplified request, data-driven selectable products, docked CTAs, aligned
progress, pressable bell / See all). Every button and field is exercised.

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
  137 passed, 0 failed
================================================
```

## 2. Playwright E2E suite — `npm run test:e2e`

Mirrors the above incl. the no-dead-end checks. NOT EXECUTED in this container
(Chromium download blocked by network policy); runs in CI / locally.
