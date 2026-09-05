"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LinkEditor } from "./LinkEditor";
import { TagEditor } from "./TagEditor";
import { PortraitField, SectionExtras } from "./SectionExtras";
import { PublishedLock } from "./PublishedLock";
import { usePortfolios } from "@/lib/store";
import {
  previewPath,
  type LinkItem,
  type Portfolio,
  type PortfolioHeader,
  type Section,
} from "@/lib/types";

const HEADER_KEY = "header";

function sectionNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function LinkList({ links }: { links: LinkItem[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {links.map((l) => (
        <span key={l.id}>
          {l.label || "Untitled"} — {l.url || "—"}
        </span>
      ))}
    </div>
  );
}

/* ── the four fields, identical everywhere ───────────────────────────── */

function SectionFields({
  section,
  onChange,
}: {
  section: Section;
  onChange: (recipe: (s: Section) => Section) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`title-${section.id}`}>Section title</label>
        <input
          id={`title-${section.id}`}
          className="input"
          style={{ fontWeight: 800, fontSize: 18, minHeight: 44 }}
          placeholder="Section title"
          value={section.title}
          onChange={(e) => onChange((s) => ({ ...s, title: e.target.value }))}
        />
      </div>

      <div className="field">
        <label htmlFor={`desc-${section.id}`}>Description</label>
        <textarea
          id={`desc-${section.id}`}
          className="input"
          placeholder="What it is, in a few sentences"
          value={section.description}
          onChange={(e) => onChange((s) => ({ ...s, description: e.target.value }))}
        />
      </div>

      <div className="field">
        <label>Tags</label>
        <TagEditor
          tags={section.tags}
          onChange={(tags) => onChange((s) => ({ ...s, tags }))}
        />
      </div>

      <div className="field">
        <label>Links</label>
        <LinkEditor
          links={section.links}
          onChange={(links) => onChange((s) => ({ ...s, links }))}
        />
      </div>

      <SectionExtras section={section} onChange={onChange} />
    </>
  );
}

function HeaderFields({
  header,
  onChange,
}: {
  header: PortfolioHeader;
  onChange: (recipe: (h: PortfolioHeader) => PortfolioHeader) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="h-name">Name</label>
        <input
          id="h-name"
          className="input"
          style={{ fontWeight: 800, fontSize: 22, minHeight: 48 }}
          placeholder="Your name"
          value={header.name}
          onChange={(e) => onChange((h) => ({ ...h, name: e.target.value }))}
        />
      </div>

      <div className="field">
        <label htmlFor="h-current">Current</label>
        <input
          id="h-current"
          className="input"
          placeholder="What you're doing right now"
          value={header.current}
          onChange={(e) => onChange((h) => ({ ...h, current: e.target.value }))}
        />
      </div>

      <div className="field">
        <label htmlFor="h-desc">Description</label>
        <textarea
          id="h-desc"
          className="input"
          placeholder="A few lines about your work"
          value={header.description}
          onChange={(e) => onChange((h) => ({ ...h, description: e.target.value }))}
        />
      </div>

      <div className="field">
        <label>Tags</label>
        <TagEditor
          accentFirst
          tags={header.tags}
          onChange={(tags) => onChange((h) => ({ ...h, tags }))}
        />
      </div>

      <div className="field">
        <label>Links</label>
        <LinkEditor
          links={header.links}
          onChange={(links) => onChange((h) => ({ ...h, links }))}
        />
      </div>

      <PortraitField
        portrait={header.portrait}
        onChange={(portrait) => onChange((h) => ({ ...h, portrait }))}
      />
    </>
  );
}

/* ── the document row, desktop ────────────────────────────────────────── */

function DocRow({
  label,
  editing = false,
  onOpen,
  children,
  last = false,
  innerRef,
}: {
  label: React.ReactNode;
  editing?: boolean;
  onOpen?: () => void;
  children: React.ReactNode;
  last?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const interactive = Boolean(onOpen) && !editing;
  return (
    <div
      ref={innerRef}
      className={[
        "border-divider grid grid-cols-[120px_1fr]",
        last ? "" : "border-b-2",
        editing
          ? "bg-surface shadow-[inset_3px_0_0_var(--color-accent)]"
          : interactive
            ? "hover:bg-neutral-100 cursor-pointer"
            : "",
      ].join(" ")}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            },
          }
        : {})}
    >
      <div className="py-[22px] pl-5">{label}</div>
      <div className="flex flex-col gap-3 py-[22px] pr-6">{children}</div>
    </div>
  );
}

/* ── the editor ───────────────────────────────────────────────────────── */

export function Editor({ id }: { id: string }) {
  const {
    ready,
    storageError,
    getPortfolio,
    updatePortfolio,
    updateSection,
    addBlockAsync,
    deleteSection,
    moveSection,
  } = usePortfolios();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  const editingRef = useRef<HTMLDivElement>(null);
  /** Refs, not state — this must not cause a render of its own. */
  const justAddedRef = useRef<string | null>(null);

  // A new section lands at the end of a long document, well below the button
  // that created it. Bring it into view, and put the cursor in its title.
  useEffect(() => {
    if (!editingId) return;
    editingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (justAddedRef.current === editingId) {
      justAddedRef.current = null;
      document.getElementById(`title-${editingId}`)?.focus({ preventScroll: true });
    }
  }, [editingId]);

  // The mobile form replaces the list, so it must start at the top.
  useEffect(() => {
    if (mobileOpen) window.scrollTo({ top: 0 });
  }, [mobileOpen]);

  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="p-10">
        <h2>{ready ? "That portfolio doesn't exist." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  // A live page is frozen — the API refuses every write to it — so this
  // screen steps aside for Preview and Unpublish rather than rendering
  // controls that can only fail.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const p: Portfolio = portfolio;

  const setHeader = (recipe: (h: PortfolioHeader) => PortfolioHeader) =>
    updatePortfolio(p.id, (prev) => ({ ...prev, header: recipe(prev.header) }));

  const publish = () =>
    updatePortfolio(p.id, (prev) => ({ ...prev, status: "live" }));

  async function addAndEdit() {
    // The server mints the id, so the new section can only be focused once
    // it answers.
    const added = await addBlockAsync(p.id);
    if (!added) return;
    justAddedRef.current = added;
    setEditingId(added);
  }

  const openSection = mobileOpen
    ? p.sections.find((s) => s.id === mobileOpen)
    : undefined;
  const openSectionIndex = p.sections.findIndex((s) => s.id === mobileOpen);

  return (
    <>
      {/* ── top bar ─────────────────────────────────────────────────── */}
      <div className="nav bg-bg gap-3.5">
        <Link href="/" className="font-heading text-[13px] font-extrabold">
          ← Portfolios
        </Link>
        <span className="nav-brand mr-0 hidden text-[15px] sm:inline">{p.name}</span>
        <span className="status status-draft mr-auto">Not published — saved</span>
        <Link href={`/builder/${p.id}`} className="btn btn-secondary">
          Builder
        </Link>
        <Link
          href={previewPath(p.id)}
          className="btn btn-secondary"
          // A new tab, because the point of a preview is seeing the page
          // with nothing of the app around it — exactly what a visitor gets.
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview
        </Link>
        <button type="button" className="btn btn-primary" onClick={publish}>
          Publish
        </button>
      </div>

      {storageError && (
        <div
          role="alert"
          className="px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {storageError}
        </div>
      )}

      {/* ══ desktop — the document ═══════════════════════════════════ */}
      <div className="hidden lg:block">
        <div className="border-divider bg-surface flex items-center gap-5 border-b-2 px-6 py-2.5">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addAndEdit}
          >
            + Add section
          </button>
          <button
            type="button"
            className={`btn ${reordering ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setReordering((v) => !v);
              setEditingId(null);
            }}
          >
            Reorder
          </button>
          <span className="mono-label ml-auto">
            1 header · {p.sections.length} section{p.sections.length === 1 ? "" : "s"}
            {p.sections.some((s) => s.hidden) &&
              ` · ${p.sections.filter((s) => s.hidden).length} hidden`}
          </span>
        </div>

        <div className="bg-neutral-300 flex justify-center p-7">
          <div className="border-divider bg-bg w-[860px] max-w-full border-2">
            {/* header block */}
            {editingId === HEADER_KEY ? (
              <DocRow
                editing
                innerRef={editingRef}
                label={
                  <>
                    <div className="mono-label text-accent">Header</div>
                    <div className="mono-label mt-1.5">Editing</div>
                  </>
                }
              >
                <HeaderFields header={p.header} onChange={setHeader} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setEditingId(null)}
                  >
                    Done
                  </button>
                </div>
              </DocRow>
            ) : (
              <DocRow
                label={<div className="mono-label">Header</div>}
                onOpen={reordering ? undefined : () => setEditingId(HEADER_KEY)}
              >
                <Field label="Name">
                  <div className="font-heading text-[34px] font-extrabold leading-[1.05]">
                    {p.header.name || (
                      <span className="text-neutral-400">Your name</span>
                    )}
                  </div>
                </Field>
                <Field label="Current">
                  <div className="text-[15px] font-extrabold">
                    {p.header.current || (
                      <span className="text-neutral-400 font-normal">
                        What you&rsquo;re doing right now
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Description">
                  <p className="text-neutral-800 m-0 max-w-[62ch] text-[15px]">
                    {p.header.description || (
                      <span className="text-neutral-400">
                        A few lines about your work
                      </span>
                    )}
                  </p>
                </Field>
                {p.header.tags.length > 0 && (
                  <Field label="Tags">
                    <div className="flex flex-wrap gap-1.5">
                      {p.header.tags.map((t, i) => (
                        <span
                          key={t}
                          className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
                {p.header.links.length > 0 && (
                  <Field label="Links">
                    <LinkList links={p.header.links} />
                  </Field>
                )}
              </DocRow>
            )}

            {/* sections */}
            {p.sections.map((s, i) => {
              const editing = editingId === s.id;
              return (
                <DocRow
                  key={s.id}
                  editing={editing}
                  innerRef={editing ? editingRef : undefined}
                  onOpen={reordering ? undefined : () => setEditingId(s.id)}
                  label={
                    reordering ? (
                      <div className="flex flex-col gap-1">
                        <div className="mono-label">Section {sectionNumber(i)}</div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            aria-label="Move section up"
                            disabled={i === 0}
                            onClick={() => moveSection(p.id, s.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            aria-label="Move section down"
                            disabled={i === p.sections.length - 1}
                            onClick={() => moveSection(p.id, s.id, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`mono-label ${editing ? "text-accent" : ""}`}
                        >
                          Section {sectionNumber(i)}
                        </div>
                        {editing && <div className="mono-label mt-1.5">Editing</div>}
                      </>
                    )
                  }
                >
                  {editing ? (
                    <>
                      <SectionFields
                        section={s}
                        onChange={(recipe) => updateSection(p.id, s.id, recipe)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setEditingId(null)}
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            deleteSection(p.id, s.id);
                            setEditingId(null);
                          }}
                        >
                          Delete section
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-heading text-2xl font-extrabold leading-[1.1]">
                        {s.title || (
                          <span className="text-neutral-400">Section title</span>
                        )}
                      </div>
                      <p className="text-neutral-800 m-0 max-w-[62ch] text-[15px]">
                        {s.description || (
                          <span className="text-neutral-400">
                            What it is, in a few sentences
                          </span>
                        )}
                      </p>
                      {s.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.tags.map((t) => (
                            <span key={t} className="tag tag-neutral">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <LinkList links={s.links} />
                    </>
                  )}
                </DocRow>
              );
            })}

            {/* add section */}
            <div className="grid grid-cols-[120px_1fr]">
              <div />
              <div className="pb-6 pr-6 pt-5">
                <button
                  type="button"
                  className="btn btn-secondary btn-block shadow-[inset_0_0_0_2px_var(--color-divider)]"
                  style={{ padding: 14 }}
                  onClick={addAndEdit}
                >
                  + Add section
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ mobile — a list of sections, one form at a time ═══════════ */}
      <div className="lg:hidden">
        {openSection ? (
          <>
            <div className="border-divider flex items-center gap-2.5 border-b-2 px-4 py-3">
              <button
                type="button"
                className="font-heading text-xs font-extrabold"
                onClick={() => setMobileOpen(null)}
                aria-label="Back to sections"
              >
                ←
              </button>
              <span className="font-heading text-sm font-extrabold">
                Section {sectionNumber(openSectionIndex)}
              </span>
              <button
                type="button"
                className="btn btn-primary ml-auto"
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() => setMobileOpen(null)}
              >
                Done
              </button>
            </div>
            <div className="flex flex-col gap-3.5 p-4">
              <SectionFields
                section={openSection}
                onChange={(recipe) => updateSection(p.id, openSection.id, recipe)}
              />
              <button
                type="button"
                className="btn btn-ghost self-start"
                onClick={() => {
                  deleteSection(p.id, openSection.id);
                  setMobileOpen(null);
                }}
              >
                Delete section
              </button>
            </div>
          </>
        ) : mobileOpen === HEADER_KEY ? (
          <>
            <div className="border-divider flex items-center gap-2.5 border-b-2 px-4 py-3">
              <button
                type="button"
                className="font-heading text-xs font-extrabold"
                onClick={() => setMobileOpen(null)}
                aria-label="Back to sections"
              >
                ←
              </button>
              <span className="font-heading text-sm font-extrabold">Header</span>
              <button
                type="button"
                className="btn btn-primary ml-auto"
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() => setMobileOpen(null)}
              >
                Done
              </button>
            </div>
            <div className="flex flex-col gap-3.5 p-4">
              <HeaderFields header={p.header} onChange={setHeader} />
            </div>
          </>
        ) : (
          <>
            <div className="border-divider bg-surface border-b-2 px-4 py-3.5">
              <div className="mono-label mb-1.5">Header</div>
              <div className="font-heading text-xl font-extrabold">
                {p.header.name || (
                  <span className="text-neutral-400">Your name</span>
                )}
              </div>
              <div className="text-neutral-700 text-xs">{p.header.current}</div>
              {p.header.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.header.tags.map((t, i) => (
                    <span
                      key={t}
                      className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="font-heading mt-2.5 inline-block text-xs font-extrabold"
                onClick={() => setMobileOpen(HEADER_KEY)}
              >
                Edit header →
              </button>
            </div>

            <div className="flex items-baseline px-4 pb-1.5 pt-3">
              <h6 className="m-0">Sections</h6>
              <button
                type="button"
                className="text-neutral-600 ml-auto text-[11px] underline"
                onClick={() => setReordering((v) => !v)}
              >
                {reordering ? "Done reordering" : "Reorder"}
              </button>
            </div>

            {p.sections.map((s, i) => (
              <div
                key={s.id}
                className="border-divider flex items-center gap-3 border-b px-4 py-3"
              >
                <span className="font-heading text-neutral-400 text-[11px] font-extrabold">
                  {sectionNumber(i)}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-heading truncate text-sm font-extrabold leading-tight">
                    {s.title || (
                      <span className="text-neutral-400">Untitled section</span>
                    )}
                  </span>
                  <span className="text-neutral-700 text-[11px]">
                    {s.tags.length} tag{s.tags.length === 1 ? "" : "s"} ·{" "}
                    {s.links.length} link{s.links.length === 1 ? "" : "s"}
                  </span>
                </span>

                {reordering ? (
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      aria-label="Move section up"
                      disabled={i === 0}
                      onClick={() => moveSection(p.id, s.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      aria-label="Move section down"
                      disabled={i === p.sections.length - 1}
                      onClick={() => moveSection(p.id, s.id, 1)}
                    >
                      ↓
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="font-heading text-neutral-600 ml-auto text-[13px] font-extrabold"
                    aria-label={`Edit ${s.title || "untitled section"}`}
                    onClick={() => setMobileOpen(s.id)}
                  >
                    ›
                  </button>
                )}
              </div>
            ))}

            <div className="p-4">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={async () => setMobileOpen(await addBlockAsync(p.id))}
              >
                + Add section
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono-label mb-1">{label}</div>
      {children}
    </div>
  );
}
