"use client";

import { motion, useTransform } from "motion/react";
import { useCallback } from "react";
import type { Portfolio, Section } from "@/lib/types";
import {
  CountUp,
  Marquee,
  Photo,
  Reveal,
  ThemeRoot,
  Tilt,
  Words,
  jumpTo,
  nn,
  reducedNow,
  toTop,
  useMotionLevel,
  useScrollProgress,
} from "../fx";
import {
  HeaderLinks,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  UiIcon,
  allDates,
  allNumbers,
  chaptersOf,
  headline,
  visibleSections,
} from "../shared";
import { FeatureBand, FooterBody, footerHeadline, footerNote, splitFeatures } from "../components";

/* ── Stage ────────────────────────────────────────────────────────────────
   For people who perform. The portrait is a billboard that fills the first
   screen and recedes as the page scrolls past it, and then every tab is a
   showreel rail: posters in a row that swipes on a phone and steps with
   arrows on a desk, each turning toward the pointer.

   Sets its own rhythm and its own navigation, so the Layout panel's three
   controls say so rather than offering something that does nothing.
   ──────────────────────────────────────────────────────────────────────── */

export function Stage({ p }: { p: Portfolio }) {
  const chapters = chaptersOf(p).map((c, i) => ({ ...c, id: `stage-${p.id}-${i}` }));
  const all = visibleSections(p);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const contactId = `stage-${p.id}-contact`;

  return (
    <ThemeRoot p={p} theme="stage">
      <nav
        className="sticky top-0 z-30 flex items-center gap-6 px-5 py-3.5 md:px-12"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 92%, transparent), color-mix(in srgb, var(--color-bg) 40%, transparent))",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <span
          className="font-heading truncate text-[15px] tracking-[0.18em] uppercase"
          style={{ color: "var(--color-mark)" }}
        >
          {p.header.name}
        </span>
        <div className="fx-rail ml-auto flex min-w-0 gap-5 overflow-x-auto">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              onClick={(e) => jumpTo(e, c.id, 64)}
              className="flex min-h-[40px] flex-none items-center text-[14px] no-underline opacity-75 transition-opacity hover:opacity-100"
              style={{ color: "var(--color-ink)" }}
            >
              {c.tab}
            </a>
          ))}
        </div>
      </nav>

      <Billboard p={p} firstRail={chapters[0]?.id} />

      {p.header.tags.length > 0 && (
        <div
          className="py-6 md:py-8"
          style={{ borderBlock: "1px solid var(--color-divider)" }}
        >
          <Marquee
            items={p.header.tags}
            seconds={Math.max(18, p.header.tags.length * 5)}
            className="stage-marquee"
            itemClassName="font-heading text-[28px] leading-none whitespace-nowrap md:text-[44px]"
          />
        </div>
      )}

      {numbers.length > 0 && (
        <section className="px-5 py-16 md:px-12 md:py-20">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {numbers.slice(0, 8).map((n, i) => (
              <Reveal key={n.id} kind="up" delay={i * 80} className="flex flex-col gap-2">
                <CountUp
                  value={n.value}
                  className="font-heading leading-[0.9]"
                  style={{ ...headline("clamp(44px, 6vw, 84px)"), letterSpacing: "-0.04em", color: "var(--color-mark)" }}
                />
                <span className="text-muted text-[13px] tracking-[0.14em] uppercase">{n.label}</span>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {chapters.map((c) => (
        <Rail key={c.id} p={p} id={c.id} title={c.tab} sections={c.sections} all={all} />
      ))}

      {dates.length > 0 && (
        <section className="px-5 py-16 md:px-12 md:py-24">
          <h2 className="mb-10" style={{ ...headline("clamp(32px, 4.6vw, 60px)"), lineHeight: 1 }}>
            Milestones
          </h2>
          <ol className="m-0 list-none p-0">
            {dates.map((d, i) => (
              <Reveal
                as="li"
                key={d.id}
                kind="left"
                delay={(i % 6) * 60}
                className="grid grid-cols-[minmax(84px,auto)_minmax(0,1fr)] items-baseline gap-6 py-5 md:grid-cols-[200px_minmax(0,1fr)]"
                style={{ borderTop: "1px solid var(--color-divider)" }}
              >
                <span
                  className="font-heading figure stage-outline leading-none"
                  style={{ fontSize: "clamp(34px, 4.4vw, 60px)" }}
                >
                  {d.year}
                </span>
                <span className="text-[17px] leading-[1.55]">{d.text}</span>
              </Reveal>
            ))}
          </ol>
        </section>
      )}

      <footer id={contactId} className="scroll-mt-16 px-5 pt-20 pb-12 md:px-12 md:pt-28">
        <Reveal kind="up">
          <Words
            as="h2"
            text={footerHeadline(p, "Get in touch")}
            className="m-0 mb-10 max-w-[16ch]"
            style={{ ...headline(p.footer.headline ? "clamp(40px, 6.4vw, 104px)" : "clamp(48px, 9vw, 140px)"), lineHeight: 0.92, letterSpacing: "-0.04em" }}
          />
          <FooterBody p={p} />
        </Reveal>
        <div
          className="mt-16 flex flex-wrap items-center justify-between gap-4 pt-6"
          style={{ borderTop: "1px solid var(--color-divider)" }}
        >
          <span className="text-muted text-[13px]">{footerNote(p)}</span>
          <a
            href="#top"
            onClick={toTop}
            className="published-link flex min-h-[44px] items-center gap-2 text-[14px] no-underline"
            style={{ color: "var(--color-mark)" }}
          >
            <UiIcon id="up" size={16} />
            <span className="published-link-text">Back to top</span>
          </a>
        </div>
      </footer>
    </ThemeRoot>
  );
}

function Billboard({ p, firstRail }: { p: Portfolio; firstRail?: string }) {
  const level = useMotionLevel();
  const live = level === "full";
  const [ref, progress] = useScrollProgress(live, 0.5);
  // The billboard holds still until the visitor starts to leave it, then
  // sinks and fades behind the page — the camera pulling back, not the
  // picture sliding.
  const y = useTransform(progress, [0.5, 1], ["0%", "18%"]);
  const fade = useTransform(progress, [0.5, 0.95], [1, 0.25]);

  return (
    <header
      ref={ref}
      className="relative -mt-[68px] flex min-h-[640px] items-end overflow-hidden px-5 pt-32 pb-14 md:h-[92vh] md:max-h-[980px] md:px-12 md:pb-20"
    >
      <motion.div
        aria-hidden
        className="fx-depth absolute inset-0"
        style={{ y: live ? y : 0, opacity: live ? fade : 1 }}
      >
        {p.header.portrait ? (
          <Photo
            asset={p.header.portrait}
            alt=""
            className="stage-ken fx-loop h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(ellipse at 70% 30%, color-mix(in srgb, var(--color-accent) 55%, transparent), transparent 60%), radial-gradient(ellipse at 20% 80%, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 55%)",
            }}
          />
        )}
      </motion.div>
      {/* The vignette that lets white type stand on any photograph. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(0deg, var(--color-bg) 4%, color-mix(in srgb, var(--color-bg) 55%, transparent) 42%, transparent 75%), linear-gradient(90deg, color-mix(in srgb, var(--color-bg) 70%, transparent), transparent 65%)",
        }}
      />

      <div className="relative max-w-[1100px]">
        {p.header.current && (
          <Reveal as="p" className="m-0 mb-5 flex items-center gap-3 text-[13px] tracking-[0.2em] uppercase">
            <span className="h-px w-10" style={{ background: "var(--color-mark)" }} />
            {p.header.current}
          </Reveal>
        )}
        <Words
          text={p.header.name}
          className="m-0"
          style={{ ...headline("clamp(56px, 11vw, 176px)"), lineHeight: 0.86, letterSpacing: "-0.045em" }}
        />
        {p.header.description && (
          <Reveal as="p" delay={260} className="m-0 mt-7 max-w-[48ch] text-[17px] leading-[1.65] md:text-[19px]" style={{ color: "color-mix(in srgb, var(--color-ink) 82%, transparent)" }}>
            {p.header.description}
          </Reveal>
        )}
        <Reveal delay={380} className="mt-9 flex flex-wrap items-center gap-3">
          {firstRail && (
            <a
              href={`#${firstRail}`}
              onClick={(e) => jumpTo(e, firstRail, 64)}
              className="btn btn-primary"
              style={{ marginTop: 0 }}
            >
              See the work
              <UiIcon id="down" size={16} />
            </a>
          )}
          <HeaderLinks p={p} />
        </Reveal>
      </div>
    </header>
  );
}

function Rail({
  p,
  id,
  title,
  sections,
  all,
}: {
  p: Portfolio;
  id: string;
  title: string;
  sections: Section[];
  all: Section[];
}) {
  const trackId = `${id}-track`;
  // Posters for the plain entries; a feature runs as a band under the rail.
  const { cards, features } = splitFeatures(sections);

  // Steps the rail by most of its own width, inside its own document, and
  // never the page: the rail is the only thing that scrolls sideways.
  const step = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, dir: 1 | -1) => {
      const track = e.currentTarget.ownerDocument.getElementById(trackId);
      if (!track) return;
      track.scrollBy({
        left: dir * track.clientWidth * 0.8,
        behavior: reducedNow(track) ? "auto" : "smooth",
      });
    },
    [trackId],
  );

  return (
    <section id={id} className="scroll-mt-16 py-10 md:py-14">
      <div className="mb-6 flex items-end gap-4 px-5 md:px-12">
        <Words as="h2" text={title} className="m-0" style={{ ...headline("clamp(30px, 4vw, 52px)"), lineHeight: 1 }} />
        <span className="text-muted mb-1.5 text-[13px]">{sections.length}</span>
        {cards.length > 1 && (
          <div className="ml-auto hidden gap-2 md:flex">
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label={`Scroll ${title} back`}
              onClick={(e) => step(e, -1)}
              style={{ marginTop: 0 }}
            >
              <UiIcon id="back" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label={`Scroll ${title} forward`}
              onClick={(e) => step(e, 1)}
              style={{ marginTop: 0 }}
            >
              <UiIcon id="chevron" size={16} />
            </button>
          </div>
        )}
      </div>
      {cards.length > 0 && (
      <div
        id={trackId}
        className="fx-rail flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pt-2 pb-6 md:gap-6 md:px-12"
        style={{ scrollPaddingInline: 20 }}
      >
        {cards.map((s, i) => (
          <Reveal
            key={s.id}
            kind="flip"
            delay={Math.min(i, 5) * 80}
            className="w-[76vw] max-w-[340px] flex-none snap-start sm:w-[300px] md:w-[340px]"
          >
            <Poster p={p} section={s} number={all.indexOf(s)} />
          </Reveal>
        ))}
      </div>
      )}
      {features.map((s) => (
        <Reveal key={s.id} kind="up" className="px-5 pt-8 md:px-12 md:pt-12">
          <FeatureBand p={p} section={s} className="fc-card p-6 md:p-12" />
        </Reveal>
      ))}
    </section>
  );
}

function Poster({ p, section, number }: { p: Portfolio; section: Section; number: number }) {
  return (
    <article className="flex flex-col gap-4">
      <Tilt max={9} className="rounded-[18px]">
        <div
          className="stage-poster relative aspect-[3/4] overflow-hidden rounded-[18px]"
          style={{
            background: "var(--color-surface)",
            boxShadow: "0 30px 60px -30px color-mix(in srgb, #000 80%, transparent)",
          }}
        >
          {section.images[0] ? (
            <Photo asset={section.images[0]} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 70%, var(--color-bg)), var(--color-bg) 85%)",
              }}
            >
              <span
                className="font-heading stage-outline absolute top-4 right-5 leading-none"
                style={{ fontSize: 96 }}
              >
                {nn(number)}
              </span>
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(0deg, color-mix(in srgb, #000 75%, transparent), transparent 55%)" }}
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5" style={{ color: "#fff" }}>
            <span className="text-[11px] tracking-[0.18em] uppercase opacity-80">
              {nn(number)} · {section.tab}
            </span>
            <SectionTitleLink
              p={p}
              section={section}
              className="font-heading text-[24px] leading-[1.1] hover:underline"
            />
          </div>
        </div>
      </Tilt>
      {section.description && (
        <p className="whitespace-pre-line text-muted m-0 line-clamp-3 text-[14px] leading-[1.6]">{section.description}</p>
      )}
      <div className="flex flex-col items-start gap-3">
        <SectionAside p={p} section={section} />
        <SectionLinks p={p} section={section} />
      </div>
    </article>
  );
}
