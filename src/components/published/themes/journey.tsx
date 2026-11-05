"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import type { Density, Portfolio, Section } from "@/lib/types";
import {
  CountUp,
  Photo,
  Reveal,
  ThemeRoot,
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
  headline,
} from "../shared";
import { FeatureBand, FooterBody, footerHeadline, footerNote, splitFeatures } from "../components";

/* ── Journey ──────────────────────────────────────────────────────────────
   A warm page told as a story. The tags ring the portrait in a slow 3D
   orbit, and each chapter's entries are cards that pin as you reach them
   and settle back under the next one — the reader sees the pile grow, which
   is the point of a page about growth and impact.

   Reads density for the chapter rhythm. One column by design, and every tab
   is a chapter on the one scroll, so grid and tab navigation say so.
   ──────────────────────────────────────────────────────────────────────── */

const CHAPTER_PAD: Record<Density, string> = {
  airy: "py-28",
  standard: "py-20",
  dense: "py-12",
};

/** How far below the window's top each pinned card sits, per card. */
const STACK_TOP = 96;
const STACK_STEP = 18;

export function Journey({ p }: { p: Portfolio }) {
  const chapters = chaptersOf(p);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const contactId = `journey-${p.id}-contact`;

  return (
    <ThemeRoot p={p} theme="journey">
      <nav className="flex items-center gap-4 px-5 py-4 md:px-10">
        <span className="font-heading truncate text-[17px]">{p.header.name}</span>
        <a
          href={`#${contactId}`}
          onClick={(e) => jumpTo(e, contactId, 24)}
          className="btn btn-secondary ml-auto"
          style={{ marginTop: 0 }}
        >
          Say hello
        </a>
      </nav>

      <Hero p={p} />

      {numbers.length > 0 && (
        <section className="px-5 md:px-10">
          <div className="mx-auto grid max-w-[1080px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {numbers.slice(0, 8).map((n, i) => (
              <Reveal
                key={n.id}
                kind="scale"
                delay={i * 70}
                className="flex flex-col gap-1.5 rounded-[26px] p-6 text-center"
                style={{ background: "color-mix(in srgb, var(--color-accent) 11%, var(--color-bg))" }}
              >
                <CountUp
                  value={n.value}
                  className="font-heading leading-none"
                  style={{ ...headline("clamp(32px, 4vw, 48px)"), color: "var(--color-mark)" }}
                />
                <span className="text-[14px]">{n.label}</span>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {chapters.map((c, ci) => (
        <section key={c.tab} className={`px-5 md:px-10 ${CHAPTER_PAD[p.layout.density]}`}>
          <div className="mx-auto max-w-[1080px]">
            <div className="mb-10 text-center md:mb-14">
              <Reveal
                as="span"
                kind="scale"
                className="inline-block rounded-full px-4 py-1.5 text-[13px]"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))",
                  color: "var(--color-mark)",
                }}
              >
                Chapter {nn(ci)}
              </Reveal>
              <Words
                as="h2"
                text={c.tab}
                className="m-0 mt-4"
                style={{ ...headline("clamp(36px, 5.6vw, 68px)"), lineHeight: 1 }}
              />
            </div>
            {splitFeatures(c.sections).cards.length > 0 && <Stack p={p} sections={splitFeatures(c.sections).cards} />}
            {/* Bands sit after the stack: a timeline or a form has no place
                in a card that pins and shrinks under the next one. */}
            {splitFeatures(c.sections).features.map((s) => (
              <Reveal key={s.id} kind="up" className="mt-6 md:mt-8">
                <FeatureBand
                  p={p}
                  section={s}
                  className="rounded-[30px] p-7 md:p-12"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 18%, transparent)",
                  }}
                />
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      {dates.length > 0 && <Milestones p={p} />}

      <footer id={contactId} className="scroll-mt-6 px-5 pt-10 pb-12 md:px-10">
        <Reveal
          kind="scale"
          className="mx-auto max-w-[1080px] rounded-[36px] px-6 py-14 text-center md:px-14 md:py-20"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))" }}
        >
          <Words
            as="h2"
            text={footerHeadline(p, "Let's connect")}
            accentLast
            className="mx-auto mb-8 max-w-[20ch]"
            style={{ ...headline("clamp(36px, 6vw, 76px)"), lineHeight: 1 }}
          />
          <div className="flex justify-center">
            <FooterBody p={p} center />
          </div>
        </Reveal>
        <p className="text-muted m-0 mt-8 text-center text-[13px]">{footerNote(p)}</p>
        <a
          href="#top"
          onClick={toTop}
          className="published-link mx-auto mt-10 flex min-h-[44px] w-fit items-center gap-2 text-[14px] no-underline"
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
  const tags = p.header.tags.slice(0, 10);
  return (
    <header className="px-5 pt-8 pb-20 text-center md:px-10 md:pt-12 md:pb-28">
      {/* The orbit: tags placed round a tipped ring that turns slowly, with
          the portrait at its centre in the same 3D scene — so the browser
          sorts them by depth, and a tag passes behind the portrait on the
          far side and in front of it on the near one. Each tag counter-turns
          as the ring does (`.journey-face`), so it always faces the reader
          rather than going edge-on at the sides. */}
      <Reveal
        kind="scale"
        className="relative mx-auto h-[300px] w-full max-w-[520px] md:h-[380px]"
        style={{ perspective: 1100 }}
      >
        <div className="absolute inset-0 grid place-items-center" style={{ transformStyle: "preserve-3d" }}>
          <div
            aria-hidden
            className="journey-orbit fx-loop no-print-fx absolute top-1/2 left-1/2 h-0 w-0"
            style={{ transformStyle: "preserve-3d" }}
          >
            {tags.map((t, i) => {
              const angle = (360 / tags.length) * i;
              return (
                <span
                  key={t}
                  className="absolute top-0 left-0"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(var(--journey-r))`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <span
                    className="journey-face fx-loop block rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap"
                    style={{
                      translate: "-50% -50%",
                      transform: `rotateY(${-angle}deg)`,
                      background: "var(--color-bg)",
                      border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
                      boxShadow: "0 10px 24px -14px color-mix(in srgb, #000 50%, transparent)",
                    }}
                  >
                    {t}
                  </span>
                </span>
              );
            })}
          </div>
          <div
          className="relative h-[180px] w-[180px] overflow-hidden rounded-full md:h-[230px] md:w-[230px]"
          style={{
            boxShadow:
              "0 0 0 8px var(--color-bg), 0 0 0 9px color-mix(in srgb, var(--color-accent) 40%, transparent), 0 30px 60px -20px color-mix(in srgb, #000 40%, transparent)",
          }}
        >
          {p.header.portrait ? (
            <Photo asset={p.header.portrait} alt={p.header.name} className="h-full w-full object-cover" />
          ) : (
            <div
              className="font-heading grid h-full w-full place-items-center"
              style={{ ...headline("72px"), background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
            >
              {initials(p.header.name)}
            </div>
          )}
          </div>
        </div>
      </Reveal>
      {/* The orbit's tags are decoration once the ring turns; the list
          here is the readable copy, for assistive tech and for paper. */}
      {tags.length > 0 && (
        <ul className="sr-only print:not-sr-only print:m-0 print:flex print:list-none print:justify-center print:gap-3 print:p-0">
          {tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <div className="mx-auto mt-6 flex max-w-[760px] flex-col items-center">
        {p.header.current && (
          <Reveal
            as="span"
            className="rounded-full px-4 py-1.5 text-[14px]"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))", color: "var(--color-mark)" }}
          >
            {p.header.current}
          </Reveal>
        )}
        <Words
          text={p.header.name}
          accentLast
          className="m-0 mt-5"
          style={{ ...headline("clamp(44px, 7vw, 92px)"), lineHeight: 0.98, letterSpacing: "-0.03em" }}
        />
        {p.header.description && (
          <Reveal as="p" delay={220} className="text-muted m-0 mt-6 max-w-[56ch] text-[18px] leading-[1.7]">
            {p.header.description}
          </Reveal>
        )}
        <Reveal delay={320} className="mt-8 flex justify-center">
          <HeaderLinks p={p} />
        </Reveal>
      </div>
    </header>
  );
}

/**
 * A chapter's entries as a stack: each card pins a little lower than the
 * last, and as the reader moves through the chapter the earlier ones shrink
 * back under the newer ones. One progress value for the whole stack, and
 * each card maps its own slice of it — a card further down settles less,
 * the last one not at all.
 */
function Stack({ p, sections }: { p: Portfolio; sections: Section[] }) {
  const level = useMotionLevel();
  const live = level === "full";
  const [ref, progress] = useScrollProgress(live, 0);
  // Pinning is layout rather than motion, but a still page should not have
  // cards sliding over one another either, so "off" lays them out flat.
  const pinned = level !== "off";

  return (
    <div ref={ref} className="flex flex-col gap-6 md:gap-8">
      {sections.map((s, i) => (
        <StackCard
          key={s.id}
          p={p}
          section={s}
          index={i}
          count={sections.length}
          progress={progress}
          live={live}
          pinned={pinned}
        />
      ))}
    </div>
  );
}

function StackCard({
  p,
  section,
  index,
  count,
  progress,
  live,
  pinned,
}: {
  p: Portfolio;
  section: Section;
  index: number;
  count: number;
  progress: MotionValue<number>;
  live: boolean;
  pinned: boolean;
}) {
  const target = 1 - (count - 1 - index) * 0.045;
  const scale = useTransform(progress, [index / count, 1], [1, target]);
  const tint = 4 + (index % 4) * 3;

  return (
    <div
      className={pinned ? "fx-sticky sticky" : ""}
      style={pinned ? { top: STACK_TOP + index * STACK_STEP } : undefined}
    >
      <motion.article
        className="fx-stack-card grid grid-cols-1 origin-top overflow-hidden rounded-[30px] md:min-h-[400px] md:grid-cols-[1.05fr_1fr]"
        style={{
          scale: live ? scale : 1,
          background: `color-mix(in srgb, var(--color-accent) ${tint}%, var(--color-bg))`,
          border: "1px solid color-mix(in srgb, var(--color-accent) 18%, transparent)",
          boxShadow: "0 -18px 40px -30px color-mix(in srgb, #000 45%, transparent), 0 30px 60px -40px color-mix(in srgb, #000 40%, transparent)",
        }}
      >
        <div className="flex flex-col items-start gap-4 p-7 md:p-10">
          <span className="font-heading figure text-[14px]" style={{ color: "var(--color-mark)" }}>
            {nn(index)} / {String(count).padStart(2, "0")}
          </span>
          <SectionTitleLink
            p={p}
            section={section}
            className="font-heading text-[26px] leading-[1.15] hover:underline md:text-[34px]"
          />
          {section.description && (
            <p className="whitespace-pre-line text-muted m-0 text-[16px] leading-[1.7]">{section.description}</p>
          )}
          <SectionAside p={p} section={section} />
          <SectionLinks p={p} section={section} />
        </div>
        <div className="relative min-h-[220px] p-3 md:p-4">
          {section.images[0] ? (
            <div className="h-full overflow-hidden rounded-[22px]">
              <Photo asset={section.images[0]} className="h-full min-h-[220px] w-full object-cover" />
            </div>
          ) : (
            <div
              aria-hidden
              className="grid h-full min-h-[220px] place-items-center rounded-[22px]"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--color-accent) 40%, var(--color-bg)), color-mix(in srgb, var(--color-accent) 12%, var(--color-bg)) 70%)",
              }}
            >
              <span className="font-heading" style={{ fontSize: 88, lineHeight: 1, color: "var(--color-bg)" }}>
                {nn(index)}
              </span>
            </div>
          )}
        </div>
      </motion.article>
    </div>
  );
}

function Milestones({ p }: { p: Portfolio }) {
  const dates = allDates(p);
  return (
    <section className="px-5 pb-20 md:px-10">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="mb-12 text-center" style={{ ...headline("clamp(32px, 4.6vw, 56px)"), lineHeight: 1 }}>
          Milestones
        </h2>
        <ol className="relative m-0 list-none p-0">
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-[11px] w-[2px] rounded-full md:left-1/2 md:-translate-x-1/2"
            style={{ background: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}
          />
          {dates.map((d, i) => {
            const right = i % 2 === 1;
            return (
              <li key={d.id} className="relative grid grid-cols-1 pb-8 pl-10 md:grid-cols-2 md:pl-0">
                <span
                  aria-hidden
                  className="absolute top-2 left-[4px] h-4 w-4 rounded-full md:left-1/2 md:-translate-x-1/2"
                  style={{ background: "var(--color-accent)", boxShadow: "0 0 0 5px var(--color-bg)" }}
                />
                <Reveal
                  kind={right ? "right" : "left"}
                  className={right ? "md:col-start-2 md:pl-12" : "md:pr-12 md:text-right"}
                >
                  <div className="font-heading figure text-[24px]" style={{ color: "var(--color-mark)" }}>
                    {d.year}
                  </div>
                  <p className="m-0 mt-1 text-[16px] leading-[1.6]">{d.text}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
