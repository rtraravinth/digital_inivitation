import type { CSSProperties, ReactNode } from "react";
import { layerStyle, sheetLayers } from "@/lib/resume-backdrops";
import {
  bareUrl,
  contactItems,
  dateRange,
  faceVar,
  headlineOf,
  hrefFor,
  initialsOf,
  isSidePart,
  resumeParts,
  sheetMetrics,
  sheetParts,
  summaryOf,
  summaryShown,
  type ContactItem,
  type ResumePart,
} from "@/lib/resume";
import {
  assetSrc,
  isListBlock,
  type Block,
  type ResumeListBlock,
  type Portfolio,
  type Section,
} from "@/lib/types";

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

export function ResumeDocument({
  p,
  print = false,
}: {
  p: Portfolio;
  print?: boolean;
}) {
  const r = p.resume;
  const t = sheetParts(r);
  const m = sheetMetrics(r);
  // The page's own sections, in its order: each one's title, and under it
  // the components with "Print on your resume" checked.
  const parts = resumeParts(p);
  const summary = summaryShown(p);
  const twoColumns = t.layout !== "one";
  const main = twoColumns ? parts.filter((x) => !isSidePart(x)) : parts;
  const side = twoColumns ? parts.filter(isSidePart) : [];
  const photo = r.style.photo ? assetSrc(p.header.portrait) : undefined;
  const contact = contactItems(p);
  // A left column, or a solid one either side, holds the contact details and
  // the photo; otherwise they belong to the header.
  const asideContact =
    twoColumns && (t.layout === "left" || t.aside === "solid");

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
  const partProps = {
    p,
    orgFirst: t.entry === "org",
    chips: t.skills !== "lines",
  };
  const summaryEl = summary && (
    <section className="r-block" data-block="summary">
      <h2 className="r-h">Summary</h2>
      <div className="r-content">
        <p className="r-text">{summaryOf(p)}</p>
      </div>
    </section>
  );

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
      <header
        className="r-header"
        data-initials={initialsOf(p.header.name) || undefined}
      >
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
                {asideContact && (
                  <AsideContact photo={photoEl} items={contact} />
                )}
                {side.map((x) => (
                  <Part key={x.section.id} {...partProps} part={x} narrow />
                ))}
              </aside>
              <div className="r-main">
                {summaryEl}
                {main.map((x) => (
                  <Part key={x.section.id} {...partProps} part={x} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="r-main">
                {summaryEl}
                {main.map((x) => (
                  <Part key={x.section.id} {...partProps} part={x} />
                ))}
              </div>
              <aside className="r-aside">
                {asideContact && (
                  <AsideContact photo={photoEl} items={contact} />
                )}
                {side.map((x) => (
                  <Part key={x.section.id} {...partProps} part={x} narrow />
                ))}
              </aside>
            </>
          )}
        </div>
      ) : (
        <div className="r-body">
          {summaryEl}
          {parts.map((x) => (
            <Part key={x.section.id} {...partProps} part={x} />
          ))}
        </div>
      )}
      {parts.length === 0 && !summary && !print && (
        <p className="r-empty">
          Switch a section onto the resume in Edit content, and check “Print on
          your resume” on what it should print.
        </p>
      )}
    </article>
  );
}

/**
 * The sheet's background: top-of-page decoration, then the repeating
 * pattern, then the paper ground. On screen the sheet paints it. In print
 * `resume.css` clears it and `/preview/resume/[id]` paints the same layers on the
 * page itself (`sheetLayers()`), which reaches every page's edges — the
 * sheet starts below each page's top margin and stops where its text does.
 */
function sheetBackground(r: Portfolio["resume"]) {
  return layerStyle(sheetLayers(r));
}

function AsideContact({
  photo,
  items,
}: {
  photo: ReactNode;
  items: ContactItem[];
}) {
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
    phone: (
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    ),
    location: (
      <>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    link: (
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d[kind]}
    </svg>
  );
}

/**
 * One of the page's sections on the resume: its title, then each checked
 * component in the section's order. A component's own heading goes over it
 * as a subheading, unless it only repeats the section's title.
 */
function Part({
  part,
  orgFirst,
  chips,
  narrow = false,
}: {
  part: ResumePart;
  orgFirst: boolean;
  chips: boolean;
  narrow?: boolean;
}) {
  const { section: s, blocks } = part;
  const title = s.title.trim();
  return (
    <section
      className="r-block"
      data-block={blocks.length === 1 ? blocks[0].type : "section"}
    >
      {title && <h2 className="r-h">{title}</h2>}
      {blocks.length > 0 && (
        <div className="r-content">
          {blocks.map((b) => {
            const heading = b.title.trim();
            return (
              <div key={b.id} className="r-component">
                {heading && heading.toLowerCase() !== title.toLowerCase() && (
                  <h3 className="r-sub-h">{heading}</h3>
                )}
                {isListBlock(b) ? (
                  <ListBody
                    block={b}
                    orgFirst={orgFirst}
                    chips={chips}
                    narrow={narrow}
                  />
                ) : (
                  <ComponentBody section={s} block={b} orgFirst={orgFirst} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A page component's words, set as resume text. */
function ComponentBody({
  section: s,
  block: b,
  orgFirst,
}: {
  section: Section;
  block: Block;
  orgFirst: boolean;
}) {
  switch (b.type) {
    case "text":
      return <p className="r-text">{s.description.trim()}</p>;
    case "links":
      return (
        <ul className="r-small-list">
          {s.links
            .filter((l) => l.url.trim())
            .map((l) => (
              <li key={l.id}>
                {l.label.trim() && (
                  <span className="r-strong">{l.label.trim()}</span>
                )}
                <a className="r-faint" href={hrefFor(l.url)}>
                  {bareUrl(l.url)}
                </a>
              </li>
            ))}
        </ul>
      );
    case "quote":
      return (
        <p className="r-text">
          “{s.quote?.text.trim()}”
          {s.quote?.attribution.trim() && (
            <span className="r-faint"> — {s.quote.attribution.trim()}</span>
          )}
        </p>
      );
    case "timeline":
      return (
        <div className="r-list">
          {b.items
            .filter((i) => i.title.trim() || i.text.trim())
            .map((i) => (
              <Entry
                key={i.id}
                ivy={orgFirst}
                title={i.title}
                org=""
                place=""
                when={i.date.trim()}
              >
                {i.text.trim() && (
                  <p className="r-text r-detail">{i.text.trim()}</p>
                )}
              </Entry>
            ))}
        </div>
      );
    case "testimonials":
      return (
        <ul className="r-small-list">
          {b.items
            .filter((i) => i.quote.trim())
            .map((i) => (
              <li key={i.id}>
                <span className="r-text">“{i.quote.trim()}”</span>
                {(i.name.trim() || i.role.trim()) && (
                  <span className="r-faint">
                    {[i.name.trim(), i.role.trim()].filter(Boolean).join(", ")}
                  </span>
                )}
              </li>
            ))}
        </ul>
      );
    case "clients":
      return (
        <p className="r-text">
          {b.items
            .map((i) => i.name.trim())
            .filter(Boolean)
            .join(" · ")}
        </p>
      );
    case "stats":
      return (
        <ul className="r-small-list">
          {b.items
            .filter((i) => i.value.trim() || i.label.trim())
            .map((i) => (
              <li key={i.id}>
                <span className="r-strong">{i.value.trim()}</span>
                {i.label.trim() && (
                  <span className="r-faint">{i.label.trim()}</span>
                )}
              </li>
            ))}
        </ul>
      );
    case "tabs":
    case "services":
    case "faq": {
      const rows =
        b.type === "tabs"
          ? b.items.map((i) => ({
              id: i.id,
              head: i.label,
              side: "",
              text: i.text,
            }))
          : b.type === "services"
            ? b.items.map((i) => ({
                id: i.id,
                head: i.title,
                side: i.price,
                text: i.text,
              }))
            : b.items.map((i) => ({
                id: i.id,
                head: i.question,
                side: "",
                text: i.answer,
              }));
      return (
        <ul className="r-small-list">
          {rows
            .filter((r) => r.head.trim() || r.text.trim())
            .map((r) => (
              <li key={r.id}>
                <span className="r-strong">{r.head.trim()}</span>
                {r.side.trim() && (
                  <span className="r-faint">{r.side.trim()}</span>
                )}
                {r.text.trim() && (
                  <span className="r-text r-detail">{r.text.trim()}</span>
                )}
              </li>
            ))}
        </ul>
      );
    }
    case "contact":
      return (
        <p className="r-text">
          {[
            b.text.trim(),
            [b.email.trim(), b.phone.trim(), b.location.trim()]
              .filter(Boolean)
              .join(" · "),
          ]
            .filter(Boolean)
            .join("\n")}
        </p>
      );
    default:
      return null;
  }
}

/** One list component's own entries, in the template's own markup. */
function ListBody({
  block,
  orgFirst,
  chips,
  narrow,
}: {
  block: ResumeListBlock;
  orgFirst: boolean;
  chips: boolean;
  narrow: boolean;
}) {
  const ivy = orgFirst;

  switch (block.type) {
    case "experience":
      return (
        <div className="r-list">
          {block.items
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

    case "education":
      return (
        <div className="r-list">
          {block.items
            .filter((e) => e.degree.trim() || e.school.trim())
            .map((e) => (
              <Entry
                key={e.id}
                ivy={ivy}
                title={e.degree}
                org={e.school}
                place={e.location}
                when={dateRange(e.start, e.end)}
              >
                {e.detail.trim() && (
                  <p className="r-text r-detail">{e.detail.trim()}</p>
                )}
              </Entry>
            ))}
        </div>
      );

    case "skills": {
      const groups = block.items.filter((g) => g.items.some((i) => i.trim()));
      return narrow || chips ? (
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
    }

    case "certifications":
      return (
        <ul className="r-small-list">
          {block.items
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
                  <span className="r-faint">
                    {[c.issuer.trim(), c.date.trim()]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </li>
            ))}
        </ul>
      );

    case "languages":
      return (
        <ul className="r-small-list r-languages">
          {block.items
            .filter((l) => l.name.trim())
            .map((l) => (
              <li key={l.id}>
                <span className="r-strong">{l.name}</span>
                {l.level.trim() && <span className="r-faint">{l.level}</span>}
              </li>
            ))}
        </ul>
      );

    case "awards":
      return (
        <ul className="r-small-list">
          {block.items
            .filter((a) => a.title.trim())
            .map((a) => (
              <li key={a.id}>
                <span className="r-strong">{a.title}</span>
                {(a.issuer.trim() || a.date.trim()) && (
                  <span className="r-faint">
                    {[a.issuer.trim(), a.date.trim()]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {a.detail.trim() && (
                  <span className="r-text r-detail">{a.detail.trim()}</span>
                )}
              </li>
            ))}
        </ul>
      );
  }
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
  const second = ivy
    ? org.trim()
      ? title.trim()
      : ""
    : title.trim()
      ? org.trim()
      : "";

  return (
    <div className={`r-entry${when ? " has-when" : ""}`}>
      {when && <div className="r-when">{when}</div>}
      <div className="r-what">
        <div className="r-entry-head">
          <h3 className="r-title">{first}</h3>
          {ivy
            ? place.trim() && <span className="r-meta">{place.trim()}</span>
            : when && <span className="r-meta">{when}</span>}
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
