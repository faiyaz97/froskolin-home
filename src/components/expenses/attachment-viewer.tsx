"use client";

import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MAX_PREVIEW_PAGES, pdfRenderSize } from "@/lib/attachments/pdf-render";

import { iconActionClass } from "../ui/icon-action";

export function AttachmentViewer({ source, returnHref }: { source: string; returnHref: string }) {
  const router = useRouter();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const container = pagesRef.current;
    let objectUrl: string | undefined;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(source, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Attachment unavailable.");
        const mime = response.headers.get("Content-Type")?.split(";")[0] ?? "";
        const bytes = await response.arrayBuffer();
        if (cancelled) return;

        if (mime === "application/pdf") {
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const task = pdfjs.getDocument({ data: bytes });
          const pdf = await task.promise;
          try {
            if (
              !Number.isInteger(pdf.numPages) ||
              pdf.numPages < 1 ||
              pdf.numPages > MAX_PREVIEW_PAGES
            )
              throw new Error("This PDF is too large to preview.");
            for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
              const page = await pdf.getPage(number);
              const original = page.getViewport({ scale: 1 });
              const size = pdfRenderSize({
                pageCount: pdf.numPages,
                pageWidth: original.width,
                pageHeight: original.height,
                availableWidth: window.innerWidth - 32,
                devicePixelRatio: window.devicePixelRatio,
              });
              const viewport = page.getViewport({ scale: size.scale });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              if (!context || !container) throw new Error("Could not draw attachment.");
              canvas.width = size.canvasWidth;
              canvas.height = size.canvasHeight;
              canvas.style.width = `${viewport.width}px`;
              canvas.style.height = "auto";
              canvas.className = "max-w-full bg-white shadow-[var(--shadow-sm)]";
              await page.render({
                canvas,
                canvasContext: context,
                viewport,
                transform: [size.pixelRatio, 0, 0, size.pixelRatio, 0, 0],
              }).promise;
              if (!cancelled) container.append(canvas);
              page.cleanup();
            }
          } finally {
            await task.destroy();
          }
        } else if (mime.startsWith("image/")) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
          setImageUrl(objectUrl);
        } else {
          throw new Error("Unsupported attachment type.");
        }
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if (!cancelled) {
          setLoading(false);
          setError(
            cause instanceof Error && cause.message.startsWith("This PDF")
              ? cause.message
              : "This attachment couldn’t be opened. Return to the expense and try again.",
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      container?.replaceChildren();
    };
  }, [source]);

  function close() {
    router.replace(returnHref);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={close}
          className="hidden min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--muted)] hover:bg-white md:inline-flex"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to expense
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close attachment"
          className={iconActionClass({ className: "size-10" })}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {loading && (
        <div role="status" className="rounded-2xl bg-white p-5 text-sm text-[var(--muted)]">
          Opening attachment…
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl bg-white p-5 text-sm text-[var(--muted)]">
          {error}
        </div>
      )}
      {imageUrl && (
        // The private blob URL is created in this browser and cannot be optimized by Next.js.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Attachment" className="mx-auto h-auto max-w-full bg-white" />
      )}
      <div
        ref={pagesRef}
        className="grid justify-items-center gap-3"
        aria-label="Attachment pages"
      />
    </div>
  );
}
