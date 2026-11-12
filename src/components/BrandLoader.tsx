import { BrandMark } from "./BrandMark";

/**
 * Branded loading screen: the WTMC logo builds itself (base sweeps in,
 * towers rise one by one) inside a spinning ring, with a moving progress bar.
 *
 * - variant "screen": full-viewport overlay (sign-in, sign-out, first load)
 * - variant "panel":  fills the content area inside the app shell
 */
export function BrandLoader({
  label = "Loading",
  variant = "screen",
}: {
  label?: string;
  variant?: "screen" | "panel";
}) {
  return (
    <div
      className={"brand-loader brand-loader--" + variant}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="brand-loader-inner">
        <div className="brand-loader-mark">
          <span className="brand-loader-ring" />
          <span className="brand-loader-halo" />
          <BrandMark animated className="brand-loader-svg" />
        </div>
        {variant === "screen" ? (
          <div className="brand-loader-name">
            WTMC
            <small>Inventory Software</small>
          </div>
        ) : null}
        <div className="brand-loader-bar">
          <span />
        </div>
        <div className="brand-loader-label">
          {label}
          <span className="dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}
