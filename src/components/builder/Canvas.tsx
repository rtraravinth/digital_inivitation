"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PreviewProvider,
  PublishedBody,
  PublishedHandleProvider,
} from "../published/themes";
import { pageAddress, type Portfolio } from "@/lib/types";

export type Device = "desktop" | "tablet" | "mobile";

export const DEVICES: Array<{ id: Device; name: string; width: number }> = [
  { id: "desktop", name: "Desktop", width: 1440 },
  { id: "tablet", name: "Tablet", width: 820 },
  { id: "mobile", name: "Mobile", width: 390 },
];

/** The canvas iframe starts empty; everything else is copied in or portaled. */
const FRAME_DOC =
  "<!doctype html><html><head><style>html,body{margin:0;height:100%}</style></head><body></body></html>";

/**
 * The real published page, in an iframe sized to the device, scaled to fit
 * whatever room its box has — both ways, so it never needs a scrollbar of
 * the builder's own.
 *
 * The iframe is what makes "Mobile" mean anything. A theme's `md:` and `lg:`
 * utilities are media queries, and a media query answers about the *window* —
 * so a 390px box inside a 1440px window still got the desktop layout, crammed
 * and overflowing sideways. An iframe has a window of its own, so the
 * breakpoints resolve the way they do on the device.
 *
 * The scale is a CSS transform, which does not change layout size, so the
 * iframe is given the unscaled size it needs and the outer box shows a
 * shrunken window onto it.
 *
 * `replay` remounts the page, which runs every entrance again — the only way
 * to see a motion theme's first impression twice without reloading.
 */
export function Canvas({
  p,
  handle,
  device,
  replay = 0,
  panX = true,
  chrome = true,
}: {
  p: Portfolio;
  handle: string;
  device: Device;
  replay?: number;
  /**
   * Whether a horizontal swipe inside the preview may scroll it.
   *
   * Off on a phone. The canvas fills the middle of that screen, so a swipe
   * meant to scroll the builder dragged the page's own sideways rows instead.
   * `touch-action: pan-y` refuses the horizontal gesture and leaves the
   * vertical one to the builder; taps still land.
   */
  panX?: boolean;
  /** The device's frame — a browser bar, or a phone's bezel. */
  chrome?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const width = (DEVICES.find((d) => d.id === device) ?? DEVICES[0]).width;
  const phone = device === "mobile";
  const bezel = chrome ? (phone ? 10 : 0) : 0;
  const bar = chrome && !phone ? 34 : 0;
  const scale = box.w > 0 ? Math.min(1, (box.w - bezel * 2) / width) : 0;
  const frameH = Math.max(240, box.h - bar - bezel * 2);

  return (
    <div ref={outerRef} className="flex h-full w-full items-start justify-center">
      {scale > 0 && (
        <div
          className="overflow-hidden"
          style={{
            width: width * scale + bezel * 2,
            padding: bezel,
            borderRadius: chrome && phone ? 38 : 10,
            background: chrome && phone ? "#0b0b0d" : "var(--color-bg)",
            boxShadow: "0 0 0 1px var(--color-divider), 0 30px 70px -30px #000c",
            transition: "width 320ms var(--ease-out)",
          }}
        >
          {bar > 0 && (
            <div
              className="flex items-center gap-2 px-3"
              style={{ height: bar, background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: "color-mix(in srgb, var(--color-ink) 22%, transparent)" }}
                />
              ))}
              <span
                className="mx-auto truncate rounded-full px-4 py-0.5 text-[11px]"
                style={{ background: "var(--color-bg)", color: "var(--color-neutral-700)", maxWidth: "60%" }}
              >
                {pageAddress(handle || "you", p.slug)}
              </span>
            </div>
          )}
          <div
            className="overflow-hidden"
            style={{
              height: frameH,
              borderRadius: chrome && phone ? 28 : 0,
            }}
          >
            <CanvasFrame width={width} height={frameH / scale} scale={scale} panX={panX}>
              {/* A preview, and it has to say so: otherwise a click in here is
                  recorded as a real visitor's, and a section title links to
                  /p/<handle>/<slug>, which does not resolve until the page is
                  published. */}
              <PreviewProvider value>
                <PublishedHandleProvider value={handle}>
                  <PublishedBody key={replay} p={p} />
                </PublishedHandleProvider>
              </PreviewProvider>
            </CanvasFrame>
          </div>
        </div>
      )}
    </div>
  );
}

/** One stylesheet of this document, in the form the iframe can re-render. */
type Sheet = { key: string; href?: string; css?: string };

/**
 * Every stylesheet in this document's head, kept current.
 *
 * The canvas iframe is a separate document and inherits none of the page's
 * CSS, so it has to render its own copy. In dev the bundler adds and swaps
 * these as you edit, which is what the observer is watching for.
 */
function useHeadSheets(): Sheet[] {
  const [sheets, setSheets] = useState<Sheet[]>([]);

  useEffect(() => {
    const read = () =>
      setSheets(
        [...document.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]')].map(
          (node, index) => {
            const href = node.getAttribute("href");
            return href
              ? { key: `l${href}`, href }
              : { key: `s${index}`, css: node.textContent ?? "" };
          },
        ),
      );

    read();
    const observer = new MutationObserver(read);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return sheets;
}

/**
 * An iframe carrying the app's stylesheets, rendering `children` through a
 * portal so they stay part of this React tree — same state, same context,
 * same live edits.
 *
 * Everything inside is rendered, never appended: the React Compiler will not
 * allow a document held in state to be mutated, and portalling the
 * stylesheets keeps them in step with the parent for free.
 */
function CanvasFrame({
  width,
  height,
  scale,
  panX,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  panX: boolean;
  children: React.ReactNode;
}) {
  // Set from the load event, not from a ref at mount: `srcDoc` replaces the
  // document *after* React attaches the element, so anything written before
  // that goes with the document it was written to.
  const [doc, setDoc] = useState<Document | null>(null);
  // The font variables are declared on <html> as classes, not in a
  // stylesheet. They are custom properties, so a wrapper inherits them. Read
  // once, lazily: on the server there is no document, and by the time this
  // is used the portal has mounted, so there is nothing to mismatch.
  const [rootClass] = useState(() =>
    typeof document === "undefined" ? "" : document.documentElement.className,
  );
  const sheets = useHeadSheets();

  return (
    <>
      <iframe
        title="Live preview"
        onLoad={(event) => setDoc(event.currentTarget.contentDocument)}
        srcDoc={FRAME_DOC}
        style={{
          width,
          height,
          border: 0,
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
      {doc &&
        createPortal(
          sheets.map((sheet) =>
            sheet.href ? (
              <link key={sheet.key} rel="stylesheet" href={sheet.href} />
            ) : (
              <style key={sheet.key} dangerouslySetInnerHTML={{ __html: sheet.css ?? "" }} />
            ),
          ),
          doc.head,
        )}
      {doc &&
        createPortal(
          // touch-action lives inside the iframe because that is the document
          // the gesture starts in — the parent's own value cannot reach it.
          <div
            className={rootClass}
            style={{ minHeight: "100%", touchAction: panX ? undefined : "pan-y" }}
          >
            {children}
          </div>,
          doc.body,
        )}
    </>
  );
}
