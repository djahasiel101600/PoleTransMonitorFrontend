import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import type { Condition } from "../types";

const ALL_CONDITIONS: { value: Condition; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "heavy_peak_load", label: "Heavy Peak Load" },
  { value: "danger_zone", label: "Danger Zone" },
  { value: "overload", label: "Overload" },
  { value: "severe_overload", label: "Severe Overload" },
  { value: "heavy_load", label: "Heavy Load" },
  { value: "abnormal", label: "Abnormal" },
  { value: "poor_power_quality", label: "Poor Power Quality" },
  { value: "critical", label: "Critical" },
];

const DATE_PRESETS: { label: string; hours: number }[] = [
  { label: "Last 1h", hours: 1 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
  { label: "Last 30d", hours: 720 },
  { label: "Last 90d", hours: 2160 },
];

export interface FilterValues {
  startDate: string;
  endDate: string;
  conditions: Condition[];
  voltageMin: string;
  voltageMax: string;
  currentMin: string;
  currentMax: string;
  pfMin: string;
  pfMax: string;
}

const EMPTY_FILTERS: FilterValues = {
  startDate: "",
  endDate: "",
  conditions: [],
  voltageMin: "",
  voltageMax: "",
  currentMin: "",
  currentMax: "",
  pfMin: "",
  pfMax: "",
};

export function ReportsFilters({
  onApply,
  loading,
}: {
  onApply: (filters: FilterValues) => void;
  loading: boolean;
}) {
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const set = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const toggleCondition = (c: Condition) =>
    setFilters((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(c)
        ? prev.conditions.filter((x) => x !== c)
        : [...prev.conditions, c],
    }));

  const applyPreset = (hours: number) => {
    const end = new Date();
    const start = new Date(Date.now() - hours * 60 * 60 * 1000);
    setActivePreset(hours);
    onApply({
      ...filters,
      startDate: toLocalDatetime(start),
      endDate: toLocalDatetime(end),
    });
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setActivePreset(null);
    onApply(EMPTY_FILTERS);
  };

  const activeFilterCount =
    (activePreset != null || filters.startDate || filters.endDate ? 1 : 0) +
    filters.conditions.length +
    (filters.voltageMin ? 1 : 0) +
    (filters.voltageMax ? 1 : 0) +
    (filters.currentMin ? 1 : 0) +
    (filters.currentMax ? 1 : 0) +
    (filters.pfMin ? 1 : 0) +
    (filters.pfMax ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Quick Select presets */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <Label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Select
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.hours}
              type="button"
              onClick={() => applyPreset(p.hours)}
              className={[
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activePreset === p.hours
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <Label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Custom Range
        </Label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label
              htmlFor="startDate"
              className="mb-1 block text-xs text-muted-foreground"
            >
              From
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <Label
              htmlFor="endDate"
              className="mb-1 block text-xs text-muted-foreground"
            >
              To
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Fill in the dates above then press{" "}
          <span className="font-medium text-foreground">Apply Filters</span>.
        </p>
      </div>

      {/* Condition filter */}
      <div>
        <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Condition
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CONDITIONS.map((c) => {
            const selected = filters.conditions.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleCondition(c.value)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
                  selected
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                ].join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced metric thresholds */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-3 w-3 transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Advanced Filters
        </button>

        {showAdvanced && (
          <div className="mt-3 animate-fade-in rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ThresholdPair
                label="Voltage (V)"
                minVal={filters.voltageMin}
                maxVal={filters.voltageMax}
                onMin={(v) => set("voltageMin", v)}
                onMax={(v) => set("voltageMax", v)}
              />
              <ThresholdPair
                label="Current (A)"
                minVal={filters.currentMin}
                maxVal={filters.currentMax}
                onMin={(v) => set("currentMin", v)}
                onMax={(v) => set("currentMax", v)}
              />
              <ThresholdPair
                label="Power Factor"
                minVal={filters.pfMin}
                maxVal={filters.pfMax}
                onMin={(v) => set("pfMin", v)}
                onMax={(v) => set("pfMax", v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border/60 pt-4">
        <Button
          type="button"
          size="sm"
          disabled={loading}
          onClick={() => {
            setActivePreset(null);
            onApply(filters);
          }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading...
            </span>
          ) : (
            "Apply Filters"
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          Reset
        </Button>
        {activeFilterCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
            active
          </span>
        )}
      </div>
    </div>
  );
}

function ThresholdPair({
  label,
  minVal,
  maxVal,
  onMin,
  onMax,
}: {
  label: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={minVal}
          onChange={(e) => onMin(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          type="number"
          placeholder="Max"
          value={maxVal}
          onChange={(e) => onMax(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
