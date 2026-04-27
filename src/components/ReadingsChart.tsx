import { SingleMetricChart } from "./SingleMetricChart";
import type { Alert } from "../types";

interface ChartProps {
  transformerId: number | null;
  alerts?: Alert[];
}

export function VoltageChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Voltage"
      dataKey="voltage"
      unit="V"
      color="#0369a1"
      validRange={{ min: 0, max: 500 }}
      alerts={alerts}
    />
  );
}

export function CurrentChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Current"
      dataKey="current"
      unit="A"
      color="#0d9488"
      validRange={{ min: 0, max: 500 }}
      alerts={alerts}
    />
  );
}

export function ApparentPowerChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Apparent Power"
      dataKey="apparent_power"
      unit="VA"
      color="#8b5cf6"
      validRange={{ min: 0, max: 1_000_000 }}
      alerts={alerts}
    />
  );
}

export function RealPowerChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Real Power"
      dataKey="real_power"
      unit="W"
      color="#f59e0b"
      validRange={{ min: 0, max: 1_000_000 }}
      alerts={alerts}
    />
  );
}

export function PowerFactorChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Power Factor"
      dataKey="power_factor"
      unit=""
      color="#10b981"
      yDomain={[0, 1]}
      validRange={{ min: 0, max: 1 }}
      alerts={alerts}
    />
  );
}

export function FrequencyChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Frequency"
      dataKey="frequency"
      unit="Hz"
      color="#3b82f6"
      validRange={{ min: 0, max: 100 }}
      alerts={alerts}
    />
  );
}

export function EnergyChart({ transformerId, alerts }: ChartProps) {
  return (
    <SingleMetricChart
      transformerId={transformerId}
      title="Energy"
      dataKey="energy_kwh"
      unit="kWh"
      color="#ef4444"
      alerts={alerts}
    />
  );
}
