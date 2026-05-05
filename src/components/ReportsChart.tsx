import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import type { Reading } from "../types";

type Metric =
  | "voltage"
  | "current"
  | "apparent_power"
  | "real_power"
  | "power_factor"
  | "frequency";

const METRIC_CONFIG: Record<
  Metric,
  { label: string; color: string; unit: string }
> = {
  voltage: { label: "Voltage", color: "#0d9488", unit: "V" },
  current: { label: "Current", color: "#6366f1", unit: "A" },
  apparent_power: { label: "Apparent Power", color: "#f59e0b", unit: "VA" },
  real_power: { label: "Real Power", color: "#ef4444", unit: "W" },
  power_factor: { label: "Power Factor", color: "#10b981", unit: "" },
  frequency: { label: "Frequency", color: "#3b82f6", unit: "Hz" },
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--color-foreground)" };

const ZOOM_STEP = 0.25; // 25 % zoom per click
const MIN_WINDOW = 10; // minimum data points visible

export function ReportsChart({ readings }: { readings: Reading[] }) {
  const [visible, setVisible] = useState<Record<Metric, boolean>>({
    voltage: true,
    current: true,
    apparent_power: false,
    real_power: false,
    power_factor: false,
    frequency: false,
  });
  const [brushIndices, setBrushIndices] = useState<{
    start: number;
    end: number;
  }>({
    start: 0,
    end: 0,
  });

  const chartData = useMemo(
    () =>
      [...readings]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
        .map((r) => ({
          time: r.timestamp,
          voltage: r.voltage,
          current: r.current,
          apparent_power: r.apparent_power,
          real_power: r.real_power,
          power_factor: r.power_factor,
          frequency: r.frequency,
        })),
    [readings],
  );

  // Reset brush to full range whenever new data arrives.
  useEffect(() => {
    setBrushIndices({ start: 0, end: Math.max(0, chartData.length - 1) });
  }, [chartData]);

  const handleZoomIn = () => {
    const len = brushIndices.end - brushIndices.start + 1;
    if (len <= MIN_WINDOW) return;
    const shrink = Math.max(1, Math.floor(len * ZOOM_STEP * 0.5));
    setBrushIndices((prev) => ({
      start: Math.min(prev.start + shrink, prev.end - MIN_WINDOW + 1),
      end: Math.max(prev.end - shrink, prev.start + MIN_WINDOW - 1),
    }));
  };

  const handleZoomOut = () => {
    const len = brushIndices.end - brushIndices.start + 1;
    const expand = Math.max(1, Math.floor(len * ZOOM_STEP * 0.5));
    setBrushIndices((prev) => ({
      start: Math.max(0, prev.start - expand),
      end: Math.min(chartData.length - 1, prev.end + expand),
    }));
  };

  const handleZoomReset = () => {
    setBrushIndices({ start: 0, end: Math.max(0, chartData.length - 1) });
  };

  const stats = useMemo(() => {
    if (!readings.length) return null;
    let sumV = 0,
      sumI = 0,
      maxI = 0,
      sumPF = 0,
      cntV = 0,
      cntI = 0,
      cntPF = 0;
    for (const r of readings) {
      if (r.voltage != null) {
        sumV += r.voltage;
        cntV++;
      }
      if (r.current != null) {
        sumI += r.current;
        cntI++;
        if (r.current > maxI) maxI = r.current;
      }
      if (r.power_factor != null) {
        sumPF += r.power_factor;
        cntPF++;
      }
    }
    return {
      count: readings.length,
      avgVoltage: cntV ? (sumV / cntV).toFixed(1) : "—",
      avgCurrent: cntI ? (sumI / cntI).toFixed(2) : "—",
      peakCurrent: cntI ? maxI.toFixed(2) : "—",
      avgPF: cntPF ? (sumPF / cntPF).toFixed(3) : "—",
    };
  }, [readings]);

  const toggleMetric = (m: Metric) =>
    setVisible((prev) => ({ ...prev, [m]: !prev[m] }));

  if (!readings.length) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Apply filters to view chart data.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-col gap-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            Trend Analysis
          </CardTitle>
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={brushIndices.end - brushIndices.start + 1 <= MIN_WINDOW}
              title="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={
                brushIndices.start === 0 &&
                brushIndices.end === chartData.length - 1
              }
              title="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              title="Reset zoom"
              className="flex h-7 items-center rounded border border-border/80 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
        {/* Metric toggles */}
        <div className="flex flex-wrap gap-2">
          {(
            Object.entries(METRIC_CONFIG) as [
              Metric,
              (typeof METRIC_CONFIG)[Metric],
            ][]
          ).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleMetric(key)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                visible[key]
                  ? "border-transparent text-white"
                  : "border-border/80 bg-background text-muted-foreground",
              ].join(" ")}
              style={visible[key] ? { backgroundColor: cfg.color } : undefined}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        {stats && (
          <div className="mb-4 flex flex-wrap gap-3">
            <StatPill label="Readings" value={stats.count.toLocaleString()} />
            <StatPill label="Avg Voltage" value={`${stats.avgVoltage} V`} />
            <StatPill label="Avg Current" value={`${stats.avgCurrent} A`} />
            <StatPill label="Peak Current" value={`${stats.peakCurrent} A`} />
            <StatPill label="Avg PF" value={stats.avgPF} />
          </div>
        )}

        <div className="h-85 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="time"
                tickFormatter={fmtTime}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                stroke="var(--color-border)"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                stroke="var(--color-border)"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
              />
              <Legend />
              {(
                Object.entries(METRIC_CONFIG) as [
                  Metric,
                  (typeof METRIC_CONFIG)[Metric],
                ][]
              ).map(([key, cfg]) =>
                visible[key] ? (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={`${cfg.label} (${cfg.unit})`}
                    stroke={cfg.color}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                ) : null,
              )}
              <Brush
                dataKey="time"
                height={28}
                travellerWidth={8}
                fill="var(--color-card)"
                stroke="var(--color-border)"
                startIndex={brushIndices.start}
                endIndex={brushIndices.end}
                onChange={(range) => {
                  if (
                    range &&
                    typeof range.startIndex === "number" &&
                    typeof range.endIndex === "number"
                  ) {
                    setBrushIndices({
                      start: range.startIndex,
                      end: range.endIndex,
                    });
                  }
                }}
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtTime(t: string) {
  const d = new Date(t);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1">
      <span className="text-[11px] text-muted-foreground">{label}: </span>
      <span className="text-[11px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
