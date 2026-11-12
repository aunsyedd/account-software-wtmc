"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Slim branded progress bar at the top of the window while a page is loading.
 * The content area shows the logo loader (loading.tsx), so this only adds the bar.
 */
export function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setState((s) => (s === "loading" ? "done" : s));
    timer.current = window.setTimeout(() => setState("idle"), 450);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      const a = (event.target as HTMLElement | null)?.closest("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const next = new URL(href, window.location.href);
        if (next.origin !== window.location.origin) return;
        if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      } catch {
        return;
      }
      if (timer.current) window.clearTimeout(timer.current);
      setState("loading");
      // Safety net: never leave the bar stuck if navigation is cancelled.
      timer.current = window.setTimeout(() => setState("idle"), 15000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (state === "idle") return null;
  return <div className={"top-progress" + (state === "done" ? " is-done" : "")} role="progressbar" aria-label="Loading page" />;
}
