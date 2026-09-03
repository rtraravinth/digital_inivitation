"use client";

import { useState } from "react";
import { UploadButton } from "./UploadButton";
import { formatBytes, readFileAsset, readImageAsset } from "@/lib/assets";
import { newId } from "@/lib/store";
import { assetSrc, type Asset, type Section } from "@/lib/types";

type Change = (recipe: (s: Section) => Section) => void;

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
          className="grayscale-photo h-16 w-16 flex-none object-cover"
        />
      ) : (
        <span className="bg-surface border-divider mono-label flex h-16 w-16 flex-none items-center justify-center border">
          {(asset.name.split(".").pop() ?? "file").slice(0, 4)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-extrabold">{asset.name}</div>
        <div className="text-neutral-700 text-[11px]">{formatBytes(asset.size)}</div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-label="Remove"
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}

function NumberRows({ section, onChange }: { section: Section; onChange: Change }) {
  if (section.numbers.length === 0) return null;
  return (
    <div className="field mb-3">
      <label>Numbers — shown in “By the numbers”</label>
      <div className="flex flex-col gap-1.5">
        {section.numbers.map((n) => (
          <div key={n.id} className="flex items-start gap-1.5">
            <div className="grid flex-1 gap-1.5 sm:grid-cols-[110px_1fr]">
              <input
                className="input"
                placeholder="82"
                aria-label="Number value"
                value={n.value}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    numbers: s.numbers.map((x) =>
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
                  onChange((s) => ({
                    ...s,
                    numbers: s.numbers.map((x) =>
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
                onChange((s) => ({
                  ...s,
                  numbers: s.numbers.filter((x) => x.id !== n.id),
                }))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DateRows({ section, onChange }: { section: Section; onChange: Change }) {
  if (section.dates.length === 0) return null;
  return (
    <div className="field mb-3">
      <label>Dates — shown in the timeline</label>
      <div className="flex flex-col gap-1.5">
        {section.dates.map((d) => (
          <div key={d.id} className="flex items-start gap-1.5">
            <div className="grid flex-1 gap-1.5 sm:grid-cols-[110px_1fr]">
              <input
                className="input"
                placeholder="2019"
                aria-label="Year"
                value={d.year}
                onChange={(e) =>
                  onChange((s) => ({
                    ...s,
                    dates: s.dates.map((x) =>
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
                  onChange((s) => ({
                    ...s,
                    dates: s.dates.map((x) =>
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
                onChange((s) => ({ ...s, dates: s.dates.filter((x) => x.id !== d.id) }))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The five extras the canvas draws buttons for. Uploads live as data URIs in
 * localStorage, so images are downscaled and attachments are capped.
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
      <div className="mono-label mb-2">Add to this section (optional)</div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            onChange((s) => ({
              ...s,
              dates: [...s.dates, { id: newId(), year: "", text: "" }],
            }))
          }
        >
          Dates
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            onChange((s) => ({
              ...s,
              numbers: [...s.numbers, { id: newId(), value: "", label: "" }],
            }))
          }
        >
          Numbers
        </button>
        <UploadButton
          label={section.image ? "Replace image" : "Image"}
          accept="image/*"
          onError={setError}
          onPick={async (file) => {
            const image = await readImageAsset(file);
            onChange((s) => ({ ...s, image }));
          }}
        />
        <UploadButton
          label={section.file ? "Replace file" : "File"}
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
          Quote
        </button>
      </div>

      {error && (
        <p
          className="mb-3 text-[12px] font-extrabold"
          style={{ color: "var(--color-accent-700)" }}
          role="alert"
        >
          {error}
        </p>
      )}

      <NumberRows section={section} onChange={onChange} />
      <DateRows section={section} onChange={onChange} />

      {section.image && (
        <div className="field mb-3">
          <label>Image — shown at the top of the section card</label>
          <AssetChip
            asset={section.image}
            preview
            onRemove={() => onChange((s) => ({ ...s, image: null }))}
          />
        </div>
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
                ✕
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
          className="mb-2 text-[12px] font-extrabold"
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
