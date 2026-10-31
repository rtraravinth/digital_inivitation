"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import type { Portfolio, Section } from "@/lib/types";
import {
  CountUp,
  Photo,
  Reveal,
  ThemeRoot,
  Tilt,
  initials,
  jumpTo,
  nn,
  toTop,
  useMotionLevel,
} from "../fx";
import {
  HeaderLinks,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  UiIcon,
  allDates,
  allNumbers,
  gridCols,
  headline,
  tabs,
  useTabFilter,
} from "../shared";

/* ── Arcade ───────────────────────────────────────────────────────────────
   For players and the people who build games. A synthwave horizon with a
   perspective grid running toward it, a name that glitches every few
   seconds, and the tabs as a level-select menu: picking a level flips its
   cards in on their vertical axis.

   Reads the Layout panel's grid. Its level select is its navigation and it
   sets its own spacing, so the other two controls say so.
   ──────────────────────────────────────────────────────────────────────── */

const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)";

export function Arcade({ p }: { p: Portfolio }) {
  const { tab, setTab, shown } = useTabFilter(p);
  const levels = tabs(p);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const contactId = `arcade-${p.id}-contact`;
  const levelsId = `arcade-${p.id}-levels`;

  return (
    <ThemeRoot
      p={p}
      theme="arcade"
      style={{ "--arcade-grid": "color-mix(in srgb, var(--color-accent) 55%, transparent)" } as CSSProperties}
    >
      {/* The page-wide scanlines, over everything and under nothing a
          visitor touches. */}
      <div aria-hidden className="arcade-scanlines fx-ambient pointer-events-none absolute inset-0 z-40" />

      <nav
        className="sticky top-0 z-30 flex items-center gap-4 px-5 py-3 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <span
          className="font-heading arcade-cut grid h-9 w-9 flex-none place-items-center text-[13px]"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
        >
          {initials(p.header.name)}
        </span>
        <span className="font-heading truncate text-[15px] tracking-[0.12em] uppercase">{p.header.name}</span>
        <a
          href={`#${levelsId}`}
          onClick={(e) => jumpTo(e, levelsId)}
          className="font-heading ml-auto hidden min-h-[40px] items-center px-3 text-[13px] tracking-[0.14em] uppercase no-underline sm:flex"
          style={{ color: "var(--color-ink)" }}
        >
          Levels
        </a>
        <a
          href={`#${contactId}`}
          onClick={(e) => jumpTo(e, contactId)}
          className="font-heading arcade-cut flex min-h-[40px] items-center px-4 text-[13px] tracking-[0.14em] uppercase no-underline max-sm:ml-auto"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
        >
          Contact
        </a>
      </nav>

      <Hero p={p} />

      {numbers.length > 0 && (
        <section className="relative z-10 px-5 py-14 md:px-10">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {numbers.slice(0, 8).map((n, i) => (
              <Reveal
                key={n.id}
                kind="scale"
                delay={i * 70}
                className="arcade-cut flex flex-col gap-2 p-5 md:p-6"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, var(--color-bg))",
                  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent)",
                }}
              >
                <span className="text-muted font-heading text-[11px] tracking-[0.2em] uppercase">
                  {n.label}
                </span>
                <CountUp
                  value={n.value}
                  className="font-heading leading-none"
                  style={{
                    ...headline("clamp(32px, 4.4vw, 52px)"),
                    color: "var(--color-mark)",
                    textShadow: "0 0 18px color-mix(in srgb, var(--color-accent) 60%, transparent)",
                  }}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {levels.length > 0 && (
        <section id={levelsId} className="relative z-10 scroll-mt-20 px-5 py-14 md:px-10 md:py-20">
          <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-8 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10">
            <div className="md:sticky md:top-24 md:self-start">
              <h2 className="font-heading mb-5 text-[13px] tracking-[0.24em] uppercase" style={{ color: "var(--color-mark)" }}>
                Select level
              </h2>
              <div className="fx-rail flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
                {levels.map((t, i) => {
                  const on = t === tab;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTab(t)}
                      className="arcade-level arcade-cut flex min-h-[52px] flex-none cursor-pointer items-center gap-3 px-4 text-left"
                      style={{
                        background: on
                          ? "color-mix(in srgb, var(--color-accent) 22%, var(--color-bg))"
                          : "color-mix(in srgb, var(--color-ink) 5%, var(--color-bg))",
                        transition: "background-color 200ms var(--ease-out)",
                      }}
                    >
                      <span
                        className="font-heading text-[11px] tracking-[0.16em] uppercase"
                        style={{ color: on ? "var(--color-mark)" : "var(--color-neutral-700)" }}
                      >
                        Lv {nn(i)}
                      </span>
                      <span className="font-heading text-[16px] whitespace-nowrap">{t}</span>
                      {on && (
                        <span className="ml-auto" style={{ color: "var(--color-mark)" }}>
                          <UiIcon id="chevron" size={16} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`grid gap-5 ${gridCols(p)}`} style={{ perspective: 1600 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {shown.map((s, i) => (
                  <Flip key={s.id} index={i}>
                    <Card p={p} section={s} />
                  </Flip>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {dates.length > 0 && (
        <section className="relative z-10 px-5 py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="font-heading mb-8 text-[13px] tracking-[0.24em] uppercase" style={{ color: "var(--color-mark)" }}>
              Achievements
            </h2>
            <ol className="m-0 grid grid-cols-1 list-none gap-3 p-0 md:grid-cols-2">
              {dates.map((d, i) => (
                <Reveal
                  as="li"
                  key={d.id}
                  kind="left"
                  delay={(i % 6) * 60}
                  className="arcade-cut flex items-center gap-4 p-4"
                  style={{ background: "color-mix(in srgb, var(--color-ink) 5%, var(--color-bg))" }}
                >
                  <span
                    aria-hidden
                    className="h-4 w-4 flex-none rotate-45"
                    style={{
                      background: "var(--color-accent)",
                      boxShadow: "0 0 14px var(--color-accent)",
                    }}
                  />
                  <span className="font-heading figure flex-none text-[18px]" style={{ color: "var(--color-mark)" }}>
                    {d.year}
                  </span>
                  <span className="text-[15px] leading-[1.5]">{d.text}</span>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>
      )}

      <footer id={contactId} className="relative z-10 scroll-mt-20 px-5 pt-16 pb-12 text-center md:px-10 md:pt-24">
        <p
          className="font-heading arcade-blink fx-loop m-0 mb-6 text-[14px] tracking-[0.3em] uppercase"
          style={{ color: "var(--color-mark)" }}
        >
          Press start
        </p>
        <h2 className="mb-8" style={{ ...headline("clamp(36px, 6vw, 80px)"), lineHeight: 1 }}>
          Get in touch
        </h2>
        <div className="flex justify-center">
          <HeaderLinks p={p} />
        </div>
        <a
          href="#top"
          onClick={toTop}
          className="published-link mx-auto mt-12 flex min-h-[44px] w-fit items-center gap-2 text-[14px] no-underline"
          style={{ color: "var(--color-mark)" }}
        >
          <UiIcon id="up" size={16} />
          <span className="published-link-text">Back to top</span>
        </a>
      </footer>
    </ThemeRoot>
  );
}

function Hero({ p }: { p: Portfolio }) {
  return (
    <header className="relative overflow-hidden px-5 pt-14 pb-40 md:px-10 md:pt-20 md:pb-56">
      {/* The horizon: sky, a striped sun, and the grid floor running at it. */}
      <div aria-hidden className="fx-ambient pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-accent) 22%, var(--color-bg)) 62%, var(--color-bg) 63%)",
          }}
        />
        <div
          // Behind the portrait, not the name: type set over a striped sun
          // could not be read. On a phone the portrait stacks under the text,
          // so the sun drops with it.
          className="absolute bottom-[22%] left-1/2 h-[260px] w-[260px] -translate-x-1/2 rounded-full md:bottom-[35%] md:left-[74%] md:h-[420px] md:w-[420px]"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 40%, #fde047), var(--color-accent))",
            // Solid above the middle, banded below it — the synthwave sun.
            maskImage:
              "linear-gradient(180deg, #000 52%, transparent 52%), repeating-linear-gradient(180deg, #000 0 12px, transparent 12px 18px)",
            WebkitMaskImage:
              "linear-gradient(180deg, #000 52%, transparent 52%), repeating-linear-gradient(180deg, #000 0 12px, transparent 12px 18px)",
            opacity: 0.85,
            filter: "drop-shadow(0 0 40px var(--color-accent))",
          }}
        />
        <div className="absolute inset-x-[-30%] bottom-0 h-[38%]" style={{ perspective: 320, perspectiveOrigin: "50% 0%" }}>
          <div
            className="arcade-floor fx-loop absolute inset-0 origin-top"
            style={{
              transform: "rotateX(62deg)",
              maskImage: "linear-gradient(180deg, transparent, #000 30%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%)",
            }}
          />
        </div>
      </div>

      <div className="relative mx-auto grid grid-cols-1 max-w-[1200px] items-center gap-12 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col items-start">
          <Reveal
            as="span"
            className="font-heading mb-5 text-[12px] tracking-[0.32em] uppercase"
            style={{ color: "var(--color-mark)" }}
          >
            Player one
          </Reveal>
          <Reveal kind="scale" delay={80}>
            <h1
              className="arcade-glitch m-0 uppercase"
              data-text={p.header.name}
              style={{ ...headline("clamp(46px, 8.4vw, 120px)"), lineHeight: 0.9, letterSpacing: "0.01em" }}
            >
              {p.header.name}
            </h1>
          </Reveal>
          {p.header.current && (
            <Reveal as="p" delay={180} className="font-heading m-0 mt-5 text-[15px] tracking-[0.12em] uppercase">
              <span style={{ color: "var(--color-mark)" }}>Class</span> · {p.header.current}
            </Reveal>
          )}
          {p.header.description && (
            <Reveal as="p" delay={260} className="text-muted m-0 mt-5 max-w-[52ch] text-[17px] leading-[1.65]">
              {p.header.description}
            </Reveal>
          )}
          {p.header.tags.length > 0 && (
            <Reveal delay={320} as="ul" className="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">
              {p.header.tags.map((t) => (
                <li
                  key={t}
                  className="arcade-cut font-heading px-3 py-1.5 text-[12px] tracking-[0.1em] uppercase"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 16%, var(--color-bg))",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 50%, transparent)",
                  }}
                >
                  {t}
                </li>
              ))}
            </Reveal>
          )}
          <Reveal delay={400} className="mt-8">
            <HeaderLinks p={p} />
          </Reveal>
        </div>

        <Reveal kind="scale" delay={160} className="mx-auto w-full max-w-[340px]">
          <Tilt max={12} glare={false}>
            <div
              className="aspect-square p-[3px]"
              style={{
                clipPath: HEX,
                background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, #22d3ee))",
                filter: "drop-shadow(0 0 28px color-mix(in srgb, var(--color-accent) 70%, transparent))",
              }}
            >
              <div className="h-full w-full overflow-hidden" style={{ clipPath: HEX, background: "var(--color-bg)" }}>
                {p.header.portrait ? (
                  <Photo asset={p.header.portrait} alt={p.header.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="font-heading grid h-full w-full place-items-center" style={{ ...headline("110px"), color: "var(--color-mark)" }}>
                    {initials(p.header.name)}
                  </div>
                )}
              </div>
            </div>
          </Tilt>
        </Reveal>
      </div>
    </header>
  );
}

/** A card flipping in on its vertical axis as its level is picked. */
function Flip({ index, children }: { index: number; children: React.ReactNode }) {
  const level = useMotionLevel();
  const still = level === "off";
  const full = level === "full";
  return (
    <motion.div
      layout={!still}
      initial={still ? false : full ? { opacity: 0, rotateY: 80 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, rotateY: 0, y: 0 }}
      exit={still ? undefined : full ? { opacity: 0, rotateY: -80 } : { opacity: 0 }}
      transition={{
        duration: full ? 0.5 : 0.28,
        ease: [0.16, 1, 0.3, 1],
        delay: full ? Math.min(index, 6) * 0.06 : 0,
      }}
    >
      {children}
    </motion.div>
  );
}

function Card({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <Tilt max={7} className="h-full">
      <div
        className="arcade-cut h-full p-px"
        style={{ background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 20%, transparent) 60%)" }}
      >
        <article
          className="arcade-cut flex h-full flex-col overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--color-ink) 4%, var(--color-bg))" }}
        >
          {section.image && (
            <div className="relative aspect-[16/9] overflow-hidden">
              <Photo asset={section.image} className="h-full w-full object-cover" />
              <div aria-hidden className="arcade-scanlines absolute inset-0" />
            </div>
          )}
          <div className="flex flex-1 flex-col items-start gap-3 p-5 md:p-6">
            <SectionTitleLink
              p={p}
              section={section}
              className="font-heading text-[21px] leading-[1.15] tracking-[0.01em] uppercase hover:underline"
            />
            {section.description && (
              <p className="text-muted m-0 text-[15px] leading-[1.6]">{section.description}</p>
            )}
            <SectionAside p={p} section={section} />
            <SectionLinks p={p} section={section} />
          </div>
        </article>
      </div>
    </Tilt>
  );
}
