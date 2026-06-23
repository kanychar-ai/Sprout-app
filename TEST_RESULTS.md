# Sprout — Test Results

Run date: 2026-06-23 07:44 UTC
Scope: back-office Document requirements (required/optional, active, add/delete);
app upload step reads them; plus pre-screening rules and prior work.

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

• 10 · Status / Repay / Profile

• 10b · No dead-end screens

• 11 · No internal jargon for customers

================================================
  177 passed, 0 failed
================================================
```
