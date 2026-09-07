# Per-link icons

Date: 2026-09-07
Status: approved design, not yet implemented
Branch: feat/fastapi-backend

## Why

Every link on a published page renders as a label and an arrow. A row
reading "Instagram ↗" says in words what a single glyph says at a glance,
and the Links theme — the one people put in a bio — opens each row with a
sequence number, which carries no information at all.

This design gives every link an icon. The icon is worked out from the link's
address, so an author who pastes `instagram.com/name` gets the Instagram mark
without doing anything, and can override the guess when it is wrong.

## What exists today

There is no icon library in this project. `package.json` has three
dependencies: `next`, `react`, `react-dom`. Every icon in the product is a
hand-drawn inline `<svg>` using `stroke="currentColor"` —
`src/components/PasswordField.tsx`, `src/components/ShareDialog.tsx` — and
`src/lib/qr.ts` is a hand-rolled QR encoder because the published page's CSP
rules out a CDN. Tailwind ships no icons; it is a CSS framework. Heroicons,
Lucide, Feather and Phosphor carry no brand marks by policy.

`LinkItem` is `{ id, label, url }` in `src/lib/types.ts`, mirrored in
`backend/app/schemas/account.py`, and is used by the portfolio header, every
section, and the account profile. It is edited in exactly one component,
`src/components/LinkEditor.tsx`, which three places mount: the header and a
section in `src/components/Editor.tsx`, and the account's default links in
`src/components/account/panels.tsx`.

Links are rendered by two components in `src/components/published/shared.tsx`
— `HeaderLinks`, which has buttons, block and inline variants, and
`SectionLinks` — plus the Links theme's own rows, which draw a numbered badge.

## Decisions

**The icon is derived from the URL, with a stored override.** A stored-only
field would leave every existing link, seed and import without an icon
forever. A derived-only value could never be corrected. Deriving at render
time means the five seeded portfolios and every link already in the database
get icons the moment this ships, with no data migration, and changing a URL
updates the icon on its own.

**A curated set of about thirty icons, copied in, not a dependency.** The
`simple-icons` package carries 3300+ marks; searching all of them needs the
dataset in the browser or a new API endpoint, against a project with three
dependencies. Thirty covers the brands people actually link to, the picker
stays a short list, and adding one later is a two-line edit.

**Both header links and section links.** A section link is often prose —
"Read the case study" — and resolves to a generic glyph rather than a brand
mark, which still reads better than a bare arrow.

**The `↗` stays.** It says the link leaves the page, which is a different
fact from where it goes.

## The icon module

`src/lib/icons.tsx` is new and owns everything about icons.

- `IconId` — a string union of the ids below.
- `ICONS: Record<IconId, { name: string; path: string }>` — one 24×24 path
  per icon, rendered `fill="currentColor"` in a `viewBox="0 0 24 24"`.
- `HOSTS: Array<[suffix: string, id: IconId]>` — registrable domains.
- `iconFor(link: LinkItem): IconId` — stored id if set and known, else a
  hostname match, else `mailto:` / `tel:` detection, else `"link"`.
- `LinkIcon({ id, size })` — the component every caller uses.

The set: instagram, whatsapp, youtube, snapchat, linkedin, x, facebook,
tiktok, threads, github, gitlab, behance, dribbble, figma, medium, substack,
notion, spotify, soundcloud, vimeo, twitch, discord, telegram, bluesky, and
the non-brand glyphs email, phone, calendar, document, globe and link.

Short forms need their own `HOSTS` entries: `youtu.be`, `wa.me`, `lnkd.in`,
`t.me`, `fb.me`.

The paths come from Simple Icons and are CC0; `icons.tsx` carries a header
comment saying so with the source URL. The brands themselves are trademarks.
Pointing a mark at the author's own profile is ordinary nominative use, and
nothing in the product may place one where it implies endorsement.

## Data

`LinkItem` gains an **optional** `icon?: string`. Absent means "decide from
the address". On the API it is `icon: str = Field(default="", max_length=32)`.

Optional rather than required: `Section.tab` is required because a blank tab
makes a section unreachable, but an icon override is genuinely optional, and
requiring it would put `icon: ""` on every link in `src/lib/seed.ts` — twenty
edits that each say nothing. `normalize()` leaves the field alone.

Links live in JSON columns, so there is no check constraint to widen and no
migration. An unknown id renders the generic glyph, the same way an unknown
theme falls back to Editorial.

## The picker

`src/components/IconSelect.tsx`, built on the pattern of
`src/components/builder/FontSelect.tsx`: a trigger button showing the link's
current icon, opening a panel that **closes on a backdrop element, not a
`document` listener**. FontSelect does that because the builder's canvas is an
iframe; the reason is weaker here, but the idiom is the house one.

The panel is a search field over a grid of 24px glyphs, each labelled. The
first entry is always **Automatic**, drawn as whatever the URL currently
resolves to with the word "Automatic" beneath it; choosing it writes `""`,
which is how an override is undone. Search filters on name and id, so "insta"
and "wa" both find what the author expects.

The trigger re-resolves on every keystroke of the address field, so pasting a
URL makes the icon appear immediately. That comes free from `iconFor` being a
pure function of the link.

`LinkEditor`'s inner grid goes from `sm:grid-cols-[170px_1fr]` to
`sm:grid-cols-[40px_170px_1fr]` — icon, label, address. At narrow widths the
grid already stacks and the icon button sits above the label. The remove
button is unchanged.

Glyphs are `aria-hidden` with their name carried in text; the trigger's
`aria-label` names the current icon.

## Rendering

`HeaderLinks`' three variants and `SectionLinks`, both in
`published/shared.tsx`, each render `<LinkIcon id={iconFor(l)} />` before the
label at 16px, `flex-none`, inside an `inline-flex items-center gap-2`. That
covers Editorial, Poster and Site through the buttons variant, Résumé through
the inline variant, and `SectionDetail` — artboard 1d — through
`SectionLinks`. The glyphs inherit the surrounding colour, so no theme needs
per-icon colour work.

One theme changes beyond what it inherits. The Links rows open with a
numbered badge — `01`, `02` — in
`src/components/published/themes/links.tsx`. That badge becomes the icon of
the row's first link at 20px, falling back to the number when the row has no
link or resolves to the generic glyph. This is the one place an icon carries
meaning rather than decoration, and it is what makes Links read as a
link-in-bio page instead of a numbered list.

`/print` is unaffected: the glyphs are inline `currentColor` SVG and print
like text.

## Risks

**Hostname matching is where this misbehaves.** Three traps, each with its
answer in the design:

1. URLs are written bare, and sometimes as paths. `src/lib/seed.ts` has
   `url: "/in/rohanmehta"` on a link labelled LinkedIn; `href()` turns that
   into `https://in/rohanmehta`, whose hostname is `in`, so it resolves to the
   generic glyph. This is exactly what the override exists for — those seeds
   set `icon: "linkedin"` explicitly. Editing `seed.ts` means re-running
   `node backend/scripts/dump_seed.mjs` to regenerate
   `backend/app/seed_data.json`, which is generated from it and never edited
   by hand.
2. Matching is on the registrable domain: hostname equal to the suffix, or
   ending in `"." + suffix`. Never a substring test — `mysite.com/instagram-clone`
   must not get the Instagram mark.
3. `new URL()` throws on a half-typed address and the editor writes on every
   keystroke, so `iconFor` wraps in `try/catch` and returns `"link"`. It runs
   during render in every theme and must never throw.

**Bundle cost** is about 30 paths of a few hundred bytes each — under 15KB of
source, inlined, no dependency added.

## Verification

```
npm run lint
npm run build                                   # with the dev server stopped
cd backend && .venv/bin/python -m pytest         # 269 today
```

New backend tests: a link round-trips its `icon`, and a link sent without one
still validates.

By hand, since there is no frontend test runner: paste an Instagram URL and
watch the icon appear without opening the picker; override it and confirm the
trigger stops saying Automatic; clear it back to Automatic; check all five
themes on both the header row and a section's links; check the Links rows show
the brand mark in place of the number and fall back to the number when a row
has no link; check `/print` and `?section=<id>`; check the account's default
links; and check a dark ground, since the glyphs take `currentColor`.
