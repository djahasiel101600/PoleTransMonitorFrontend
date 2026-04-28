import { memo } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarRadiusAxis,
  Label,
} from "recharts";
import { ChartContainer } from "./ui/ChartContainer";

/** Radial gauge for transformer loading % (0–100+). */
export const LoadingGauge = memo(function LoadingGauge({
  value,
  max = 125,
  label = "Loading",
  size = 160,
}: {
  value: number | null;
  max?: number;
  label?: string;
  size?: number;
}) {
  const status =
    value == null || Number.isNaN(value)
      ? "normal"
      : value <= 100
        ? "normal"
        : value <= 125
          ? "warning"
          : "critical";

  const color =
    status === "critical"
      ? "var(--color-critical, #ef4444)"
      : status === "warning"
        ? "var(--color-warning, #f59e0b)"
        : "var(--color-primary, #14b8a6)";

  // Map value (0–max) to an arc end angle (0–360).
  const safeValue = value != null && !Number.isNaN(value) ? value : 0;
  const endAngle = Math.min((safeValue / max) * 360, 360);

  const chartData = [{ name: "loading", value: safeValue, fill: color }];
  const config = { loading: { label, color } };

  const displayText =
    value == null || Number.isNaN(value)
      ? "--"
      : `${value > 99.9 ? value.toFixed(0) : value.toFixed(1)}%`;

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`${label}: ${displayText}`}
    >
      <ChartContainer
        config={config}
        className="mx-auto"
        style={{ width: size, height: size } as React.CSSProperties}
      >
        <RadialBarChart
          width={size}
          height={size}
          data={chartData}
          startAngle={90}
          endAngle={90 - endAngle}
          outerRadius={size / 2 - 10}
          innerRadius={size / 2 - 26}
        >
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            className="first:fill-muted last:fill-background"
            polarRadius={[size / 2 - 10, size / 2 - 26]}
          />
          <RadialBar dataKey="value" background cornerRadius={6} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  const cx = viewBox.cx as number;
                  const cy = viewBox.cy as number;
                  return (
                    <text textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        y={cy}
                        className={`font-bold tabular-nums ${
                          status === "critical"
                            ? "fill-red-600 dark:fill-red-400"
                            : status === "warning"
                              ? "fill-amber-600 dark:fill-amber-400"
                              : "fill-foreground"
                        }`}
                        fontSize={size / 6}
                      >
                        {displayText}
                      </tspan>
                      <tspan
                        x={cx}
                        y={cy + size / 10}
                        className="fill-muted-foreground"
                        fontSize={size / 12}
                      >
                        {label}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </div>
  );
});

