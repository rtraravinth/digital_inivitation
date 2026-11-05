"use client";

import { useState } from "react";
import { UploadButton } from "./UploadButton";
import { Glyph } from "@/lib/glyphs";
import { formatBytes, readFileAsset, readImageAsset } from "@/lib/assets";
import { newId } from "@/lib/store";
import { assetSrc, type Asset, type PortfolioHeader, type Section } from "@/lib/types";

type Change = (recipe: (s: Section) => Section) => void;
type HeaderChange = (recipe: (h: PortfolioHeader) => PortfolioHeader) => void;

function AssetChip({
  asset,
  preview,
  onRemove,
}: {
  asset: Asset;
  preview?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="border-divider flex items-start gap-3 border p-2.5">
      {preview ? (
        // A data URI out of localStorage — next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetSrc(asset)}
          alt={asset.name}
          className="h-16 w-16 flex-none object-cover"
        />
      ) : (
        <span className="bg-surface border-divider mono-label flex h-16 w-16 flex-none items-center justify-center border">
          {(asset.name.split(".").pop() ?? "file").slice(0, 4)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">{asset.name}</div>
        <div className="text-neutral-700 text-[11px]">{formatBytes(asset.size)}</div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-label="Remove"
        onClick={onRemove}
      >
        <Glyph id="close" size={15} />
      </button>
    </div>
  );
}

function NumberRows({ header, onChange }: { header: PortfolioHeader; onChange: HeaderChange }) {
  if (header.numbers.length === 0) return null;
  return (
    <div className="field mb-3">
      <label>Numbers — shown in “By the numbers”</label>
      <div className="flex flex-col gap-1.5">
        {header.numbers.map((n) => (
          <div key={n.id} className="flex items-start gap-1.5">
            <div className="grid flex-1 gap-1.5 sm:grid-cols-[110px_1fr]">
              <input
                className="input"
                placeholder="82"
                aria-label="Number value"
                value={n.value}
                onChange={(e) =>
                  onChange((h) => ({
                    ...h,
                    numbers: h.numbers.map((x) =>
                      x.id === n.id ? { ...x, value: e.target.value } : x,
                    ),
                  }))
                }
              />
              <input
                className="input"
                placeholder="Issues"
                aria-label="Number label"
                value={n.label}
                onChange={(e) =>
                  onChange((h) => ({
                    ...h,
                    numbers: h.numbers.map((x) =>
                      x.id === n.id ? { ...x, label: e.target.value } : x,
                    ),
                  }))
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Remove number"
              onClick={() =>
                onChange((h) => ({
                  ...h,
                  numbers: h.numbers.filter((x) => x.id !== n.id),
                }))
              }
            >
              <Glyph id="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DateRows({ header, onChange }: { header: PortfolioHeader; onChange: HeaderChange }) {
  if (header.dates.length === 0) return null;
  return (
    <div className="field mb-3">
      <label>Dates — shown in the timeline</label>
      <div className="flex flex-col gap-1.5">
        {header.dates.map((d) => (
          <div key={d.id} className="flex items-start gap-1.5">
            <div className="grid flex-1 gap-1.5 sm:grid-cols-[110px_1fr]">
              <input
                className="input"
                placeholder="2019"
                aria-label="Year"
                value={d.year}
                onChange={(e) =>
                  onChange((h) => ({
                    ...h,
                    dates: h.dates.map((x) =>
                      x.id === d.id ? { ...x, year: e.target.value } : x,
                    ),
                  }))
                }
              />
              <input
                className="input"
                placeholder="What happened"
                aria-label="Event"
                value={d.text}
                onChange={(e) =>
                  onChange((h) => ({
                    ...h,
                    dates: h.dates.map((x) =>
                      x.id === d.id ? { ...x, text: e.target.value } : x,
                    ),
                  }))
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="Remove date"
              onClick={() =>
                onChange((h) => ({ ...h, dates: h.dates.filter((x) => x.id !== d.id) }))
              }
            >
              <Glyph id="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The page's numbers and its timeline.
 *
 * They sit on the header because the published page draws one "By the
 * numbers" row and one timeline for the whole portfolio — put them on a
 * section and every theme has to gather them back up again, and the author
 * has to guess which section to type them into.
 */
export function PortfolioExtras({
  header,
  onChange,
}: {
  header: PortfolioHeader;
  onChange: HeaderChange;
}) {
  return (
    <div className="border-divider border-t pt-3">
      <div className="mono-label mb-2">Add to this portfolio (optional)</div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            onChange((h) => ({
              ...h,
              numbers: [...h.numbers, { id: newId(), value: "", label: "" }],
            }))
          }
        >
          Numbers
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            onChange((h) => ({
              ...h,
              dates: [...h.dates, { id: newId(), year: "", text: "" }],
            }))
          }
        >
          Dates
        </button>
      </div>

      <NumberRows header={header} onChange={onChange} />
      <DateRows header={header} onChange={onChange} />
    </div>
  );
}

/**
 * The two extras that belong to one section: a file and a pull quote.
 * Pictures have their own field and the rest are components; numbers and
 * the page-wide timeline are the header's — see `PortfolioExtras`.
 */
export function SectionExtras({
  section,
  onChange,
}: {
  section: Section;
  onChange: Change;
}) {
  const [error, setError] = useState("");

  return (
    <div className="border-divider border-t pt-3">
      <div className="mono-label mb-2">Attach (optional)</div>

      <div className="mb-3 flex flex-wrap gap-2">
        <UploadButton
          label={section.file ? "Replace file" : "A file to download"}
          accept=".pdf,.doc,.docx,.txt,.csv,.md"
          onError={setError}
          onPick={async (file) => {
            const asset = await readFileAsset(file);
            onChange((s) => ({ ...s, file: asset }));
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={Boolean(section.quote)}
          onClick={() => onChange((s) => ({ ...s, quote: { text: "", attribution: "" } }))}
        >
          A pull quote
        </button>
      </div>

      {error && (
        <p
          className="mb-3 text-[12px]"
          style={{ color: "var(--color-accent-700)" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {section.file && (
        <div className="field mb-3">
          <label>File — offered as a download on the published page</label>
          <AssetChip
            asset={section.file}
            onRemove={() => onChange((s) => ({ ...s, file: null }))}
          />
        </div>
      )}

      {section.quote && (
        <div className="field">
          <label htmlFor={`quote-${section.id}`}>Quote — set as a pull quote</label>
          <div className="flex flex-col gap-1.5">
            <textarea
              id={`quote-${section.id}`}
              className="input"
              style={{ minHeight: 60 }}
              placeholder="What someone said"
              value={section.quote.text}
              onChange={(e) =>
                onChange((s) => ({
                  ...s,
                  quote: {
                    text: e.target.value,
                    attribution: s.quote?.attribution ?? "",
                  },
                }))
              }
            />
            <div className="flex items-start gap-1.5">
              <input
                className="input"
                placeholder="Who said it"
                aria-label="Attribution"
                value={section.quote.attribution}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    quote: { text: s.quote?.text ?? "", attribution: e.target.value },
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                aria-label="Remove quote"
                onClick={() => onChange((s) => ({ ...s, quote: null }))}
              >
                <Glyph id="close" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The header portrait — the one image the published hero renders. */
export function PortraitField({
  portrait,
  onChange,
}: {
  portrait: Asset | null;
  onChange: (next: Asset | null) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="field">
      <label>Portrait</label>
      <div className="mb-2 flex flex-wrap gap-2">
        <UploadButton
          label={portrait ? "Replace portrait" : "Upload portrait"}
          accept="image/*"
          onError={setError}
          onPick={async (file) => onChange(await readImageAsset(file))}
        />
      </div>
      {error && (
        <p
          className="mb-2 text-[12px]"
          style={{ color: "var(--color-accent-700)" }}
          role="alert"
        >
          {error}
        </p>
      )}
      {portrait && <AssetChip asset={portrait} preview onRemove={() => onChange(null)} />}
    </div>
  );
}
