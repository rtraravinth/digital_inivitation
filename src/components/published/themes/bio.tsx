"use client";

import { LinkIcon, iconFor } from "@/lib/icons";
import type { LinkItem, Portfolio, Section } from "@/lib/types";
import { Photo, ThemeRoot, initials } from "../fx";
import { footerNote } from "../components";
import {
  UiIcon,
  chaptersOf,
  headline,
  href,
  usePublishedHandle,
  usePublishedPrivacy,
  useRecordClick,
  visibleSections,
} from "../shared";

/* ── Bio ──────────────────────────────────────────────────────────────────
   The page people already know from a bio link: a photo, a name, a line,
   and a stack of buttons. Everything else on the portfolio — descriptions,
   pictures, components, the numbers and the timeline — stays off it on
   purpose, however much of it the author has filled in. Switching theme
   brings it all back; nothing is lost by choosing this one.

   The links are the header's (as a row of round icons, the way a profile
   lists its accounts) and every visible section's (as the buttons, grouped
   under their tab when there is more than one). The footer's call to action
   and its own links close the stack.
   ──────────────────────────────────────────────────────────────────────── */

type Entry = { link: LinkItem; section: Section };

/** Every visible section's links, grouped by tab in page order. */
function groups(p: Portfolio): Array<{ tab: string; entries: Entry[] }> {
  const visible = new Set(visibleSections(p).map((s) => s.id));
  return chaptersOf(p)
    .map((c) => ({
      tab: c.tab,
      entries: c.sections
        .filter((s) => visible.has(s.id))
        .flatMap((section) => section.links.filter((l) => l.url.trim()).map((link) => ({ link, section }))),
    }))
    .filter((g) => g.entries.length > 0);
}

export function Bio({ p }: { p: Portfolio }) {
  const privacy = usePublishedPrivacy();
  const handle = usePublishedHandle();
  const record = useRecordClick();
  const list = groups(p);
  const f = p.footer;
  const socials = privacy.showContact ? p.header.links.filter((l) => l.url.trim()) : [];
  const footerLinks = privacy.showContact ? (f?.links ?? []).filter((l) => l.url.trim()) : [];
  const hasCta = privacy.showContact && Boolean(f?.ctaUrl?.trim());

  return (
    <ThemeRoot p={p} theme="bio" className="min-h-dvh">
      {/* A wash of the accent behind the photo, fading into the ground. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 75%)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-[580px] flex-col items-center px-5 pt-14 pb-12 md:pt-20">
        <header className="flex flex-col items-center text-center">
          <div
            className="bio-face grid h-28 w-28 place-items-center overflow-hidden rounded-full"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-accent-ink)",
              boxShadow:
                "0 0 0 4px var(--color-bg), 0 0 0 6px color-mix(in srgb, var(--color-accent) 40%, transparent), 0 18px 40px -18px color-mix(in srgb, var(--color-accent) 70%, transparent)",
            }}
          >
            {p.header.portrait ? (
              <Photo asset={p.header.portrait} alt={p.header.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-heading text-[38px]">{initials(p.header.name)}</span>
            )}
          </div>
          <h1 className="m-0 mt-5" style={{ ...headline("clamp(26px, 6vw, 34px)"), lineHeight: 1.1 }}>
            {p.header.name}
          </h1>
          {p.header.current && <p className="m-0 mt-2 max-w-[42ch] text-[15.5px] leading-snug font-medium">{p.header.current}</p>}
          {p.header.description && (
            <p className="text-muted m-0 mt-3 line-clamp-4 max-w-[46ch] text-[14.5px] leading-[1.6]">{p.header.description}</p>
          )}

          {socials.length > 0 && (
            <ul className="m-0 mt-5 flex list-none flex-wrap justify-center gap-2 p-0">
              {socials.map((l) => (
                <li key={l.id}>
                  <a
                    href={href(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={l.label || l.url}
                    title={l.label || l.url}
                    className="bio-social grid h-11 w-11 place-items-center rounded-full"
                  >
                    <LinkIcon id={iconFor(l)} size={19} />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!privacy.showContact && p.header.links.length > 0 && (
            <p className="caption-credit m-0 mt-5">Contact details are hidden.</p>
          )}
        </header>

        <nav aria-label="Links" className="mt-9 flex w-full flex-col gap-7">
          {list.map((g) => (
            <section key={g.tab} aria-label={list.length > 1 ? g.tab : undefined} className="flex flex-col gap-3">
              {list.length > 1 && (
                <h2 className="text-muted m-0 text-center text-[12px] font-semibold tracking-[0.14em] uppercase">{g.tab}</h2>
              )}
              {g.entries.map(({ link, section }) => (
                <BioButton
                  key={`${section.id}-${link.id}`}
                  link={link}
                  // The section's title says which "Website" this is when
                  // several sections each carry one.
                  sub={link.label && link.label !== section.title ? section.title : ""}
                  onClick={() => record(handle, p.slug, section.id)}
                />
              ))}
            </section>
          ))}

          {list.length === 0 && socials.length === 0 && !hasCta && footerLinks.length === 0 && (
            <p className="text-muted m-0 text-center text-[14px]">No links yet.</p>
          )}
        </nav>

        {(f?.headline || f?.text || hasCta || footerLinks.length > 0) && (
          <footer className="mt-10 flex w-full flex-col items-center gap-3 text-center">
            {f?.headline && (
              <h2 className="m-0 max-w-[30ch]" style={{ ...headline("clamp(20px, 4.4vw, 24px)"), lineHeight: 1.2 }}>
                {f.headline}
              </h2>
            )}
            {f?.text && <p className="text-muted m-0 max-w-[44ch] text-[14.5px] leading-[1.6]">{f.text}</p>}
            {(hasCta || footerLinks.length > 0) && (
              <div className="mt-2 flex w-full flex-col gap-3">
                {hasCta && (
                  <BioButton link={{ id: "cta", label: f.ctaLabel || "Get in touch", url: f.ctaUrl }} sub="" primary />
                )}
                {footerLinks.map((l) => (
                  <BioButton key={l.id} link={l} sub="" />
                ))}
              </div>
            )}
          </footer>
        )}

        <p className="text-muted m-0 mt-12 text-[12.5px]">{footerNote(p)}</p>
      </main>
    </ThemeRoot>
  );
}

function BioButton({
  link,
  sub,
  primary,
  onClick,
}: {
  link: LinkItem;
  sub: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href(link.url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`bio-link group grid min-h-[60px] w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-full px-3 py-2 no-underline ${
        primary ? "bio-link-primary" : ""
      }`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bio-link-icon">
        <LinkIcon id={iconFor(link)} size={18} />
      </span>
      <span className="flex min-w-0 flex-col items-center text-center leading-tight">
        <span className="max-w-full truncate text-[15.5px] font-semibold">{link.label || link.url}</span>
        {sub && <span className="max-w-full truncate text-[12.5px] opacity-70">{sub}</span>}
      </span>
      <span aria-hidden className="bio-link-arrow grid h-10 w-10 place-items-center">
        <UiIcon id="out" size={15} />
      </span>
    </a>
  );
}
