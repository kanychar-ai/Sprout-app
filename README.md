# 🌱 Sprout — Digital Loan Origination (LOS) · Thailand 🇹🇭

A complete mobile **loan-origination system** designed for the Thai market and built to
**Bank of Thailand Responsible-Lending** + **AML/CFT** norms (e-KYC, NCB credit-bureau consent,
DSR ≤ 70%, EIR disclosure, sanctions/PEP/FATCA screening, AML risk rating, maker–checker governance).

This repo ships **two things**:

1. **A high-fidelity screen gallery** (`index.html`) — 32 screens rendered as realistic iPhone
   captures (393×852, Dynamic Island, titanium frames), grouped by user lane, each numbered + captioned,
   with happy-path **and** failure/edge branches.
2. **A runnable mobile app** (`app/`) — a responsive, installable PWA that walks the **full customer
   journey** end-to-end (onboarding → account → OTP → login → role detection → home → borrowing estimate
   → products → live EIR/DSR calculator → e-KYC → income → receiving bank → documents → tax &amp; compliance
   → e-signature → pre-screening → approval status → PromptPay repayment, plus a profile tab). It is wrapped
   in a native **WebView** for the **App Store / Google Play**, and also opens directly in any mobile or
   desktop browser.

| | |
|---|---|
| **Brand** | Electric cobalt `#2563EB` / dark `#1E40AF`, lime accent `#C6F24E`, navy `#0F1B33`, paper background |
| **Type** | Bricolage Grotesque (headings) · Anuphan (body, Thai-capable) |
| **Currency** | THB (฿) |
| **Status colours** | green = ok · amber = needs attention (no harsh red) |

---

## Screens (3 lanes · 32 screens)

**Lane 01 — Shared entry:** onboarding · create account (+consent) · mobile OTP (masked) · login (+Google) · auto role detection.

**Lane 02 — Customer:** first-time home (indicative credit) · borrowing estimate · products · EIR calculator
(+ over-limit error) · e-KYC ID scan (+ blur / invalid / max-5-attempts errors) · income (occupation API) ·
receiving bank (logo picker + name-match) · document upload (book bank before/after/preview/many-files) ·
tax & compliance (FATCA/CRS + PEP) · e-signature · background pre-screening · status tracking (approved /
not approved / chat) · PromptPay repayment.

**Lane 03 — Staff:** my-tasks queue (to-review / to-approve) · case search · case hub · application-data
review · score breakdown · compliance & screening (sanctions/PEP/FATCA/AML) · document verify
(Verified / Needs review / Re-request) · chat · maker–checker · request-more-docs · update status · disbursement.

Dark **`SYSTEM · INTERNAL`** note cards throughout document the backend rules (DSR formula, attempt limits,
four-eyes enforcement, EDD triggers, name-match thresholds, etc.) that are *not* shown to customers.

---

## Run locally

No build step — it's static. Use any static server:

```bash
# option A (Node)
npm start                 # → http://localhost:5173  (design gallery)
#                            http://localhost:5173/app  (the app)

# option B (Python)
npm run serve
```

- **Gallery:** `/index.html` (best on desktop)
- **App:** `/app/index.html` (full-screen on mobile; centered card on desktop)

The app includes a **live EIR/DSR calculator**: drag the amount/term sliders and edit income/debt to see
the monthly payment, EIR, total payable, credit-limit check and DSR cap react in real time — including the
**over-limit / over-DSR blocking** states.

---

## Install as a PWA (mobile browser & desktop)

`manifest.webmanifest` + `sw.js` make the app installable and offline-capable.

- **iOS Safari:** Share → *Add to Home Screen*
- **Android Chrome / Desktop Chrome/Edge:** address-bar *Install* icon

`start_url` points at `app/index.html`, so the installed icon opens straight into the app.

---

## Wrap as a native app (App Store / Google Play) via WebView

The app is wrapped with **[Capacitor](https://capacitorjs.com/)** (`capacitor.config.json` is included).
Capacitor uses the platform WebView — **WKWebView** on iOS, **Android System WebView** — so the same web
build ships to both stores.

```bash
npm install                 # installs @capacitor/* dev deps

npx cap add ios             # creates the Xcode project   (needs macOS + Xcode)
npx cap add android         # creates the Android Studio project

npx cap sync                # copies the web assets into the native projects
npx cap open ios            # → build / archive / upload to App Store Connect
npx cap open android        # → build signed AAB → Google Play Console
```

When running inside the native WebView, `index.html` detects `window.Capacitor` and redirects to the
full-screen **`app/`** shell automatically (browsers keep seeing the gallery).

> **Bare WebView alternative (no Capacitor):** point a native WebView at the hosted URL.
> - iOS: `WKWebView().load(URLRequest(url: URL(string: "https://your-host/app/")!))`
> - Android: `webView.settings.javaScriptEnabled = true; webView.loadUrl("https://your-host/app/")`
> Set a custom UA containing `SproutApp` to trigger the same auto-redirect to the app shell.

---

## Regulatory realism baked in

| Area | Where it shows |
|---|---|
| e-KYC (OCR / NDID / liveness, 5-attempt cap, PDPA purge) | 2.6, 2.7 |
| NCB credit-bureau consent | 1.2, 2.13, 3.4 |
| DSR ≤ 70% (BoT Responsible Lending) | 2.2, 2.4, calc app |
| EIR disclosure | 2.4, 2.12, calc app |
| Sanctions / PEP / FATCA screening + AML risk rating | 2.11, 3.6 |
| Maker–checker (four-eyes, segregation of duties) | 3.1, 3.9, 3.11 |
| Name-match before disbursement | 2.9, 3.12 |
| Audit logging / immutable change-log | 3.2, 3.4, 3.9 |

---

## Structure

```
.
├── index.html              # design gallery (32 screens, 3 lanes)
├── app/
│   ├── index.html          # WebView/PWA app shell — all 19 customer-journey screens
│   ├── app.css             # full-screen responsive layout + screen components
│   └── app.js              # flow router (back-stack, hash deep-links) + live EIR/DSR calculator,
│                           #   OTP entry, occupation/bank pickers, animated pre-screening
├── assets/
│   ├── styles.css          # design system + iPhone frame + components
│   ├── icon.svg            # app icon (vector)
│   └── icon-192/512.png    # app icons (PWA / store)
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # offline service worker
├── capacitor.config.json   # native WebView wrapper config
└── package.json
```

> This is a **design + front-end reference**. The flows are realistic but the data is mocked; wiring to real
> KYC/NCB/AML/banking providers happens behind these same screens.
