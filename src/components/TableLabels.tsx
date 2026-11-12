"use client";

import { useEffect } from "react";

/**
 * Copies each column header onto its cells as `data-label`, so on phones the
 * CSS can show every table row as a stacked card ("Phone: +966…") instead of
 * a wide table that has to be scrolled sideways. Re-runs whenever tables change.
 */
function labelTables(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>("table.data").forEach((table) => {
    const headRow = table.tHead?.rows[0];
    if (!headRow) return;
    const labels: string[] = [];
    for (const th of Array.from(headRow.cells)) {
      const text = (th.textContent || "").trim();
      for (let n = 0; n < (th.colSpan || 1); n++) labels.push(text);
    }
    const rows = [...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)), ...(table.tFoot ? Array.from(table.tFoot.rows) : [])];
    for (const row of rows) {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const label = labels[col] || "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        col += cell.colSpan || 1;
      }
    }
  });
}

export function TableLabels() {
  useEffect(() => {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        labelTables(document);
      });
    });
    // Wait until the first page has finished loading/hydrating before touching
    // the server-rendered cells, so React never sees attributes it didn't render.
    let timer: number | undefined;
    const start = () => {
      timer = window.setTimeout(() => {
        labelTables(document);
        observer.observe(document.body, { childList: true, subtree: true });
      }, 400);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
  return null;
}
