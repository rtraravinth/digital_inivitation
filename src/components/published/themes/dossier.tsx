"use client";

import { useState } from "react";
import type { Portfolio } from "@/lib/types";
import {
  DENSITY_PAD,
  HeaderLinks,
  Kicker,
  LensGate,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  groundStyle,
  headline,
  pad,
  tabs,
  usePublishedPrivacy,
  visibleSections,
} from "../shared";

export function Dossier({ p }: { p: Portfolio }) {
  // A lens is the whole point of this theme, so it asks regardless of the
  // Layout panel's navigation setting.
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const showContact = usePublishedPrivacy().showContact;
  const all = visibleSections(p);
  const options = tabs(p);
  const lens = picked && options.includes(picked) ? picked : (options[0] ?? "");
  const shown = lens ? all.filter((s) => s.tab === lens) : all;

  if (!answered && options.length > 0) {
    return (
      <div style={groundStyle(p)}>
        <LensGate
          p={p}
          setTab={(t) => {
            setPicked(t);
            setAnswered(true);
          }}
        />
      </div>
    );
  }

  return (
    <div style={groundStyle(p)}>

      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3 md:px-10"
        style={{ background: "var(--color-surface)", borderBottom: "2px solid var(--color-divider)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
          Reading as
        </span>
        {options.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPicked(t)}
            className={`tag cursor-pointer ${lens === t ? "tag-accent" : "tag-neutral"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`mx-auto max-w-[820px] ${pad(p).page}`}>
        <Kicker>{lens || "The whole picture"}</Kicker>
        <h1 className="m-0 mb-4 leading-[1.02]" style={headline("44px")}>{p.header.name}</h1>
        <p className="m-0 mb-6 max-w-[54ch] text-lg">{p.header.description}</p>
        {showContact && <HeaderLinks p={p} />}

        <hr className="hr" />

        {shown.map((s, i) => (
          <article key={s.id} className={DENSITY_PAD[p.layout.density].row}>
            <div className="mb-2 flex items-baseline gap-3">
              <span
                className="font-heading text-[11px] font-extrabold"
                style={{ color: "var(--color-accent)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="m-0">
                <SectionTitleLink p={p} section={s} className="hover:underline" />
              </h3>
            </div>
            {s.image && <Media asset={s.image} className="mb-3 h-[200px] w-full" />}
            <p className="m-0 mb-2 max-w-[62ch] text-[15px]">{s.description}</p>
            <SectionAside p={p} section={s} />
            <SectionLinks p={p} section={s} />
            <hr className="hr" />
          </article>
        ))}

        {shown.length === 0 && (
          <p style={{ color: "var(--color-neutral-700)" }}>
            Nothing filed under {lens}. Try another lens above.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Broadsheet — columns of type with rules between ──────────────────── */

