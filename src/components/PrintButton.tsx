"use client";

/**
 * Opens the browser print dialog ("Save as PDF" there). When `filename` is given it is
 * used as the page title while printing, which browsers use as the suggested PDF name.
 */
export function PrintButton({ label = "Print / Save PDF", filename }: { label?: string; filename?: string }) {
  return (
    <button
      className="btn btn-orange no-print"
      type="button"
      onClick={() => {
        const before = document.title;
        if (filename) document.title = filename.replace(/[\\/:*?"<>|]+/g, "-");
        const restore = () => {
          document.title = before;
          window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);
        window.print();
        // Some browsers don't fire afterprint reliably.
        setTimeout(restore, 1500);
      }}
    >
      {label}
    </button>
  );
}
