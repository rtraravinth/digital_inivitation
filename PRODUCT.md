# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers are the primary users. The situation is an active application:
they have a role in front of them, a résumé already written, and a need for
something the résumé cannot be — a page tailored to this employer that holds
only the part of their history the role cares about. They reach for FACET per
application, not once a year, so creating a second page has to cost minutes.

Because the page outlives the application, the same account also holds a full
page covering everything the person does; the tailored pages are slices of it.

## Product Purpose

FACET builds published web pages for one person's work. A portfolio is a
header plus any number of sections, each with the same four fields — title,
description, tab, links — and is published at `facet.page/<handle>/<slug>` in
one of five themes.

Success is a complete, production-grade build that demonstrates the author's
own capability to prospective employers and clients. FACET is itself a
portfolio piece: the artifact being judged is the implementation, not a user
count. That makes finish, correctness and craft the measures, and makes
half-built surfaces more costly here than missing features.

## Positioning

Three claims a neighboring portfolio builder could not truthfully copy:

- **Many pages, one identity.** One account holds several portfolios, each a
  different slice of the same person, each with its own public address. This
  is the "facet" in the name and the reason the data model is per-page rather
  than per-profile.
- **Tabs as the only route.** Every section files under exactly one required
  tab, and the tab row is the published page's only navigation. There is no
  "All work" tab and no everything-state — one tab is always open. Authors
  are therefore forced to decide what each section is for.
- **Total typographic control.** Fourteen headline faces with a real body
  pairing, any accent colour and any ground colour, and five themes that each
  reinterpret the same content rather than reskinning one layout.

## Operating Context

- An author edits in two places for the same data: a document-style editor
  and a three-pane builder with a live device-accurate canvas.
- The published page is read by strangers — hiring managers, visitors
  following a link — who are not signed in and get no owner affordances.
- Authors open the app from phones as well as desktops; the API binds to every
  interface specifically so a LAN address works from a phone.
- Pages are printed. `/print` stacks every published page so the browser's own
  Save as PDF exports them, and `/stats` prints a QR code that must actually
  scan.
- Addresses are shared by hand, so a slug is global: two accounts cannot both
  hold `rohan`.

## Capabilities and Constraints

Real and working: accounts, sign-in, passwords, two-step verification (TOTP),
single-use recovery codes, the signed-in device list with revoke, portfolios,
sections, uploads, publishing, all four privacy switches, view and click
analytics, export/import.

Declared unbuilt on screen, each needing a third-party service this project
has not chosen: **billing**, **custom domains**, **email notifications**. Each
renders a notice saying the setting is stored and enforces nothing. Adding a
backend means deleting its notice in the same change.

Technical constraints that bind design work:

- Next.js 16 App Router frontend; FastAPI on PostgreSQL backend. The frontend
  does nothing without the API — no local fallback, and there should not be
  one.
- The published page is server-rendered, because the privacy switches are
  enforced in that response and `generateMetadata` is what emits the robots
  tag. It must not become a client fetch.
- The published page's CSP rules out a CDN. Fonts, icons and the QR encoder
  are therefore in-repo; no external script or asset source may be introduced
  casually.
- A live portfolio is frozen: every portfolio and section write answers 409
  until it is unpublished.
- No frontend test runner. Changes are verified with `npm run lint`,
  `npm run build`, and by opening the app. The backend has 271 pytest tests.

Terminology: a **portfolio** is one page; a **section** is one entry on it; a
**tab** groups sections and is required. `p.layout.roleNav` and `p.font` keep
their names because they are wire format and stored values; every label they
show says "tab" and "headline" respectively.

## Brand Commitments

- The product is named **FACET**, and the name carries the positioning: one
  person, many faces of the same work.
- The incumbent design system is **Modernist** and is binding on the app's own
  chrome: Archivo, `#f3f2f2` ground, `#201e1d` ink, one accent `#ec3013`, zero
  border radius anywhere, 2px dividers, flush-left labels, grayscale
  photography.
- There is no LinkedIn icon and there will not be one. Simple Icons removed
  the mark at LinkedIn's request over trademark enforcement, so no CC0 path
  exists and this repo does not redistribute it; `linkedin.com` and `lnkd.in`
  resolve to a generic briefcase glyph labelled "Profile".
- Source of truth for the surfaces is a Claude Design canvas,
  `Portfolio Page.dc.html`, running to five turns. Where the canvas and the
  build disagree, the deliberate divergences are recorded in CLAUDE.md under
  "Known gaps" and stay as they are: five themes not twelve, no block
  manager, buttons not drag for reordering.

## Evidence on Hand

- Five seeded portfolios in `src/lib/seed.ts`, written around one persona
  (Rohan Mehta — founder, SEBI-registered adviser, writer, trustee). This is
  demonstration content, not a customer.
- Real analytics: views of `/p/[slug]` and clicks on section links, counted
  from event rows across every visitor. **Never replace these with generated
  or placeholder figures** — show an empty state instead.
- No real customers, testimonials, press, pricing, benchmarks or uptime
  record exist. Do not fabricate any of them on any surface.
- There is no marketing site, landing page or pricing page yet.

## Product Principles

1. **A tailored page in minutes, or the product has no reason to exist.**
   Creating a second portfolio and deciding what goes in it is the job; every
   step between intent and a published address is cost.
2. **The author decides what a section is for.** The required tab is a
   deliberate constraint, not friction to be smoothed away.
3. **Nothing pretends.** Unbuilt settings say so on screen, analytics are
   counted or absent, a failed save raises a banner. A silent failure or a
   plausible-looking placeholder is the worst outcome available.
4. **Finish beats surface area.** This build is judged as a craft artifact, so
   a complete surface outranks a new half-built one.
5. **The published page belongs to its visitor, not its author.** It is
   server-rendered, owner-free, privacy-filtered, printable and shareable by a
   bare address.

## Accessibility & Inclusion

No externally imposed standard was established. Two product-specific needs
are already binding in the build and must hold:

- Reordering is keyboard-reachable (up/down buttons, not drag).
- The body must never scroll horizontally at any width; the nav wraps rather
  than pushing its primary action off-screen.

Contrast is derived rather than enforced for author-picked ground colours —
`derivedGround()` chooses whichever ink contrasts better — and a mid-grey
ground tops out around 4.2:1. That is a known accepted limit, not an
oversight.
