# Publishing the resume on its own

## Intent

Publishing becomes the moment a user pays. The plans come next and are
not part of this change:

| Plan      | Who                                           | Price | Can publish            |
|-----------|-----------------------------------------------|-------|------------------------|
| Resume    | students                                      | ₹399  | the resume             |
| Portfolio | entrepreneurs, doctors, musicians; students who upgrade | ₹999  | the page and the resume |

Today the builder's "Download PDF" works on a draft. A user could build a
resume, download it, and never publish (never pay). So the PDF must come
only from a published resume. To give the ₹399 plan something to share,
the resume gets its own public address as well as the download.

This change makes **published** the gate. A later change makes the
**plan** decide which of the two things may be published.

## Goals

- The page and the resume each have their own published state, switched
  separately.
- A published resume has a public address,
  `<subdomain>.facetfolio.com/<slug>/resume`, where anyone with the link
  sees the resume sheet and can download it as a PDF.
- No PDF of a draft resume. The builder shows the draft with a "Preview"
  watermark and no download button.
- The owner chooses, at publish time, which contact details the public
  resume shows.
- The publish screen is where a user gets their links and the PDF.

## Non-goals

- Plans, prices, payment and plan checks. That is the next change.
- View or download counts for the resume.
- A "Download resume" link on the published page itself. Easy to add
  later; left out so the page's look does not change here.
- Stopping a determined user from screenshotting or printing the
  watermarked preview. The watermark makes a free copy look unfinished;
  it is not DRM.

## Anti-goals

These would make the change a failure even if it worked:

- A draft resume's PDF is reachable by typing an address.
- A phone number or email the owner unticked reaches a visitor, in the
  page, the API response or the PDF.
- The public resume is indexed by search engines.
- A page can no longer be published without its resume being public too.

## Approaches considered

1. **Two independent switches.** Picked. The portfolio keeps `status`
   for the page and gains a separate resume status. Each is published and
   unpublished on its own. This costs more checks ("is either live?"),
   but it matches two products sold separately and keeps "page without
   resume" possible.
2. **One status, three steps (draft → resume → live).** Less code. But
   the page could never be public without the resume, so a ₹999 user
   could not keep their resume private. Rejected.
3. **Download only, no public resume address.** Rejected by the user:
   the ₹399 plan needs something to share.

## Decisions

### Data

- `portfolios.resume_status`: `draft` | `live`, not null, default `draft`.
  Migration adds it. Existing rows get `draft`: nobody's resume becomes
  public without them asking. Wire name: `resumeStatus`.
- What the public resume shows of the contact details is a resume-only
  setting in the resume JSON: `publicContact: {email, phone, location,
  website}`, all booleans, default all `true`. It is added to
  `RESUME_ONLY_FIELDS`, so it can be changed while the resume is live. A
  privacy choice must never need an unpublish. The header's links print
  in the resume's contact line too (`contactItems()`); on the public
  resume they follow the `website` tick, because a resume-only user's
  links are not public anywhere else. (Builder's call.)
- `normalize()` backfills both fields.
- An import always lands with `resumeStatus: draft`, except `trusted`,
  the same as `status`.

### API

- `POST /portfolios/{id}/resume/publish` and `/resume/unpublish`, taking
  `OwnedPortfolio`, mirroring the page's publish and unpublish.
- **The freeze covers both.** `EditablePortfolio` answers 409
  `portfolio_published` while `status == "live"` **or**
  `resume_status == "live"`, because the resume is built from the same
  sections. `PUT /resume` keeps allowing `RESUME_ONLY_FIELDS` while either
  is live.
- `GET /public/p/{subdomain}/{slug}/resume`, with a custom-domain variant
  like the page's. It answers only while `resume_status == "live"` (404
  otherwise, the same as a wrong slug). It returns what the sheet needs:
  - the header's name, current line, about and portrait;
  - the sections on the resume, with only the components that print;
  - the lists those components place;
  - the template and style;
  - only the contact details ticked in `publicContact`.

  The API drops the unticked ones; the frontend never receives them.
- **The public asset route** also serves the header portrait while the
  resume is live and `style.photo` is on. Today it only serves assets on
  a live page.
- The owner's `/resume/[id]` print route answers only while the resume is
  live. Before that it shows "Publish your resume to download it" with a
  link to the publish screen. The owner's own PDF keeps every contact
  detail, ticked or not: it is their copy.

### Frontend routes

- `src/proxy.ts` already rewrites a subdomain's whole path, so
  `/<slug>/resume` arrives at `/p/<subdomain>/<slug>/resume`. Add that
  route, and `/d/<domain>/<slug>/resume`, as server components.
  - They fetch the public resume and render `ResumeDocument`.
  - Above the sheet sits a small "Download PDF" bar, which is not
    printed.
  - `?print=1` opens the print dialog, as `/resume/[id]` does today.
  - `generateMetadata` always emits `noindex`.
- On the app's host, `/p/<subdomain>/<slug>/resume` 308-redirects to the
  subdomain, like the page's address.
- `liveUrl()` gains a resume form (`resumeUrl()`). Every resume link a
  visitor gets is built there.

### Publishing UI

- **The editor's "Publish" opens a dialog**: two checkboxes, "Page" and
  "Resume", both ticked by default.
  - Under "Resume" sit the contact ticks, each showing its actual value
    (e.g. "Phone · +91 98…").
  - One "Publish" button publishes what is ticked.
  - Contact details that are empty are not offered.
- **The publish screen** (`PublishedLock`) shows one row per live thing.
  - Each row has its address and "Copy link".
  - The resume row also has "Download PDF".
  - A thing not published gets a "Publish resume" or "Publish page"
    button in its place.
  - "Unpublish" is per thing.
  - The editor stays locked while either is live, as today.
- **The builder's Resume side has no "Download PDF".**
  - A draft resume's sheet carries a diagonal "Preview" watermark, on
    screen only.
  - A live resume shows "Download PDF" and its link instead, so a live
    user restyling the resume can still download.
- **The portfolio list** shows "Page live" and "Resume live" as separate
  pills.
  - Share offers whichever addresses are live.
  - The Share dialog lists the resume address too.

### Store

`updatePortfolio` unpublishes before its patches and republishes after,
because a live portfolio is frozen. It must do this for the resume status
too: unpublish whichever is live, patch, then republish the same ones.

## Left to the builder

- Exact copy and layout of the publish dialog and the publish-screen rows,
  within the Mono design system.
- Exact watermark styling. It must not change the sheet's layout or page
  count.
- Test coverage. At minimum, tests that pin:
  - the 404 on a draft resume;
  - that an unticked contact detail never appears in the public response;
  - that the freeze applies under either status;
  - that the portrait is served only while the resume is live with the
    photo on;
  - the import default.
- CodeQL scan, as AGENTS.md requires (API, schema and migration change).
- CLAUDE.md: update "The resume", "A live portfolio is frozen" and the
  CLAUDE.md line about the resume's contact line never leaving the
  account (it now leaves when ticked).
