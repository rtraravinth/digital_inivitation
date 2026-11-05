"use client";

import { motion, useTransform } from "motion/react";
import type { CSSProperties } from "react";
import type { Density, Portfolio, Section } from "@/lib/types";
import {
  CountUp,
  Photo,
  Reveal,
  ThemeRoot,
  Tilt,
  Words,
  initials,
  jumpTo,
  nn,
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
  gridCols,
  headline,
} from "../shared";
import { FeatureBand, FooterBody, footerHeadline, footerNote, splitFeatures } from "../components";

/* ── Aurora ───────────────────────────────────────────────────────────────
   A dark page lit from behind. Its one piece of depth is glass: the work
   sits on cards that lean toward the pointer, and the portrait carries the
   tags on chips set at three depths, so turning it separates them.

   Reads the Layout panel's grid (cards per row) and density (chapter
   rhythm). Every tab is a chapter on the one scroll, so no section is ever
   behind a filter.
   ──────────────────────────────────────────────────────────────────────── */

const CHAPTER_PAD: Record<Density, string> = {
  airy: "py-28 md:py-36",
  standard: "py-20 md:py-28",
  dense: "py-12 md:py-16",
};

/** Where each orbiting tag chip floats around the portrait, and how deep. */
const ORBIT: Array<{ style: CSSProperties; z: number }> = [
  { style: { top: "6%", left: "-12%" }, z: 90 },
  { style: { top: "34%", right: "-14%" }, z: 60 },
  { style: { bottom: "16%", left: "-16%" }, z: 120 },
  { style: { bottom: "-4%", right: "4%" }, z: 80 },
  { style: { top: "-5%", right: "10%" }, z: 50 },
  { style: { top: "62%", left: "-8%" }, z: 40 },
];

export function Aurora({ p }: { p: Portfolio }) {
  const chapters = chaptersOf(p).map((c, i) => ({ ...c, id: `aurora-${p.id}-${i}` }));
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const contactId = `aurora-${p.id}-contact`;

  return (
    <ThemeRoot p={p} theme="aurora" spotlight>
      {/* The light behind the page: three slow orbs in the accent's family,
          a dot field fading down the hero, and the pointer's own glow. */}
      <div aria-hidden className="fx-ambient pointer-events-none absolute inset-x-0 top-0 h-[1100px]">
        <div
          className="aurora-orb fx-loop"
          style={{
            width: 520,
            height: 520,
            top: -160,
            left: "-8%",
            background: "var(--color-accent)",
          }}
        />
        <div
          className="aurora-orb fx-loop"
          style={{
            width: 460,
            height: 460,
            top: 120,
            right: "-10%",
            background: "color-mix(in srgb, var(--color-accent) 45%, #38bdf8)",
            animationDelay: "-8s",
          }}
        />
        <div
          className="aurora-orb fx-loop"
          style={{
            width: 380,
            height: 380,
            top: 520,
            left: "30%",
            opacity: 0.3,
            background: "color-mix(in srgb, var(--color-accent) 50%, #e879f9)",
            animationDelay: "-14s",
          }}
        />
        <div className="aurora-dots absolute inset-0" />
      </div>
      <div aria-hidden className="fx-spot fx-ambient" />

      <nav
        className="fx-glass sticky top-0 z-30 flex items-center gap-6 px-5 py-3 md:px-10"
        style={{ borderInline: 0, borderTop: 0 }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="font-heading grid h-9 w-9 flex-none place-items-center rounded-full text-[13px]"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            {initials(p.header.name)}
          </span>
          <span className="font-heading truncate text-[16px]">{p.header.name}</span>
        </span>
        <div className="fx-rail ml-auto flex min-w-0 gap-1 overflow-x-auto">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              onClick={(e) => jumpTo(e, c.id)}
              className="flex min-h-[40px] flex-none items-center rounded-full px-3.5 text-[14px] no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)]"
              style={{ color: "var(--color-ink)" }}
            >
              {c.tab}
            </a>
          ))}
          <a
            href={`#${contactId}`}
            onClick={(e) => jumpTo(e, contactId)}
            className="flex min-h-[40px] flex-none items-center rounded-full px-4 text-[14px] font-semibold no-underline"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
          >
            Contact
          </a>
        </div>
      </nav>

      <Hero p={p} />

      {numbers.length > 0 && (
        <section className="relative px-5 md:px-10">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {numbers.slice(0, 8).map((n, i) => (
              <Reveal
                key={n.id}
                kind="scale"
                delay={i * 70}
                className="fx-glass flex flex-col gap-2 rounded-[22px] p-5 md:p-7"
              >
                <CountUp
                  value={n.value}
                  className="font-heading leading-none"
                  style={{ ...headline("clamp(34px, 4.4vw, 54px)"), letterSpacing: "-0.03em" }}
                />
                <span className="text-muted text-[14px]">{n.label}</span>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {chapters.map((c, ci) => (
        <section
          key={c.id}
          id={c.id}
          className={`relative scroll-mt-20 px-5 md:px-10 ${CHAPTER_PAD[p.layout.density]}`}
        >
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-14">
              <div>
                <Reveal kind="left" className="mono-label mb-3 flex items-center gap-3">
                  <span
                    className="h-px w-8"
                    style={{ background: "var(--color-mark)" }}
                  />
                  <span style={{ color: "var(--color-mark)" }}>{nn(ci)}</span>
                  <span>
                    {c.sections.length} {c.sections.length === 1 ? "entry" : "entries"}
                  </span>
                </Reveal>
                <Words
                  as="h2"
                  text={c.tab}
                  className="m-0"
                  style={{ ...headline("clamp(36px, 5.4vw, 72px)"), lineHeight: 0.98 }}
                />
              </div>
            </div>
            <div className={`grid gap-4 md:gap-5 ${gridCols(p)}`}>
              {splitFeatures(c.sections).cards.map((s, i, cards) => {
                // The chapter's first entry runs across two columns when it
                // has a picture to carry it and there is a second entry to
                // sit beside — a lone wide card is just a wide card.
                const wide = i === 0 && !!s.images[0] && p.layout.grid > 1 && cards.length > 1;
                return (
                  <Reveal
                    key={s.id}
                    kind="tilt"
                    delay={Math.min(i, 6) * 80}
                    className={wide ? "sm:col-span-2" : ""}
                  >
                    <Card p={p} section={s} index={i} wide={wide} />
                  </Reveal>
                );
              })}
            </div>
            {splitFeatures(c.sections).features.map((s) => (
              <Reveal key={s.id} kind="up" className="mt-5">
                <FeatureBand p={p} section={s} className="fx-glass rounded-[28px] p-6 md:p-12" />
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      {dates.length > 0 && <Timeline p={p} />}

      <footer id={contactId} className="relative scroll-mt-20 px-5 pt-16 pb-12 md:px-10 md:pt-24">
        <Reveal
          kind="scale"
          className="fx-glass relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] p-8 md:p-14"
        >
          <div
            aria-hidden
            className="aurora-orb fx-loop no-print-fx"
            style={{
              width: 420,
              height: 420,
              right: -120,
              top: -160,
              opacity: 0.45,
              background: "var(--color-accent)",
            }}
          />
          <div className="relative">
            <span className="mono-label">{p.header.name}</span>
            <h2
              className="mt-4 mb-6 max-w-[18ch]"
              style={{ ...headline("clamp(34px, 5vw, 64px)"), lineHeight: 1 }}
            >
              {footerHeadline(p, "Get in touch")}
            </h2>
            <FooterBody p={p} />
          </div>
        </Reveal>
        <div className="mx-auto mt-10 flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
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

function Hero({ p }: { p: Portfolio }) {
  const tags = p.header.tags.slice(0, ORBIT.length);
  return (
    <header className="relative px-5 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28">
      <div className="mx-auto grid grid-cols-1 max-w-[1200px] items-center gap-14 md:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col items-start">
          {p.header.current && (
            <Reveal
              kind="scale"
              className="fx-glass mb-7 inline-flex max-w-full items-center gap-2.5 rounded-full px-4 py-2 text-[13px]"
            >
              <span className="fx-pulse flex-none" />
              <span className="truncate">{p.header.current}</span>
            </Reveal>
          )}
          <Words
            text={p.header.name}
            accentLast
            className="m-0"
            style={{
              ...headline("clamp(48px, 7.4vw, 104px)"),
              lineHeight: 0.94,
              letterSpacing: "-0.04em",
            }}
          />
          {p.header.description && (
            <Reveal delay={260} as="p" className="text-muted m-0 mt-7 max-w-[52ch] text-[18px] leading-[1.65] md:text-[19px]">
              {p.header.description}
            </Reveal>
          )}
          <Reveal delay={380} className="mt-9">
            <HeaderLinks p={p} />
          </Reveal>
          {tags.length > 0 && (
            <ul className="m-0 mt-8 flex list-none flex-wrap gap-2 p-0 md:hidden">
              {tags.map((t) => (
                <li key={t} className="fx-glass rounded-full px-3 py-1.5 text-[13px]">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Reveal kind="scale" delay={200} className="relative mx-auto w-full max-w-[440px]">
          <Tilt max={10} className="rounded-[32px]">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[40px] opacity-60 blur-3xl"
              style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
            />
            <div
              className="fx-glass relative aspect-[4/5] overflow-hidden rounded-[32px]"
              style={{ boxShadow: "0 40px 80px -30px color-mix(in srgb, #000 70%, transparent)" }}
            >
              {p.header.portrait ? (
                <Photo asset={p.header.portrait} alt={p.header.name} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="font-heading grid h-full w-full place-items-center"
                  style={{
                    ...headline("140px"),
                    background:
                      "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--color-accent) 50%, transparent), transparent 60%)",
                  }}
                >
                  {initials(p.header.name)}
                </div>
              )}
            </div>
            {tags.map((t, i) => (
              <span
                key={t}
                className="fx-glass fx-z absolute hidden rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap md:inline-flex"
                style={{
                  ...ORBIT[i].style,
                  "--z": `${ORBIT[i].z}px`,
                  boxShadow: "0 12px 30px -12px color-mix(in srgb, #000 70%, transparent)",
                } as CSSProperties}
              >
                {t}
              </span>
            ))}
          </Tilt>
        </Reveal>
      </div>
    </header>
  );
}

function Card({
  p,
  section,
  index,
  wide,
}: {
  p: Portfolio;
  section: Section;
  index: number;
  wide: boolean;
}) {
  return (
    <Tilt max={wide ? 4 : 6} className="h-full rounded-[24px]">
      <article
        className={`fx-glass aurora-card flex h-full flex-col overflow-hidden rounded-[24px] ${
          wide ? "md:grid md:grid-cols-[1.25fr_1fr]" : ""
        }`}
      >
        <div className={`relative overflow-hidden ${wide ? "aspect-[16/10] md:aspect-auto md:min-h-[320px]" : "aspect-[16/10]"}`}>
          {section.images[0] ? (
            <Photo asset={section.images[0]} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 grid place-items-center"
              style={{
                background:
                  "radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--color-accent) 42%, transparent), transparent 55%), radial-gradient(circle at 90% 90%, color-mix(in srgb, var(--color-accent) 25%, #38bdf8 10%), transparent 50%)",
              }}
            >
              <span
                className="font-heading stage-outline"
                style={{ fontSize: "clamp(64px, 9vw, 120px)", lineHeight: 1 }}
              >
                {nn(index)}
              </span>
            </div>
          )}
        </div>
        <div className="fx-z flex flex-1 flex-col gap-3 p-6 md:p-7" style={{ "--z": "30px" } as CSSProperties}>
          <SectionTitleLink
            p={p}
            section={section}
            className="font-heading text-[22px] leading-[1.15] tracking-[-0.01em] hover:underline md:text-[24px]"
          />
          {section.description && (
            <p className="whitespace-pre-line text-muted m-0 text-[15px] leading-[1.6]">{section.description}</p>
          )}
          <div className="mt-auto flex flex-col items-start gap-3 pt-1">
            <SectionAside p={p} section={section} />
            <SectionLinks p={p} section={section} />
          </div>
        </div>
      </article>
    </Tilt>
  );
}

/** The timeline, with its line drawn down the page as you read it. */
function Timeline({ p }: { p: Portfolio }) {
  const level = useMotionLevel();
  const [ref, progress] = useScrollProgress(level === "full", 1);
  const draw = useTransform(progress, [0.15, 0.75], [0, 1]);
  const dates = allDates(p);

  return (
    <section ref={ref} className="relative px-5 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-[900px]">
        <h2 className="mb-12" style={{ ...headline("clamp(32px, 4.4vw, 56px)"), lineHeight: 1 }}>
          Timeline
        </h2>
        <div className="relative pl-8 md:pl-10">
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[7px] w-px md:left-[11px]"
            style={{ background: "color-mix(in srgb, var(--color-ink) 14%, transparent)" }}
          />
          <motion.div
            aria-hidden
            className="fx-depth absolute top-2 bottom-2 left-[7px] w-px origin-top md:left-[11px]"
            style={{
              background: "linear-gradient(var(--color-mark), var(--color-accent))",
              scaleY: level === "full" ? draw : 1,
            }}
          />
          <ol className="m-0 flex list-none flex-col gap-9 p-0">
            {dates.map((d, i) => (
              <Reveal as="li" key={d.id} kind="left" delay={i * 60} className="relative">
                <span
                  aria-hidden
                  className="absolute top-[9px] -left-8 h-[15px] w-[15px] rounded-full md:-left-10 md:h-[23px] md:w-[23px] md:top-[4px]"
                  style={{
                    background: "var(--color-bg)",
                    border: "2px solid var(--color-mark)",
                    boxShadow: "0 0 16px color-mix(in srgb, var(--color-accent) 60%, transparent)",
                  }}
                />
                <div
                  className="font-heading figure mb-1 text-[26px] leading-none"
                  style={{ color: "var(--color-mark)" }}
                >
                  {d.year}
                </div>
                <p className="m-0 max-w-[60ch] text-[16px] leading-[1.6]">{d.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
