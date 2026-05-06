import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import { useLiveData } from "../contexts/LiveDataContext";
import type { Reading, Alert } from "../types";

type TimeRange = "1h" | "6h" | "24h" | "custom";

const PRESET_RANGES: {
  value: Exclude<TimeRange, "custom">;
  label: string;
  ms: number;
}[] = [
  { value: "1h", label: "1 h", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 h", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

// Colour per condition for ReferenceLine labels
const CONDITION_COLORS: Record<string, string> = {
  normal: "#22c55e",
  heavy_load: "#f59e0b",
  heavy_peak_load: "#f97316",
  overload: "#ef4444",
  severe_overload: "#dc2626",
  danger_zone: "#b91c1c",
  critical: "#991b1b",
  abnormal: "#8b5cf6",
  poor_power_quality: "#0ea5e9",
};

const CHART_MARGIN = { top: 5, right: 20, left: 0, bottom: 5 };
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--color-foreground)" };

function isValidNum(v: number | null | undefined): v is number {
  return v != null && !Number.isNaN(v) && isFinite(v);
}

/** Convert a local datetime-input value (YYYY-MM-DDTHH:mm) to ISO string */
function localInputToISO(value: string): string {
  return new Date(value).toISOString();
}

/** Convert an ISO string to datetime-local input value */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ReadingKey = keyof Reading;

interface SingleMetricChartProps {
  transformerId: number | null;
  title: string;
  dataKey: ReadingKey;
  unit: string;
  color: string;
  yDomain?: [number | "auto", number | "auto"];
  validRange?: { min: number; max: number };
  alerts?: Alert[];
}

export function SingleMetricChart({
  transformerId,
  title,
  dataKey,
  unit,
  color,
  yDomain,
  validRange,
  alerts = [],
}: SingleMetricChartProps) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [showAlertMarkers, setShowAlertMarkers] = useState(false);
  const [brushIndices, setBrushIndices] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });

  // Custom range inputs
  const defaultEnd = isoToLocalInput(new Date().toISOString());
  const defaultStart = isoToLocalInput(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);
  const [appliedCustomStart, setAppliedCustomStart] = useState<string | null>(
    null,
  );
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<string | null>(null);

  const { wsReading, connected } = useLiveData();

  const rangeMs = useMemo(() => {
    if (timeRange === "custom") return null;
    return PRESET_RANGES.find((r) => r.value === timeRange)!.ms;
  }, [timeRange]);

  const trimToRange = useCallback(
    (list: Reading[]) => {
      if (timeRange === "custom") return list; // static window, no trimming
      const cutoff = Date.now() - rangeMs!;
      return list.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    },
    [rangeMs, timeRange],
  );

  // Fetch when transformer / range changes
  useEffect(() => {
    if (transformerId == null) return;
    if (timeRange === "custom" && (!appliedCustomStart || !appliedCustomEnd))
      return;

    // Signal the brush-reset effect to restore to full range after this fetch.
    fullReloadPendingRef.current = true;
    queueMicrotask(() => setLoading(true));
    const since =
      timeRange === "custom"
        ? localInputToISO(appliedCustomStart!)
        : new Date(Date.now() - rangeMs!).toISOString();
    const until =
      timeRange === "custom" ? localInputToISO(appliedCustomEnd!) : undefined;

    fetchReadings(transformerId, since, until)
      .then((r: Reading[]) => setReadings([...r].reverse()))
      .catch((e: unknown) => console.error(`Failed to fetch ${title} data:`, e))
      .finally(() => setLoading(false));
  }, [transformerId, timeRange, rangeMs, appliedCustomStart, appliedCustomEnd]);

  // Live WebSocket updates (only for preset ranges)
  useEffect(() => {
    if (wsReading == null || timeRange === "custom") return;
    queueMicrotask(() =>
      setReadings((prev) => {
        if (prev.some((r) => r.id === wsReading.id)) return prev;
        const merged = [...prev, wsReading].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return trimToRange(merged);
      }),
    );
  }, [wsReading, trimToRange, timeRange]);

  const chartData = useMemo(
    () =>
      readings.map((r) => {
        const raw = r[dataKey] as number | null | undefined;
        let value: number | null = null;
        if (isValidNum(raw)) {
          if (validRange) {
            value = raw >= validRange.min && raw <= validRange.max ? raw : null;
          } else {
            value = raw;
          }
        }
        // Use numeric ms timestamp so ReferenceLine x can be positioned freely
        return { time: new Date(r.timestamp).getTime(), value };
      }),
    [readings, dataKey, validRange],
  );

  const ZOOM_STEP = 0.25;
  const MIN_WINDOW = 10;

  // Set to true whenever a full data reload is triggered (transformer/range change).
  // Cleared after the resulting chartData update so that live appends do NOT
  // reset the user's zoom/pan position.
  const fullReloadPendingRef = useRef(true); // true on mount so the first load resets brush

  // Reset brush only on full reloads, not on live WebSocket appends.
  useEffect(() => {
    if (!fullReloadPendingRef.current) return;
    fullReloadPendingRef.current = false;
    setBrushIndices({ start: 0, end: Math.max(0, chartData.length - 1) });
  }, [chartData]);

  const handleZoomIn = useCallback(() => {
    setBrushIndices((prev) => {
      const len = prev.end - prev.start + 1;
      if (len <= MIN_WINDOW) return prev;
      const shrink = Math.max(1, Math.floor(len * ZOOM_STEP * 0.5));
      return {
        start: Math.min(prev.start + shrink, prev.end - MIN_WINDOW + 1),
        end: Math.max(prev.end - shrink, prev.start + MIN_WINDOW - 1),
      };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setBrushIndices((prev) => {
      const len = prev.end - prev.start + 1;
      const expand = Math.max(1, Math.floor(len * ZOOM_STEP * 0.5));
      return {
        start: Math.max(0, prev.start - expand),
        end: Math.min(chartData.length - 1, prev.end + expand),
      };
    });
  }, [chartData.length]);

  const handleZoomReset = useCallback(() => {
    setBrushIndices({ start: 0, end: Math.max(0, chartData.length - 1) });
  }, [chartData.length]);

  // Alerts that fall within the visible time window.
  // chartData.time is already in ms; alert timestamps are converted to ms for comparison.
  const visibleAlerts = useMemo(() => {
    if (!showAlertMarkers || alerts.length === 0 || chartData.length === 0)
      return [];
    let minT = Infinity;
    let maxT = -Infinity;
    for (const d of chartData) {
      if (d.time < minT) minT = d.time;
      if (d.time > maxT) maxT = d.time;
    }
    return alerts.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      // eslint-disable-next-line eqeqeq
      return a.transformer == transformerId && t >= minT && t <= maxT;
    });
  }, [alerts, chartData, showAlertMarkers, transformerId]);

  const hasData = chartData.some((d) => d.value != null);
  const label = unit ? `${title} (${unit})` : title;

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`Loading ${title} chart`}
        className="border-border/80 shadow-none"
      >
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(8rem,25vh,14rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-col gap-3">
        {/* Row 1: title + live badge + alert toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base font-semibold">{label}</CardTitle>
            {connected && timeRange !== "custom" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                  aria-hidden
                />
                Live
              </span>
            )}
          </div>

          {/* Alert marker toggle */}
          <button
            type="button"
            onClick={() => setShowAlertMarkers((v) => !v)}
            aria-label={
              showAlertMarkers ? "Hide alert markers" : "Show alert markers"
            }
            title={
              showAlertMarkers ? "Hide alert markers" : "Show alert markers"
            }
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              showAlertMarkers
                ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Alerts
          </button>
        </div>

        {/* Row 2: time range buttons + zoom controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-0.5 rounded-md border border-border/80 p-0.5">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setTimeRange(r.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  timeRange === r.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTimeRange("custom")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                timeRange === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Custom
            </button>
          </div>
          {/* Zoom controls — only visible when there's data */}
          {chartData.length >= 10 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={
                  brushIndices.end - brushIndices.start + 1 <= MIN_WINDOW
                }
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
          )}
        </div>

        {/* Row 3: custom date range inputs (only when custom is selected) */}
        {timeRange === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                From
              </label>
              <input
                type="datetime-local"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-border/80 bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                To
              </label>
              <input
                type="datetime-local"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-border/80 bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setAppliedCustomStart(customStart);
                setAppliedCustomEnd(customEnd);
              }}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <div className="flex h-[clamp(8rem,25vh,14rem)] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>No {title.toLowerCase()} data for this period</p>
            <p className="mt-1 text-xs">
              {timeRange === "custom"
                ? "Try adjusting the date range and clicking Apply"
                : "Readings will appear as the ESP32 sends data"}
            </p>
          </div>
        ) : (
          <div className="h-[clamp(10rem,30vh,18rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["auto", "auto"]}
                  tickFormatter={(ms: number) =>
                    new Date(ms).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: color }}
                  stroke={color}
                  className="text-muted-foreground"
                  domain={yDomain ?? ["auto", "auto"]}
                />
                <Tooltip
                  labelFormatter={(ms) => new Date(Number(ms)).toLocaleString()}
                  formatter={(value) => [
                    unit ? `${value} ${unit}` : value,
                    title,
                  ]}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                {visibleAlerts.map((alert) => (
                  <ReferenceLine
                    key={alert.id}
                    x={new Date(alert.timestamp).getTime()}
                    stroke={CONDITION_COLORS[alert.condition] ?? "#94a3b8"}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{
                      value: alert.condition.replace(/_/g, " "),
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: CONDITION_COLORS[alert.condition] ?? "#94a3b8",
                    }}
                  />
                ))}
                {chartData.length >= 10 && (
                  <Brush
                    dataKey="time"
                    height={28}
                    travellerWidth={8}
                    fill="var(--color-card)"
                    stroke="var(--color-border)"
                    tickFormatter={(ms: number) =>
                      new Date(ms).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
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
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
