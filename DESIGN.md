---
name: Bad(yet)
description: A personal budget for two paydays a month, in Night Emerald: deep midnight surfaces, one emerald accent, a coin mascot called Pip.
colors:
  midnight-bg: "#0A1320"
  surface: "#101C2E"
  surface-soft: "#17263B"
  ink: "#E8EEF7"
  muted: "#93A5BD"
  line: "#223349"
  rail: "#0C1726"
  emerald: "#34D399"
  on-emerald: "#04281C"
  emerald-text: "#5EE6B4"
  emerald-tint: "#0F3A33"
  periwinkle: "#7FA8FF"
  gold: "#F6C453"
  coral-error: "#FF8A8A"
  daylight-bg: "#F2F5F9"
  daylight-surface: "#FFFFFF"
  daylight-soft: "#E8EEF5"
  daylight-ink: "#0E1B2E"
  daylight-muted: "#556579"
  daylight-line: "#E1E8F0"
  daylight-emerald: "#087A5A"
  daylight-periwinkle: "#2F5BD7"
  daylight-gold-text: "#8A5A00"
  daylight-error: "#C23A3A"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  sm: "8px"
  card: "10px"
  hero: "14px"
  control: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.emerald}"
    textColor: "{colors.on-emerald}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
    height: "42px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "42px"
---

# Design System: Bad(yet)

## Overview

**Creative North Star: "The Payday Notebook"**

Bad(yet) is one person's money notebook, not a bank. It is organised around the question asked on payday, "what do I do now?", so the first thing on screen is the next action and the figure that matters, and the detail waits behind it. The look is Night Emerald (chosen by the owner at Gate 1): deep midnight surfaces, a single emerald accent, a gradient hero, charts, and Pip the coin mascot. Dark is the primary theme and light ("Daylight") is required too.

Personality lives in copy and small details, never in the way of the money. Figures are exact, tabular and never decorative. Three early mockups (a-passbook, b-signal, c-quiet-ledger) and a travel-planner look (flip tiles, boarding passes, coral and amber) are rejected anti-references.

**Key Characteristics:**
- Next action first (what to send, to which account), detail second.
- Structure is nearly square; controls and marks are fully round.
- One authored motion moment per screen; everything off under reduced motion.
- Phone and desktop are both first-class; amounts can be blurred with Hide amounts.

## Colors

One emerald accent over tinted midnight neutrals (dark) or cool daylight neutrals (light). Colour does real jobs: state, bucket, wallet identity, selection.

### Primary
- **Emerald** (#34D399 dark, #087A5A light): buttons, progress, the selected nav item, "sent" ticks. Text on it is #04281C (dark) or white (light). Emerald text on dark is #5EE6B4.

### Secondary
- **Periwinkle** (#7FA8FF dark, #2F5BD7 light): the Wants bucket, GCash, second series in charts.
- **Gold** (#F6C453 dark; text on light is #8A5A00, the fill #C9871A is too pale for text): the Savings bucket, warnings.

### Neutral
- **Midnight / Daylight background** (#0A1320 / #F2F5F9), **surface** (#101C2E / #FFFFFF), **soft** (#17263B / #E8EEF5), **line** (#223349 / #E1E8F0), **ink** (#E8EEF7 / #0E1B2E), **muted** (#93A5BD / #556579).
- **Error** is coral: #FF8A8A (dark), #C23A3A (light).
- Account colours: GCash periwinkle, Maya emerald, BPI coral, Vybe violet (#C4A0FF dark, #7A3FB8 light); wallet cards use deeper fills (#2F5BD7, #087A5A, #B03030, #7A3FB8) darkened by a gradient to 55%.

### Named Rules
**The Contrast Rule.** Body text is at least 4.5:1 in both themes. Gold fills never carry text in the light theme.
**The Hero Gradient.** One gradient (135deg #10294A to #0B5A4E dark, #0F2A4A to #0B6B5C light, teal glow top right) and it appears once per screen, on the hero.

## Typography

**Display Font:** Plus Jakarta Sans 800, tracking -0.025em, for headings and big numbers.
**Body Font:** Manrope 500/600/700, with `font-variant-numeric: tabular-nums` on every money value.
Both load through the Next.js font loader in `app/layout.tsx` (self-hosted at build, no runtime request).

**Character:** friendly and confident; large rounded figures over calm small text.

### Hierarchy
- **Display** (800, 52px, 1.05): the "left to send" and "yours to spend" figures. 40px on phone.
- **Headline** (800, 30px, 1.12): page and ritual step titles. 25px on phone.
- **Title** (800, 18px): card headings.
- **Body** (500, 15px, 1.45): everything else.
- **Label** (600, 13px, muted): captions, pills, field labels.

## Layout

Four destinations: **Now**, **Month**, **Savings**, **Setup**. Month holds Budget, Installments, Subscriptions and Bonuses; Setup holds Plans, Accounts, Pay, Settings and Import, each reached by a segmented strip at the top of the page (SubNav). Desktop is a 208px left rail plus a main column up to 1680px. Under 760px the rail becomes a four-tab bottom bar and everything is a single column.

**Now** is a guided payday: four steps (pay landed, spoken for, send by wallet, yours to spend), one decision per screen, a sticky action bar at the bottom. Between paydays it shows days to the next payday and a glance at the month. A plan switcher ("Plan: X") and a 1st/2nd cutoff switch travel with the URL across Now, Budget and Transfer; looking at another plan never changes the active one and shows a "Viewing, not active" banner.

Cutoffs run payday to payday (default paydays the 10th and 25th: days 11 to 24, then 25 to the 10th); a cutoff belongs to the month it starts in.

Spacing rhythm: 8, 14 and 20px steps; cards 20px padding; main column padding 24px 32px (16px 14px on phone).

## Elevation & Depth

Flat. Dark uses 1px borders and tonal layers, no shadows. Light adds one soft shadow (`0 6px 20px rgba(14,27,46,.05)`) on cards. The hero is the only gradient surface. Amounts blur (not hide) under Hide amounts.

## Shapes

**Contrast of roundness** (owner decision): structure is nearly square, controls and marks are fully round. Cards 10px, hero 14px, wallet cards 10px, inputs and rail items 8px, chart bars 3px. Buttons, pills, progress bars, avatars, the segmented controls, the ring and Pip are 999px / 50%. Never use mid values (16 to 24px) on cards.

## Components

- **Hero:** gradient card, greeting or step title, the key figure at display size, a thin progress bar, a primary action, Pip on the right.
- **Payday step:** progress bars on top (four), a headline, one card of content, sticky Back / Next actions.
- **Wallet accordion:** account avatar and total on a tappable header; open shows lines you tick in place, plus "Mark <account> all sent".
- **Budget line:** read as a row (name, account chip, amount); tap to edit; saves on leaving a field; Done, Enter or Escape closes. Lines that follow installments and subscriptions show an "Automatic" pill and cannot be edited.
- **Accounts wizard:** four steps (kind, name and last 4 digits only, balance, review). Never asks for a full number, expiry, CVV or PIN.
- **Plan bar:** "Plan: X" disclosure listing plans (Active, Draft, Past) and a Compare link; viewing banner with Make active.
- **Pills, segmented controls, SubNav strip:** fully round, emerald when selected.
- **Pip:** gold coin mascot with a sprout; smiles bigger when everything is sent. Used in the hero, the done step and empty states only.
- **Confirm before delete:** every delete asks first (native confirm), because delete has no undo.

## Do's and Don'ts

**Do**
- Show money as PHP with two decimals and tabular numbers; store centavos.
- Keep copy playful and personal ("Go touch grass"), never jargon.
- Make every control at least 44px tall on phone and keyboard-operable.
- Keep one authored motion moment per screen; confetti only when all transfers are sent.

**Don't**
- Don't put a full card or account number, CVV or PIN anywhere in the UI or the database.
- Don't use mid-radius cards, extra gradients, or gold text on light backgrounds.
- Don't reuse the travel-planner look or the rejected mockups.
- Don't decorate figures; numbers are exact and legible first.
