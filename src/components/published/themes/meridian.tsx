"use client";

import { AnimatePresence, motion, useTransform } from "motion/react";
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
  LensGate,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  UiIcon,
  allDates,
  allNumbers,
  gridCols,
  headline,
  pad,
  tabs,
  useTabFilter,
} from "../shared";
import { FeatureBand, FooterBody, footerHeadline, footerNote, splitFeatures } from "../components";

/* ── Meridian ─────────────────────────────────────────────────────────────
   For the people a visitor has to trust before anything else: a doctor, an
   advocate, an adviser. Quiet and light, and its depth is in one place —
   the portrait stands on two plates that separate as the page scrolls and
   as the pointer turns them, so the hero has weight without a single loud
   effect.

   Reads all three Layout controls: tab navigation in all four shapes, the
   grid, and density. A tab change turns the entries in on a shared hinge
   rather than swapping the page.
   ──────────────────────────────────────────────────────────────────────── */

const WORK_PAD: Record<Density, string> = {
  airy: "py-24 md:py-32",
  standard: "py-16 md:py-24",
  dense: "py-10 md:py-14",
};

export function Meridian({ p }: { p: Portfolio }) {
  const { tab, setTab, shown, nav, chapters, gated } = useTabFilter(p);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const contactId = `meridian-${p.id}-contact`;
  const workId = `meridian-${p.id}-work`;
  const pageTabs = tabs(p);

  return (
    <ThemeRoot p={p} theme="meridian">
      <nav
        className="sticky top-0 z-30 flex items-center gap-4 px-5 py-3 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <span
          className="font-heading grid h-10 w-10 flex-none place-items-center rounded-full text-[14px]"
          style={{ border: "1px solid var(--color-mark)", color: "var(--color-mark)" }}
        >
          {initials(p.header.name)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading truncate text-[16px]">{p.header.name}</span>
          {p.header.current && (
            <span className="text-muted hidden truncate text-[12px] sm:block">{p.header.current}</span>
          )}
        </span>
        <a
          href={`#${contactId}`}
          onClick={(e) => jumpTo(e, contactId)}
          className="btn btn-primary ml-auto"
        >
          Contact
        </a>
      </nav>

      {gated ? (
        <LensGate p={p} setTab={setTab} padClass={pad(p).page} />
      ) : (
        <>
          <Hero p={p} />

          {numbers.length > 0 && (
            <section className="px-5 md:px-10">
              {/* `.resume-stats` owns the per-cell rules at both breakpoints,
                  dropping the rule on whichever cell opens a row. */}
              <div
                className="resume-stats mx-auto max-w-[1160px]"
                data-cols={Math.min(4, numbers.length)}
                style={{ borderBlock: "1px solid var(--color-divider)" }}
              >
                {numbers.slice(0, 8).map((n, i) => (
                  <Reveal
                    key={n.id}
                    delay={i * 70}
                    className="flex flex-col gap-1.5 py-8 pr-4"
                  >
                    <CountUp
                      value={n.value}
                      className="font-heading leading-none"
                      style={{ ...headline("clamp(32px, 4vw, 48px)"), color: "var(--color-mark)" }}
                    />
                    <span className="text-muted text-[14px]">{n.label}</span>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {/* The page's side margin is the hero's, so the work lines up under
              it; density only sets the vertical rhythm. `pad().page` carries
              its own horizontal padding and would indent this past the hero. */}
          <section
            id={workId}
            className={`mx-auto max-w-[1160px] scroll-mt-24 px-5 md:box-content md:px-10 ${WORK_PAD[p.layout.density]}`}
          >
            {nav === "scroll" ? (
              <div className="flex flex-col gap-20">
                {chapters.map((c, ci) => (
                  <div key={c.tab}>
                    <ChapterHead index={ci} title={c.tab} count={c.sections.length} />
                    <div className={`grid gap-5 ${gridCols(p)}`}>
                      {splitFeatures(c.sections).cards.map((s, i) => (
                        <Reveal key={s.id} kind="flip" delay={Math.min(i, 6) * 70}>
                          <Entry p={p} section={s} />
                        </Reveal>
                      ))}
                    </div>
                    <Bands p={p} sections={splitFeatures(c.sections).features} afterCards={splitFeatures(c.sections).cards.length > 0} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={nav === "rail" ? "grid grid-cols-1 gap-10 md:grid-cols-[220px_minmax(0,1fr)]" : ""}>
                <TabBar
                  p={p}
                  tabs={pageTabs}
                  tab={tab}
                  setTab={setTab}
                  vertical={nav === "rail"}
                />
                <div className="min-w-0">
                  <div className={`grid gap-5 ${gridCols(p)}`} style={{ perspective: 1400 }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {splitFeatures(shown).cards.map((s, i) => (
                        <Turn key={s.id} index={i}>
                          <Entry p={p} section={s} />
                        </Turn>
                      ))}
                    </AnimatePresence>
                  </div>
                  <Bands p={p} sections={splitFeatures(shown).features} afterCards={splitFeatures(shown).cards.length > 0} key={tab} />
                </div>
              </div>
            )}
          </section>

          {dates.length > 0 && (
            <section className="px-5 pb-20 md:px-10 md:pb-28">
              <div className="mx-auto max-w-[1160px]">
                <ChapterHead index={-1} title="Timeline" />
                <ol className="m-0 grid grid-cols-1 list-none gap-0 p-0 md:grid-cols-2 md:gap-x-16">
                  {dates.map((d, i) => (
                    <Reveal
                      as="li"
                      key={d.id}
                      kind="up"
                      delay={(i % 6) * 60}
                      className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-5"
                      style={{ borderTop: "1px solid var(--color-divider)" }}
                    >
                      <span className="font-heading figure text-[20px]" style={{ color: "var(--color-mark)" }}>
                        {d.year}
                      </span>
                      <span className="text-[16px] leading-[1.55]">{d.text}</span>
                    </Reveal>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </>
      )}

      <footer
        id={contactId}
        className="scroll-mt-24 px-5 py-16 md:px-10 md:py-20"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-divider)" }}
      >
        <div className="mx-auto grid grid-cols-1 max-w-[1160px] items-end gap-8 md:grid-cols-[1fr_auto]">
          <Reveal>
            <span className="mono-label" style={{ color: "var(--color-mark)" }}>
              Contact
            </span>
            <h2 className="mt-3 mb-0 max-w-[22ch]" style={{ ...headline("clamp(30px, 4vw, 48px)"), lineHeight: 1.05 }}>
              {footerHeadline(p, p.header.name)}
            </h2>
            {!p.footer.headline && p.header.current && <p className="text-muted mt-2 mb-0 text-[16px]">{p.header.current}</p>}
            <div className="mt-6">
              <FooterBody p={p} />
            </div>
            <p className="text-muted m-0 mt-10 text-[13px]">{footerNote(p)}</p>
          </Reveal>
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
  const level = useMotionLevel();
  const [ref, progress] = useScrollProgress(level === "full");
  // The two plates drift apart from the photograph as the hero scrolls
  // away — the back one furthest — which is the separation a stack of
  // mounted sheets shows when you move past it.
  const back = useTransform(progress, [0.3, 1], [0, -70]);
  const mid = useTransform(progress, [0.3, 1], [0, -34]);
  const live = level === "full";

  return (
    <header ref={ref} className="px-5 pt-14 pb-16 md:px-10 md:pt-20 md:pb-24">
      <div className="mx-auto grid grid-cols-1 max-w-[1160px] items-center gap-14 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-start">
          {p.header.current && (
            <Reveal as="span" className="mono-label mb-5" style={{ color: "var(--color-mark)" }}>
              {p.header.current}
            </Reveal>
          )}
          <Words
            text={p.header.name}
            className="m-0"
            style={{ ...headline("clamp(44px, 6.2vw, 82px)"), lineHeight: 1, letterSpacing: "-0.025em" }}
          />
          {p.header.description && (
            <Reveal as="p" delay={220} className="text-muted m-0 mt-6 max-w-[54ch] text-[18px] leading-[1.7]">
              {p.header.description}
            </Reveal>
          )}
          {p.header.tags.length > 0 && (
            <Reveal delay={300} as="ul" className="m-0 mt-7 flex list-none flex-wrap gap-2 p-0">
              {p.header.tags.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px]"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 9%, var(--color-bg))",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                  }}
                >
                  <span style={{ color: "var(--color-mark)" }}>
                    <UiIcon id="check" size={13} />
                  </span>
                  {t}
                </li>
              ))}
            </Reveal>
          )}
          <Reveal delay={380} className="mt-9">
            <HeaderLinks p={p} />
          </Reveal>
        </div>

        <Reveal kind="scale" delay={160} className="relative mx-auto w-full max-w-[400px] py-6">
          <Tilt max={6} glare={false} className="rounded-[200px_200px_28px_28px]">
            {/* Motion owns these two transforms, so their depth is Motion's
                `z` rather than the `.fx-z` class — an inline transform would
                overwrite the class's translateZ. */}
            <motion.div
              aria-hidden
              className="fx-depth absolute inset-0 rounded-[200px_200px_28px_28px]"
              style={{
                z: -60,
                y: live ? back : 0,
                x: -18,
                rotate: -5,
                background: "var(--color-accent)",
              }}
            />
            <motion.div
              aria-hidden
              className="fx-depth absolute inset-0 rounded-[200px_200px_28px_28px]"
              style={{
                z: -30,
                y: live ? mid : 0,
                x: 14,
                rotate: 3,
                // A step toward the ink rather than `--color-surface`, which is
                // darker than a dark ground and vanished into it.
                background: "color-mix(in srgb, var(--color-ink) 12%, var(--color-bg))",
                border: "1px solid var(--color-divider)",
              }}
            />
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-[200px_200px_28px_28px]"
              style={{ boxShadow: "0 30px 60px -28px color-mix(in srgb, #000 55%, transparent)" }}
            >
              {p.header.portrait ? (
                <Photo asset={p.header.portrait} alt={p.header.name} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="font-heading grid h-full w-full place-items-center"
                  style={{ ...headline("120px"), background: "var(--color-surface)", color: "var(--color-mark)" }}
                >
                  {initials(p.header.name)}
                </div>
              )}
            </div>
          </Tilt>
        </Reveal>
      </div>
    </header>
  );
}

function ChapterHead({ index, title, count }: { index: number; title: string; count?: number }) {
  return (
    <div className="mb-8 flex items-baseline gap-4">
      {index >= 0 && (
        <span className="font-heading figure text-[15px]" style={{ color: "var(--color-mark)" }}>
          {nn(index)}
        </span>
      )}
      <Words as="h2" text={title} className="m-0" style={{ ...headline("clamp(28px, 3.6vw, 44px)"), lineHeight: 1.05 }} />
      {count !== undefined && <span className="text-muted ml-auto text-[13px]">{count}</span>}
    </div>
  );
}

/**
 * The tab row: a pill that slides between tabs on a shared `layoutId`, or
 * a numbered rail when the author picked one. Every tab clears 44px.
 */
function TabBar({
  p,
  tabs: list,
  tab,
  setTab,
  vertical,
}: {
  p: Portfolio;
  tabs: string[];
  tab: string;
  setTab: (t: string) => void;
  vertical: boolean;
}) {
  if (list.length <= 1 && !vertical) return null;
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={
        vertical
          ? "fx-rail mb-8 flex gap-1 overflow-x-auto md:sticky md:top-24 md:mb-0 md:flex-col md:self-start md:overflow-visible"
          : "fx-rail mb-10 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1"
      }
      style={vertical ? undefined : { background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
    >
      {list.map((t, i) => {
        const on = t === tab;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(t)}
            className={`relative flex min-h-[44px] flex-none cursor-pointer items-center gap-2.5 rounded-full px-5 text-[15px] whitespace-nowrap ${
              vertical ? "md:justify-start md:rounded-[14px]" : ""
            }`}
            style={{ color: on ? "var(--color-accent-ink)" : "var(--color-ink)" }}
          >
            {on && (
              <motion.span
                layoutId={`meridian-pill-${p.id}`}
                aria-hidden
                className={`absolute inset-0 ${vertical ? "rounded-full md:rounded-[14px]" : "rounded-full"}`}
                style={{ background: "var(--color-accent)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative figure text-[12px] opacity-70">{nn(i)}</span>
            <span className="relative">{t}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One entry turning in on its left hinge, and out the other way. */
function Turn({ index, children }: { index: number; children: React.ReactNode }) {
  const level = useMotionLevel();
  const still = level === "off";
  const full = level === "full";
  return (
    <motion.div
      layout={!still}
      initial={still ? false : full ? { opacity: 0, rotateY: -24, x: 40 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, rotateY: 0, x: 0, y: 0 }}
      exit={still ? undefined : full ? { opacity: 0, rotateY: 18, x: -30 } : { opacity: 0 }}
      transition={{
        duration: full ? 0.55 : 0.3,
        ease: [0.16, 1, 0.3, 1],
        delay: full ? Math.min(index, 6) * 0.05 : 0,
      }}
      style={{ transformOrigin: "0% 50%" }}
    >
      {children}
    </motion.div>
  );
}

function Entry({ p, section }: { p: Portfolio; section: Section }) {
  return (
    <article
      className={`flex h-full flex-col gap-5 rounded-[22px] p-5 md:p-6 ${
        section.images[0] ? "sm:grid sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start" : ""
      }`}
      style={{
        background: "color-mix(in srgb, var(--color-ink) 3%, var(--color-bg))",
        border: "1px solid var(--color-divider)",
        boxShadow: "0 1px 2px color-mix(in srgb, #000 6%, transparent)",
      }}
    >
      {section.images[0] && (
        <div className="aspect-[4/3] overflow-hidden rounded-[14px] sm:aspect-square">
          <Photo asset={section.images[0]} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-col items-start gap-3">
        <span className="mono-label" style={{ color: "var(--color-mark)" }}>
          {section.tab}
        </span>
        <SectionTitleLink
          p={p}
          section={section}
          className="font-heading text-[22px] leading-[1.2] hover:underline md:text-[25px]"
        />
        {section.description && (
          <p className="whitespace-pre-line text-muted m-0 text-[15px] leading-[1.65]">{section.description}</p>
        )}
        <SectionAside p={p} section={section} />
        <SectionLinks p={p} section={section} />
      </div>
    </article>
  );
}

/** Feature sections, each a band of its own under the cards. */
function Bands({ p, sections, afterCards }: { p: Portfolio; sections: Section[]; afterCards: boolean }) {
  if (sections.length === 0) return null;
  return (
    // Ruled off from the cards above; the first band of a tab with no cards
    // starts straight under the tab row, with no rule and no gap of its own.
    <div className={`flex flex-col gap-20 md:gap-28 ${afterCards ? "mt-16 md:mt-20" : ""}`}>
      {sections.map((s, i) => {
        const ruled = afterCards || i > 0;
        return (
          <Reveal key={s.id} kind="up">
            <FeatureBand
              p={p}
              section={s}
              className={ruled ? "pt-12 md:pt-16" : ""}
              style={ruled ? { borderTop: "1px solid var(--color-divider)" } : undefined}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
