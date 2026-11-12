/**
 * WTMC logo mark (red and blue towers over green sweeping lines), drawn as SVG
 * so it stays crisp at any size and each part can be animated by the loaders.
 * Uses the logo's own colours; pass `mono` to draw it in currentColor instead.
 */
export function BrandMark({
  className,
  title = "WTMC",
  animated = false,
  mono = false,
}: {
  className?: string;
  title?: string;
  animated?: boolean;
  mono?: boolean;
}) {
  const red = mono ? "currentColor" : "#e3262b";
  const blue = mono ? "currentColor" : "#2f80d6";
  const green = mono ? "currentColor" : "#5aa832";
  return (
    <svg
      className={"brand-mark" + (animated ? " is-animated" : "") + (className ? " " + className : "")}
      viewBox="10 2 150 140"
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      {/* red tower with a thin red sliver beside it */}
      <g className="bm-part bm-t1" fill={red}>
        <path d="M40 112V40L68 28V112Z" />
      </g>
      <path className="bm-part bm-t2" fill={red} d="M73 112V24L80 21V112Z" />
      {/* blue outlined tower */}
      <path
        className="bm-part bm-t3"
        fill={blue}
        fillRule="evenodd"
        d="M86 112V30L130 6V112ZM93 106H123V17L93 34Z M103 106V30L106 28V106Z"
      />
      {/* green sweeping lines */}
      <g className="bm-part bm-base" fill="none" stroke={green} strokeLinecap="round">
        <path strokeWidth="6" d="M16 132C46 112 96 104 154 108" />
        <path strokeWidth="4.5" d="M24 139C56 121 104 115 154 118" />
        <path strokeWidth="3" d="M36 142C66 129 108 125 150 127" />
      </g>
    </svg>
  );
}
