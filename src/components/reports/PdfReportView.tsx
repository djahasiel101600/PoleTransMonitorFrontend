import { useRef, useState, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { generateTransformerReport } from "../../lib/generatePdf";
import { StaticMetricChart } from "./StaticMetricChart";
import type { Reading, Alert, Transformer } from "../../types";

// ---------- helpers identical to ConditionDonut ----------
type ConditionLevel = "normal" | "warning" | "critical";
function classifyReading(r: Reading, t: Transformer | null): ConditionLevel {
  const nominalV = t?.nominal_voltage ?? 220;
  const ratedA = t?.rated_current ?? 100;
  const ratedVa = t ? t.rated_kva * 1000 : 15000;
  const nominalF = t?.nominal_freq ?? 50;
  let worst: ConditionLevel = "normal";
  if (r.voltage != null && !Number.isNaN(r.voltage)) {
    const low = nominalV * 0.93; const high = nominalV * 1.07;
    if (r.voltage < low || r.voltage > high) worst = "critical";
  }
  if (r.current != null && !Number.isNaN(r.current)) {
    const pct = (r.current / ratedA) * 100;
    if (pct > 125) worst = "critical";
    else if (pct > 100 && worst === "normal") worst = "warning";
  }
  if (r.apparent_power != null && !Number.isNaN(r.apparent_power)) {
    const pct = (r.apparent_power / ratedVa) * 100;
    if (pct > 125) worst = "critical";
    else if (pct > 100 && worst === "normal") worst = "warning";
  }
  if (r.power_factor != null && !Number.isNaN(r.power_factor)) {
    if (r.power_factor < 0.7) worst = "critical";
    else if (r.power_factor < 0.85 && worst === "normal") worst = "warning";
  }
  if (r.frequency != null && !Number.isNaN(r.frequency)) {
    const diff = Math.abs(r.frequency - nominalF);
    if (diff > 2) worst = "critical";
    else if (diff > 1 && worst === "normal") worst = "warning";
  }
  return worst;
}

// ---------- helpers identical to LoadByHourChart ----------
function bucketByHour(readings: Reading[]) {
  const buckets = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, loadKva: 0, count: 0 }));
  for (const r of readings) {
    const ap = r.apparent_power;
    if (ap == null || Number.isNaN(ap)) continue;
    const idx = new Date(r.timestamp).getHours();
    buckets[idx].loadKva += ap / 1000;
    buckets[idx].count += 1;
  }
  for (const b of buckets) { if (b.count > 0) b.loadKva = b.loadKva / b.count; }
  return buckets;
}

// ---------- helpers identical to LoadHeatmap ----------
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function buildHeatmap(readings: Reading[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const count: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of readings) {
    const ap = r.apparent_power;
    if (ap == null || Number.isNaN(ap)) continue;
    const d = new Date(r.timestamp);
    grid[d.getDay()][d.getHours()] += ap / 1000;
    count[d.getDay()][d.getHours()] += 1;
  }
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 24; j++)
      if (count[i][j] > 0) grid[i][j] = grid[i][j] / count[i][j];
  return grid;
}

// ---------- summary stats ----------
function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null && !Number.isNaN(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function fmt(v: number | null, dec = 2): string {
  return v != null ? v.toFixed(dec) : "—";
}

interface PdfReportViewProps {
  readings: Reading[];
  alerts: Alert[];
  transformer: Transformer | null;
  filterLabel?: string;
}

const CONDITION_COLORS: Record<ConditionLevel, string> = {
  normal: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const DIVIDER: React.CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  margin: "20px 0 16px",
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 14,
};

const STAT_BOX: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 14px",
  flex: "1 1 120px",
};

export function PdfReportView({ readings, alerts, transformer, filterLabel }: PdfReportViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const donutData = useMemo(() => {
    const c = { normal: 0, warning: 0, critical: 0 };
    for (const r of readings) c[classifyReading(r, transformer)] += 1;
    return [
      { name: "Normal", value: c.normal, level: "normal" as const },
      { name: "Warning", value: c.warning, level: "warning" as const },
      { name: "Critical", value: c.critical, level: "critical" as const },
    ].filter((d) => d.value > 0);
  }, [readings, transformer]);

  const byHour = useMemo(() => bucketByHour(readings), [readings]);
  const heatmap = useMemo(() => buildHeatmap(readings), [readings]);
  const maxHeat = useMemo(() => {
    let m = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 24; j++) if (heatmap[i][j] > m) m = heatmap[i][j];
    return m || 1;
  }, [heatmap]);

  const stats = useMemo(() => ({
    avgV: avg(readings.map((r) => r.voltage)),
    avgA: avg(readings.map((r) => r.current)),
    avgPf: avg(readings.map((r) => r.power_factor)),
    avgKva: avg(readings.map((r) => r.apparent_power != null ? r.apparent_power / 1000 : null)),
    peakKva: readings.reduce((m, r) => r.apparent_power != null ? Math.max(m, r.apparent_power / 1000) : m, 0),
    avgLoad: avg(readings.map((r) => r.loading_percent)),
  }), [readings]);

  const unacked = alerts.filter((a) => !a.acknowledged).length;
  const generated = new Date().toLocaleString();

  const handleGenerate = useCallback(async () => {
    if (!containerRef.current) return;
    setGenerating(true);
    try {
      const name = transformer?.name ?? "transformer";
      const safeDate = new Date().toISOString().slice(0, 10);
      await generateTransformerReport(
        containerRef.current,
        `${name.replace(/\s+/g, "_")}_report_${safeDate}.pdf`,
      );
    } finally {
      setGenerating(false);
    }
  }, [transformer]);

  return (
    <>
      {/* Trigger button — rendered inline in the Reports toolbar */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || readings.length === 0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 6,
          border: "1px solid #cbd5e1",
          background: generating ? "#f1f5f9" : "#ffffff",
          color: readings.length === 0 ? "#94a3b8" : "#0f172a",
          cursor: readings.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ width: 14, height: 14 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        {generating ? "Generating PDF…" : "Download PDF Report"}
      </button>

      {/* ── Off-screen capture target ──────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          width: 900,
          background: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "32px 40px",
          color: "#0f172a",
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        {/* ── Cover ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                {transformer?.name ?? "Transformer"} — Report
              </div>
              {transformer && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Serial: {transformer.serial} &nbsp;·&nbsp; Site: {transformer.site ?? "—"} &nbsp;·&nbsp;
                  Rated: {transformer.rated_kva} kVA
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8" }}>
              <div>Generated: {generated}</div>
              {filterLabel && <div style={{ marginTop: 2 }}>Period: {filterLabel}</div>}
            </div>
          </div>
        </div>

        <div style={DIVIDER} />

        {/* ── Summary stats ─────────────────────────────────────────── */}
        <div style={SECTION_TITLE}>Summary</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Readings", value: readings.length.toString() },
            { label: "Alerts", value: alerts.length.toString() },
            { label: "Unacknowledged", value: unacked.toString() },
            { label: "Avg Voltage", value: `${fmt(stats.avgV, 1)} V` },
            { label: "Avg Current", value: `${fmt(stats.avgA, 1)} A` },
            { label: "Avg Power Factor", value: fmt(stats.avgPf) },
            { label: "Avg Load", value: `${fmt(stats.avgKva, 1)} kVA` },
            { label: "Peak Load", value: `${fmt(stats.peakKva, 1)} kVA` },
            { label: "Avg Loading", value: `${fmt(stats.avgLoad, 1)} %` },
          ].map(({ label, value }) => (
            <div key={label} style={STAT_BOX}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={DIVIDER} />

        {/* ── Condition distribution ─────────────────────────────────── */}
        <div style={SECTION_TITLE}>Condition Distribution (24h reading sample)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 20 }}>
          <div style={{ width: 180, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" isAnimationActive={false}>
                  {donutData.map((d) => (
                    <Cell key={d.level} fill={CONDITION_COLORS[d.level]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {donutData.map((d) => (
              <div key={d.level} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: CONDITION_COLORS[d.level] }} />
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span style={{ color: "#64748b" }}>
                  {d.value} reading{d.value !== 1 ? "s" : ""} ({Math.round((d.value / readings.length) * 100)}%)
                </span>
              </div>
            ))}
            {donutData.length === 0 && (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>No readings in sample</span>
            )}
          </div>
        </div>

        <div style={DIVIDER} />

        {/* ── All metric trend charts ────────────────────────────────── */}
        <div style={SECTION_TITLE}>Electrical Parameter Trends</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <StaticMetricChart readings={readings} dataKey="voltage" title="Voltage" unit="V" color="#0369a1" yDomain={[0, "auto"]} />
          <StaticMetricChart readings={readings} dataKey="current" title="Current" unit="A" color="#0d9488" yDomain={[0, "auto"]} />
          <StaticMetricChart readings={readings} dataKey="apparent_power" title="Apparent Power" unit="VA" color="#8b5cf6" yDomain={[0, "auto"]} />
          <StaticMetricChart readings={readings} dataKey="real_power" title="Real Power" unit="W" color="#f59e0b" yDomain={[0, "auto"]} />
          <StaticMetricChart readings={readings} dataKey="power_factor" title="Power Factor" unit="" color="#10b981" yDomain={[0, 1]} />
          <StaticMetricChart readings={readings} dataKey="frequency" title="Frequency" unit="Hz" color="#3b82f6" yDomain={[0, "auto"]} />
          <div style={{ gridColumn: "1 / -1" }}>
            <StaticMetricChart readings={readings} dataKey="energy_kwh" title="Energy" unit="kWh" color="#ef4444" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <StaticMetricChart readings={readings} dataKey="loading_percent" title="Loading" unit="%" color="#f97316" yDomain={[0, "auto"]} />
          </div>
        </div>

        <div style={DIVIDER} />

        {/* ── Load by hour bar chart ─────────────────────────────────── */}
        <div style={SECTION_TITLE}>Average Load by Hour (kVA)</div>
        <div style={{ height: 200, marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byHour} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
              <Tooltip formatter={(v) => [typeof v === "number" ? `${v.toFixed(2)} kVA` : v, "Avg Load"]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar dataKey="loadKva" name="Avg Load (kVA)" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={DIVIDER} />

        {/* ── Load heatmap ───────────────────────────────────────────── */}
        <div style={SECTION_TITLE}>Load Heatmap (avg kVA — day × hour)</div>
        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "36px repeat(24, 1fr)", gap: 2, minWidth: 600 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: 8, color: "#94a3b8", textAlign: "center" }}>{h}</div>
            ))}
            {DAYS_SHORT.map((day, di) => (
              <>
                <div key={`day-${day}`} style={{ fontSize: 9, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center" }}>{day}</div>
                {Array.from({ length: 24 }, (_, hi) => {
                  const val = heatmap[di][hi];
                  const opacity = val > 0 ? 0.15 + (val / maxHeat) * 0.85 : 0.05;
                  return (
                    <div key={`${di}-${hi}`}
                      title={`${day} ${hi}:00 — ${val.toFixed(1)} kVA`}
                      style={{
                        height: 14,
                        borderRadius: 2,
                        background: `rgba(99, 102, 241, ${opacity})`,
                      }}
                    />
                  );
                })}
              </>
            ))}
          </div>
        </div>

        <div style={DIVIDER} />

        {/* ── Alerts table ───────────────────────────────────────────── */}
        <div style={SECTION_TITLE}>Alerts ({alerts.length})</div>
        {alerts.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 12 }}>No alerts for this period.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Time", "Condition", "Message", "Voltage (V)", "Current (A)", "Load (kVA)", "Oil Temp (°C)", "SMS Sent", "Ack"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "#64748b", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 200).map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#ffffff", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{new Date(a.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "4px 8px", fontWeight: 600 }}>{a.condition.replace(/_/g, " ")}</td>
                  <td style={{ padding: "4px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message}</td>
                  <td style={{ padding: "4px 8px" }}>{a.voltage != null ? a.voltage.toFixed(1) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{a.current != null ? a.current.toFixed(2) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{a.apparent_power != null ? (a.apparent_power / 1000).toFixed(2) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{a.oil_temp != null ? a.oil_temp.toFixed(1) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{a.sms_sent ? "Yes" : "No"}</td>
                  <td style={{ padding: "4px 8px" }}>{a.acknowledged ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {alerts.length > 200 && (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>
            Showing first 200 of {alerts.length} alerts. Download CSV for full dataset.
          </p>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, borderTop: "1px solid #e2e8f0", paddingTop: 12, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
          PoleTransMonitor · Generated {generated}
        </div>
      </div>
    </>
  );
}
