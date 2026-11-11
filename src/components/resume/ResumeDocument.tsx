import type { CSSProperties, ReactNode } from "react";
import { layerStyle, sheetLayers } from "@/lib/resume-backdrops";
import {
  BLOCK_LABEL,
  SIDE_BLOCKS,
  bareUrl,
  contactItems,
  dateRange,
  faceVar,
  headlineOf,
  hrefFor,
  initialsOf,
  sectionGroups,
  sheetMetrics,
  sheetParts,
  summaryOf,
  visibleBlocks,
  type ContactItem,
} from "@/lib/resume";
import { assetSrc, type Portfolio, type ResumeBlock } from "@/lib/types";

/* ── the resume sheet ─────────────────────────────────────────────────────
   Every template, one markup. Each template is the same document — a
   header, then blocks of entries — and `resume.css` gives each its look off
   the parts its catalogue row names (`data-header`, `data-heading`, …).
   That keeps the reading order identical whichever is picked, which is what
   an ATS reads: real text, real headings, in order, never an image of a
   page. A two-column template moves blocks between columns, never inside
   one, and the name always comes first.

   The sheet is paper, so it is white with dark ink whatever theme the app
   is in. Sizes are in mm and pt so the preview and the PDF agree.
   ──────────────────────────────────────────────────────────────────────── */

export function ResumeDocument({ p, print = false }: { p: Portfolio; print?: boolean }) {
  const r = p.resume;
  const t = sheetParts(r);
  const m = sheetMetrics(r);
  const blocks = visibleBlocks(p);
  const twoColumns = t.layout !== "one";
  const main = twoColumns ? blocks.filter((b) => !SIDE_BLOCKS.has(b)) : blocks;
  const side = twoColumns ? blocks.filter((b) => SIDE_BLOCKS.has(b)) : [];
  const photo = r.style.photo ? assetSrc(p.header.portrait) : undefined;
  const contact = contactItems(p);
  // A left column, or a solid one either side, holds the contact details and
  // the photo; otherwise they belong to the header.
  const asideContact = twoColumns && (t.layout === "left" || t.aside === "solid");

  const style = {
    "--r-accent": r.style.accent,
    "--r-head": faceVar(r.style.headingFont),
    "--r-body": faceVar(r.style.font),
    "--r-gap": m.gap,
    "--r-mx": `${m.marginX}mm`,
    "--r-my": `${m.marginY}mm`,
    "--r-aside-w": `${t.asideW}mm`,
    "--r-col-gap": `${t.colGap}mm`,
    ...sheetBackground(r),
    width: `${m.paper.w}mm`,
    minHeight: print ? undefined : `${m.paper.h}mm`,
    padding: `${m.marginY}mm ${m.marginX}mm`,
    fontSize: `${m.pt}pt`,
  } as CSSProperties;

  const photoEl = photo && (
    // An API URL — nothing for next/image to optimise, and the print route
    // must not wait on an image pipeline.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="r-photo" src={photo} alt="" />
  );
  const blockProps = { p, orgFirst: t.entry === "org", chips: t.skills !== "lines" };

  return (
    <article
      className={`resume${print ? " resume-print" : ""}`}
      data-template={t.id}
      data-layout={t.layout}
      data-aside={twoColumns ? t.aside : undefined}
      data-header={t.header}
      data-heading={t.heading}
      data-entry={t.entry}
      data-skills={t.skills}
      data-contact={t.contact}
      style={style}
    >
      <header className="r-header" data-initials={initialsOf(p.header.name) || undefined}>
        <div className="r-who">
          <h1 className="r-name">{p.header.name.trim() || "Your name"}</h1>
          {headlineOf(p) && <p className="r-headline">{headlineOf(p)}</p>}
        </div>
        {!asideContact && <Contact items={contact} />}
        {!asideContact && photoEl}
      </header>
      {twoColumns ? (
        <div className="r-columns">
          {t.layout === "left" ? (
            <>
              <aside className="r-aside">
                {asideContact && <AsideContact photo={photoEl} items={contact} />}
                {side.map((b) => (
                  <Block key={b} {...blockProps} block={b} narrow />
                ))}
              </aside>
              <div className="r-main">
                {main.map((b) => (
                  <Block key={b} {...blockProps} block={b} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="r-main">
                {main.map((b) => (
                  <Block key={b} {...blockProps} block={b} />
                ))}
              </div>
              <aside className="r-aside">
                {asideContact && <AsideContact photo={photoEl} items={contact} />}
                {side.map((b) => (
                  <Block key={b} {...blockProps} block={b} narrow />
                ))}
              </aside>
            </>
          )}
        </div>
      ) : (
        <div className="r-body">
          {blocks.map((b) => (
            <Block key={b} {...blockProps} block={b} />
          ))}
        </div>
      )}
      {blocks.length === 0 && !print && (
        <p className="r-empty">
          Add your experience, education and skills under Edit text, and they appear here.
        </p>
      )}
    </article>
  );
}

/**
 * The sheet's background: top-of-page decoration, then the repeating
 * pattern, then the paper ground. On screen the sheet paints it. In print
 * `resume.css` clears it and `/resume/[id]` paints the same layers on the
 * page itself (`sheetLayers()`), which reaches every page's edges — the
 * sheet starts below each page's top margin and stops where its text does.
 */
function sheetBackground(r: Portfolio["resume"]) {
  return layerStyle(sheetLayers(r));
}

function AsideContact({ photo, items }: { photo: ReactNode; items: ContactItem[] }) {
  return (
    <>
      {photo}
      {items.length > 0 && (
        <section className="r-block" data-block="contact">
          <h2 className="r-h">Contact</h2>
          <div className="r-content">
            <Contact items={items} />
          </div>
        </section>
      )}
    </>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Contact({ items }: { items: ContactItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="r-contact">
      {items.map((c, i) => (
        <li key={`${c.kind}-${i}`}>
          <ContactGlyph kind={c.kind} />
          {c.href ? <a href={c.href}>{c.text}</a> : <span>{c.text}</span>}
        </li>
      ))}
    </ul>
  );
}

function ContactGlyph({ kind }: { kind: ContactItem["kind"] }) {
  const d: Record<ContactItem["kind"], ReactNode> = {
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
    location: (
      <>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d[kind]}
    </svg>
  );
}

function Block({
  p,
  block,
  orgFirst,
  chips,
  narrow = false,
}: {
  p: Portfolio;
  block: ResumeBlock;
  orgFirst: boolean;
  chips: boolean;
  narrow?: boolean;
}) {
  const r = p.resume;
  const ivy = orgFirst;

  let body: ReactNode = null;
  switch (block) {
    case "summary":
      body = <p className="r-text">{summaryOf(p)}</p>;
      break;

    case "experience":
      body = (
        <div className="r-list">
          {r.experience
            .filter((e) => e.role.trim() || e.company.trim())
            .map((e) => (
              <Entry
                key={e.id}
                ivy={ivy}
                title={e.role}
                org={e.company}
                place={e.location}
                when={dateRange(e.start, e.end, e.current)}
              >
                {e.bullets.some((b) => b.trim()) && (
                  <ul className="r-bullets">
                    {e.bullets
                      .filter((b) => b.trim())
                      .map((b, i) => (
                        <li key={i}>{b.trim().replace(/^[-•*]\s*/, "")}</li>
                      ))}
                  </ul>
                )}
              </Entry>
            ))}
        </div>
      );
      break;

    case "education":
      body = (
        <div className="r-list">
          {r.education
            .filter((e) => e.degree.trim() || e.school.trim())
            .map((e) => (
              <Entry key={e.id} ivy={ivy} title={e.degree} org={e.school} place={e.location} when={dateRange(e.start, e.end)}>
                {e.detail.trim() && <p className="r-text r-detail">{e.detail.trim()}</p>}
              </Entry>
            ))}
        </div>
      );
      break;

    case "projects":
      // The page's own sections, as entries under one heading.
      return (
        <>
          {sectionGroups(p).map((g) => (
            <section key={g.tab} className="r-block" data-block="projects">
              <h2 className="r-h">{g.tab}</h2>
              <div className="r-content">
                <div className="r-list">
                  {g.items.map((s) => (
                    <div key={s.id} className="r-entry">
                      <div className="r-what">
                        <div className="r-entry-head">
                          <h3 className="r-title">{s.title}</h3>
                          {s.url && (
                            <a className="r-meta" href={hrefFor(s.url)}>
                              {bareUrl(s.url)}
                            </a>
                          )}
                        </div>
                        {s.description && <p className="r-text r-detail">{s.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </>
      );

    case "skills": {
      const groups = r.skills.filter((g) => g.items.some((i) => i.trim()));
      body =
        narrow || chips ? (
          <div className="r-skill-groups">
            {groups.map((g) => (
              <div key={g.id}>
                {g.name.trim() && <h3 className="r-skill-name">{g.name}</h3>}
                <ul className="r-chips">
                  {g.items
                    .filter((i) => i.trim())
                    .map((i) => (
                      <li key={i} className="r-chip">
                        {i}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="r-skills">
            {groups.map((g) => (
              <li key={g.id} className="r-skill-line">
                {g.name.trim() && <b>{g.name.trim()}: </b>}
                {g.items.filter((i) => i.trim()).join(", ")}
              </li>
            ))}
          </ul>
        );
      break;
    }

    case "certifications":
      body = (
        <ul className="r-small-list">
          {r.certifications
            .filter((c) => c.name.trim())
            .map((c) => (
              <li key={c.id}>
                {c.url.trim() ? (
                  <a className="r-strong" href={hrefFor(c.url)}>
                    {c.name}
                  </a>
                ) : (
                  <span className="r-strong">{c.name}</span>
                )}
                {(c.issuer.trim() || c.date.trim()) && (
                  <span className="r-faint">{[c.issuer.trim(), c.date.trim()].filter(Boolean).join(" · ")}</span>
                )}
              </li>
            ))}
        </ul>
      );
      break;

    case "languages":
      body = (
        <ul className="r-small-list r-languages">
          {r.languages
            .filter((l) => l.name.trim())
            .map((l) => (
              <li key={l.id}>
                <span className="r-strong">{l.name}</span>
                {l.level.trim() && <span className="r-faint">{l.level}</span>}
              </li>
            ))}
        </ul>
      );
      break;

    case "awards":
      body = (
        <ul className="r-small-list">
          {r.awards
            .filter((a) => a.title.trim())
            .map((a) => (
              <li key={a.id}>
                <span className="r-strong">{a.title}</span>
                {(a.issuer.trim() || a.date.trim()) && (
                  <span className="r-faint">{[a.issuer.trim(), a.date.trim()].filter(Boolean).join(" · ")}</span>
                )}
                {a.detail.trim() && <span className="r-text r-detail">{a.detail.trim()}</span>}
              </li>
            ))}
        </ul>
      );
      break;
  }

  return (
    <section className="r-block" data-block={block}>
      <h2 className="r-h">{BLOCK_LABEL[block]}</h2>
      <div className="r-content">{body}</div>
    </section>
  );
}

/**
 * One role or degree. Most templates lead with the role and put the
 * organisation under it; the `org` entry (Ivy League, Executive, …) leads
 * with the organisation, the convention Ivy League is named for. The dates
 * are written twice — once in the heading line, once in a gutter only the
 * `timeline` and `gutter` entries show — so no template has to move a node
 * to change where they sit.
 */
function Entry({
  ivy,
  title,
  org,
  place,
  when,
  children,
}: {
  ivy: boolean;
  title: string;
  org: string;
  place: string;
  when: string;
  children?: ReactNode;
}) {
  const first = ivy ? org.trim() || title.trim() : title.trim() || org.trim();
  const second = ivy ? (org.trim() ? title.trim() : "") : title.trim() ? org.trim() : "";

  return (
    <div className={`r-entry${when ? " has-when" : ""}`}>
      {when && <div className="r-when">{when}</div>}
      <div className="r-what">
        <div className="r-entry-head">
          <h3 className="r-title">{first}</h3>
          {ivy ? place.trim() && <span className="r-meta">{place.trim()}</span> : when && <span className="r-meta">{when}</span>}
        </div>
        {(second || (!ivy && place.trim()) || (ivy && when)) && (
          <div className="r-entry-head r-sub-line">
            <p className="r-sub">
              {second}
              {!ivy && second && place.trim() && " · "}
              {!ivy && place.trim()}
            </p>
            {ivy && when && <span className="r-meta">{when}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
