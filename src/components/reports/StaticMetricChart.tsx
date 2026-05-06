import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Reading } from "../../types";

type ReadingKey = keyof Reading;

interface StaticMetricChartProps {
  readings: Reading[];
  dataKey: ReadingKey;
  title: string;
  unit: string;
  color: string;
  yDomain?: [number | "auto", number | "auto"];
  validRange?: { min: number; max: number };
}

function isValidNum(v: number | null | undefined): v is number {
  return v != null && !Number.isNaN(v) && isFinite(v);
}

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 4 };
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
};
const TOOLTIP_LABEL_STYLE = { color: "#1e293b" };

/** Lightweight static chart for the PDF report. No WebSocket, no controls. */
export function StaticMetricChart({
  readings, dataKey, title, unit, color, yDomain, validRange,
}: StaticMetricChartProps) {
  const chartData = useMemo(
    () =>
      readings.map((r) => {
        const raw = r[dataKey] as number | null | undefined;
        let value: number | null = null;
        if (isValidNum(raw)) {
          value = validRange
            ? raw >= validRange.min && raw <= validRange.max ? raw : null
            : raw;
        }
        return { time: new Date(r.timestamp).getTime(), value };
      }),
    [readings, dataKey, validRange],
  );

  const label = unit ? `${title} (${unit})` : title;
  const hasData = chartData.some((d) => d.value != null);

  if (!hasData) {
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>No {title.toLowerCase()} data</span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>{label}</div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["auto", "auto"]}
              tickFormatter={(ms: number) =>
                new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
              tick={{ fontSize: 9, fill: "#64748b" }}
              stroke="#cbd5e1"
            />
            <YAxis tick={{ fontSize: 9, fill: color }} stroke={color} domain={yDomain ?? ["auto", "auto"]} />
            <Tooltip
              labelFormatter={(ms) => new Date(Number(ms)).toLocaleString()}
              formatter={(value) => [unit ? `${value} ${unit}` : value, title]}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
