# Sprout — Test Results

Run date: 2026-06-23 09:05 UTC
Scope: customer ↔ officer integration — submitting an application creates a case;
the customer result screen shows the real officer decision (Approved / Not approved
+ reason / Under review / Disbursed).

## 1. Browserless DOM suite — npm test

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

• 9b · Pre-screening evaluation

• 10 · Status / Repay / Profile

• 10b · No dead-end screens

• 11 · No internal jargon for customers

================================================
  183 passed, 0 failed
================================================
```
