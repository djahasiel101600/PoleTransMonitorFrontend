/**
 * Minimal ChartContainer — applies CSS variable colour tokens so Recharts
 * `fill="var(--color-<key>)"` references resolve correctly.
 *
 * Usage:
 *   <ChartContainer config={{ loading: { color: "#14b8a6" } }} className="...">
 *     <RadialBarChart ...> ... </RadialBarChart>
 *   </ChartContainer>
 */
import type { ReactNode } from "react";

export type ChartConfig = Record<
  string,
  { label?: string; color?: string }
>;

export function ChartContainer({
  config,
  className,
  style,
  children,
}: {
  config: ChartConfig;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const cssVars = Object.entries(config).reduce<Record<string, string>>(
    (acc, [key, val]) => {
      if (val.color) acc[`--color-${key}`] = val.color;
      return acc;
    },
    {},
  );

  return (
    <div
      className={className}
      style={{ ...cssVars, ...style } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
