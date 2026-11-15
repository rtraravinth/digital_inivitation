"use client";

import { useId, useState } from "react";
import { Modal } from "./ui";
import { settleResumeSaves, usePortfolios } from "@/lib/store";
import { printsOnResume, type ContactBlock, type Portfolio, type PublicContact } from "@/lib/types";

/**
 * Publishing, chosen per thing: the page and the resume are separate public
 * addresses, so each is its own tick, and the resume says which of its
 * contact details a visitor may see. Only details the resume actually holds
 * are offered; the website tick covers the header's links too.
 *
 * `only="resume"` is "Publish resume" from the lock screen: the page's tick
 * is gone and the page is left as it is.
 *
 * `contactOnly` is the same ticks re-opened from the lock screen of a live
 * portfolio: nothing is published or unpublished, only `publicContact` is
 * written, which the API allows while live.
 */
export function PublishDialog({
  p,
  onClose,
  contactOnly = false,
  only,
}: {
  p: Portfolio;
  onClose: () => void;
  contactOnly?: boolean;
  only?: "resume";
}) {
  const { updatePortfolio, updateResume } = usePortfolios();
  const uid = useId();
  const [page, setPage] = useState(only !== "resume");
  const [resume, setResume] = useState(true);
  const [contact, setContact] = useState<PublicContact>(p.resume.publicContact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const r = p.resume;
  // A Contact component on an on-resume section also holds details, and
  // prints them while it prints; offer a tick when either place has a value.
  const contacts = p.sections
    .filter((s) => s.onResume)
    .flatMap((s) => s.blocks.filter((b): b is ContactBlock => b.type === "contact" && printsOnResume(b)));
  const found = (own: string, pick: (b: ContactBlock) => string) =>
    own.trim() || contacts.map((b) => pick(b).trim()).find(Boolean) || "";
  const email = found(r.email, (b) => b.email);
  const phone = found(r.phone, (b) => b.phone);
  const location = found(r.location, (b) => b.location);
  const nLinks = p.header.links.length;
  const rows: Array<{ key: keyof PublicContact; label: string }> = [
    ...(email ? [{ key: "email" as const, label: `Email · ${email}` }] : []),
    ...(phone ? [{ key: "phone" as const, label: `Phone · ${phone}` }] : []),
    ...(location ? [{ key: "location" as const, label: `Location · ${location}` }] : []),
    ...(r.website.trim() || nLinks
      ? [{ key: "website" as const, label: `Website and links · ${r.website.trim() || `${nLinks} link${nLinks === 1 ? "" : "s"}`}` }]
      : []),
  ];

  const showTicks = !contactOnly && !only;
  const showContact = contactOnly || resume;

  async function submit() {
    setBusy(true);
    setError("");
    updateResume(p.id, (prev) => ({ ...prev, publicContact: contact }));
    // Nothing goes public unless the server holds exactly the ticks chosen
    // here: a failed write is swallowed by the store, so check what it kept.
    const { failed, portfolio } = await settleResumeSaves(p.id);
    const kept = portfolio?.resume.publicContact;
    const same = !!kept && (Object.keys(contact) as Array<keyof PublicContact>).every((k) => kept[k] === contact[k]);
    if (failed || !same) {
      setError(contactOnly ? "Your contact choices didn’t save. Try again." : "Your contact choices didn’t save, so nothing was published. Try again.");
      setBusy(false);
      return;
    }
    if (!contactOnly) {
      updatePortfolio(p.id, (prev) => ({
        ...prev,
        status: page ? "live" : prev.status,
        resumeStatus: resume ? "live" : prev.resumeStatus,
      }));
    }
    onClose();
  }

  const tick = "flex cursor-pointer items-center gap-2.5 text-[14px]";
  const box = "h-4 w-4 flex-none accent-[var(--color-ink)]";

  return (
    <Modal
      title={contactOnly ? "Contact details" : only ? "Publish resume" : "Publish"}
      description={
        contactOnly
          ? "What visitors to your resume can see. Anything unticked stays private."
          : only
            ? "Choose which contact details visitors to your resume can see."
            : "Choose what goes public. You can unpublish either one later."
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 0 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 0 }}
            disabled={busy || (!contactOnly && !page && !resume)}
            onClick={() => void submit()}
          >
            {contactOnly ? "Save" : only ? "Publish resume" : "Publish"}
          </button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {showTicks && (
          <label className={tick} htmlFor={`${uid}-page`}>
            <input id={`${uid}-page`} type="checkbox" className={box} checked={page} onChange={(e) => setPage(e.target.checked)} />
            Page
          </label>
        )}
        {showTicks && (
          <label className={tick} htmlFor={`${uid}-resume`}>
            <input id={`${uid}-resume`} type="checkbox" className={box} checked={resume} onChange={(e) => setResume(e.target.checked)} />
            Resume
          </label>
        )}
        {error && (
          <p role="alert" className="m-0 text-[13px]" style={{ color: "var(--color-ink)" }}>
            {error}
          </p>
        )}
        {showContact && (
          <fieldset
            className="m-0 flex min-w-0 flex-col gap-2.5 rounded-xl border-0 px-3.5 py-3"
            style={{ background: "var(--color-surface)", boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
          >
            <legend className="sr-only">Contact details visitors to the resume can see</legend>
            <span className="text-[12.5px] font-medium" style={{ color: "var(--color-neutral-700)" }} aria-hidden>
              Show on the resume
            </span>
            {rows.map((row) => (
              <label key={row.key} className={`${tick} min-w-0`} htmlFor={`${uid}-c-${row.key}`}>
                <input
                  id={`${uid}-c-${row.key}`}
                  type="checkbox"
                  className={box}
                  checked={contact[row.key]}
                  onChange={(e) => setContact((c) => ({ ...c, [row.key]: e.target.checked }))}
                />
                <span className="min-w-0 truncate">{row.label}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
