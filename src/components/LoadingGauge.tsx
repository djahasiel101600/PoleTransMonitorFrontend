import { memo } from "react";

/**
 * Semicircular gauge for loading % (0–100+).
 *
 * SVG geometry (all in SVG user units, viewBox "0 0 120 62"):
 *   r = 46   — arc radius
 *   cx = 60  — horizontal centre
 *   cy = 51  — arc baseline  (= r + strokeWidth/2 = 46+5, so the topmost
 *              stroke edge sits exactly at y=0 with no dead space)
 *   strokeWidth = 10
 *   Arc endpoints: (14, 51) → (106, 51)
 *   ViewBox height = cy + strokeWidth/2 = 51 + 5 = 56  (+6 bottom padding = 62)
 */
const R = 46;
const CX = 60;
const CY = 51;
const SW = 10;
const VBOX = "0 0 120 62";
const TRACK = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

function arcPath(percent: number): string {
  const clamped = Math.min(Math.max(percent, 0), 100);
  if (clamped <= 0) return "";
  const rad = (deg: number) => (deg * Math.PI) / 180;
  // Start at the left endpoint (180°), sweep clockwise to endAngle.
  const endAngle = 180 - clamped * 1.8; // 0% → 180°, 100% → 0°
  const x1 = CX + R * Math.cos(rad(180));
  const y1 = CY - R * Math.sin(rad(180));
  const x2 = CX + R * Math.cos(rad(endAngle));
  const y2 = CY - R * Math.sin(rad(endAngle));
  const large = clamped > 50 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

export const LoadingGauge = memo(function LoadingGauge({
  value,
  max = 125,
  label = "Loading",
  size = 120,
}: {
  value: number | null;
  max?: number;
  label?: string;
  size?: number;
}) {
  if (value == null || Number.isNaN(value)) {
    return (
      <div className="flex flex-col items-center gap-1" style={{ width: size }}>
        <svg viewBox={VBOX} width={size} aria-hidden>
          <path d={TRACK} fill="none" stroke="currentColor" strokeWidth={SW} className="text-muted" />
        </svg>
        <span className="text-lg font-semibold tabular-nums text-muted-foreground">--</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    );
  }

  const percent = Math.min(value, max);
  const status = value <= 100 ? "normal" : value <= 125 ? "warning" : "critical";
  const strokeColor =
    status === "critical"
      ? "var(--color-critical)"
      : status === "warning"
        ? "var(--color-warning)"
        : "var(--color-primary)";

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ width: size }}
      role="img"
      aria-label={`${label}: ${value.toFixed(1)}%`}
    >
      <svg viewBox={VBOX} width={size} aria-hidden>
        <path d={TRACK} fill="none" stroke="currentColor" strokeWidth={SW} className="text-muted" />
        <path
          d={arcPath(percent)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={SW}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={`text-xl font-bold tabular-nums leading-none ${
          status === "critical"
            ? "text-red-600 dark:text-red-400"
            : status === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
        }`}
      >
        {value > 99.9 ? value.toFixed(0) : value.toFixed(1)}%
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
});

