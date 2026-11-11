"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { coverOf, type Portfolio, type Section } from "@/lib/types";
import { ComponentView, shownBlocks } from "./components";
import {
  Media,
  SectionAside,
  SectionLinks,
  UiIcon,
  captionCredit,
  groundStyle,
  headline,
  usePageHref,
  visibleSections,
} from "./shared";

/* ── 1d Section detail — the caption lift ─────────────────────────────────
   One plate, read closely. The caption card lifts off the plate it belongs
   to rather than replacing it, and the rest of the collection stays listed
   underneath: a visitor who came in on one plate can always see what else
   is in the room without going back first.
   ────────────────────────────────────────────────────────────────────── */

export function SectionDetail({ p, section }: { p: Portfolio; section: Section }) {
  const pageHref = usePageHref(p);
  const all = visibleSections(p);
  const index = all.findIndex((s) => s.id === section.id);
  const total = all.length;
  const no = index >= 0 ? String(index + 1).padStart(2, "0") : "—";
  const [medium, credit] = captionCredit(section);
  const reduced = useReducedMotion();

  const prev = index > 0 ? all[index - 1] : undefined;
  const next = index >= 0 && index < total - 1 ? all[index + 1] : undefined;

  return (
    <div className="fx-root" style={groundStyle(p)}>
      {/* The running head, as on every other spread. */}
      <div
        className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-3.5 md:px-8"
        style={{ borderBottom: "1px solid var(--color-divider)" }}
      >
        <Link href={pageHref} className="btn btn-ghost">
          <UiIcon id="back" size={15} />
          {p.header.name}
        </Link>
        <span className="caption-credit ml-auto">
          {index >= 0 ? (
            <>
              Plate <span className="plate-no">{no}</span> of{" "}
              <span className="plate-no">{String(total).padStart(2, "0")}</span>
            </>
          ) : (
            "Plate"
          )}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[860px] px-5 pt-10 pb-6 md:px-8 md:pt-16">
        <figure className="m-0">
          {/* No mount where there was never a plate: the caption below then
              sits on the board on its own, which is what a text entry is. */}
          {coverOf(section) ? (
            <Media
              asset={coverOf(section)!}
              className="aspect-[16/10] max-h-[620px] w-full"
              caption={`plate ${no}`}
              layoutId={`plate-${section.id}`}
              tilt
            />
          ) : (
            // The same mount the run draws for a section with no
            // reproduction: the work's own title set on the plate.
            <Media
              asset={null}
              className="flex aspect-[16/10] max-h-[620px] w-full items-end"
              layoutId={`plate-${section.id}`}
              tilt
            >
              <div className="flex h-full w-full flex-col justify-end p-7 md:p-10">
                <span
                  className="font-heading block"
                  style={{
                    ...headline("clamp(34px, 4.4vw, 62px)"),
                    lineHeight: 1.02,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {section.title}
                </span>
              </div>
            </Media>
          )}
          {/* The caption card, lifted off the plate's bottom edge: it overlaps
              the trim by 40px and carries the page's deepest shadow, so it
              reads as a separate sheet laid on the mount rather than as the
              next block down. */}
          <motion.figcaption
            // The overlap is what makes the card read as lifted off the
            // plate. There is always a plate now — a section with no
            // reproduction gets its title set on the mount — so it always
            // applies.
            className="relative z-[1] mx-5 -mt-10 flex flex-col gap-4 p-6 md:mx-10 md:p-8"
            style={{
              background: "var(--color-bg)",
              boxShadow:
                "0 0 0 1px var(--color-divider), 0 18px 48px color-mix(in srgb, #050a14 55%, transparent)",
            }}
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 22, filter: "blur(8px)" }
            }
            animate={
              reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            transition={reduced ? { duration: 0.14 } : { duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-baseline gap-4">
              <span className="plate-no flex-none text-[15px]" style={{ color: "var(--color-mark)" }}>
                {no}
              </span>
              <h1
                className={coverOf(section) ? "m-0 leading-[1.08]" : "sr-only"}
                style={coverOf(section) ? headline("clamp(28px, 5vw, 42px)") : undefined}
              >
                {section.title}
              </h1>
            </div>
            <div className="caption-credit">
              {medium} · {credit}
            </div>
            {section.description && (
              <p className="m-0 max-w-[62ch] whitespace-pre-line text-[16px] leading-[1.65] text-muted">
                {section.description}
              </p>
            )}
            <div className="flex flex-col items-start gap-4">
              <SectionAside p={p} section={section} />
              <SectionLinks p={p} section={section} />
            </div>
          </motion.figcaption>
        </figure>
      </div>

      {/* The section's components, at the same measure as the caption
          above them. */}
      {shownBlocks(section).length > 0 && (
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-14 px-5 pb-14 md:px-8">
          {shownBlocks(section).map((b) => (
            <ComponentView key={b.id} p={p} section={section} block={b} />
          ))}
        </div>
      )}

      {/* The plate either side, so close reading can continue without
          returning to the page first. */}
      {(prev || next) && (
        <nav
          aria-label="Adjacent plates"
          className="mx-auto grid w-full max-w-[860px] gap-x-8 px-5 pb-10 sm:grid-cols-2 md:px-8"
        >
          {[prev, next].map((s, i) =>
            s ? (
              <Link
                key={s.id}
                href={`${pageHref}?section=${s.id}`}
                className={`flex min-h-[72px] flex-col gap-1.5 py-5 no-underline ${
                  i === 1 ? "sm:items-end sm:text-right" : ""
                }`}
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  color: "var(--color-ink)",
                }}
              >
                <span className="caption-credit">{i === 0 ? "Previous plate" : "Next plate"}</span>
                <span className="font-heading flex items-baseline gap-3 text-[19px] leading-tight">
                  <span className="plate-no text-[12px]" style={{ color: "var(--color-mark)" }}>
                    {String(all.indexOf(s) + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </span>
              </Link>
            ) : (
              <span key={i} aria-hidden />
            ),
          )}
        </nav>
      )}

      {/* The collection, still visible. This is the whole reason the detail
          view is a lift rather than a page: the plate list below says what
          else is in here, and marks where you are in it. */}
      <section className="mx-auto w-full max-w-[860px] px-5 pb-20 md:px-8">
        <h6 className="mb-4 text-muted">In this page</h6>
        <ol className="m-0 list-none p-0">
          {all.map((s, i) => {
            const on = s.id === section.id;
            return (
              <li key={s.id} style={{ borderTop: "1px solid var(--color-divider)" }}>
                <Link
                  href={`${pageHref}?section=${s.id}`}
                  aria-current={on ? "true" : undefined}
                  className="flex min-h-[52px] items-baseline gap-3.5 py-3.5 no-underline"
                  style={{
                    color: on ? "var(--color-mark)" : "var(--color-ink)",
                    opacity: on ? 1 : 0.7,
                  }}
                >
                  <span className="plate-no flex-none text-[12px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-heading min-w-0 flex-1 truncate text-[17px]">
                    {s.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
