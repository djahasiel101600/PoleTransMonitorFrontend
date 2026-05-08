import { useEffect, useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchConditionDistribution } from "../api/client";
import type { ConditionDistributionResponse } from "../api/client";
import type { Transformer } from "../types";

type ConditionLevel = "normal" | "warning" | "critical";

const COLORS: Record<ConditionLevel, string> = {
  normal: "var(--color-primary)",
  warning: "var(--color-warning)",
  critical: "var(--color-critical)",
};

export function ConditionDonut({
  transformerId,
  // transformer prop kept for API compatibility; classification is now server-side
  transformer: _transformer,
}: {
  transformerId: number | null;
  transformer: Transformer | null;
}) {
  const [distribution, setDistribution] =
    useState<ConditionDistributionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transformerId == null) return;
    queueMicrotask(() => setLoading(true));
    fetchConditionDistribution(transformerId, 24)
      .then((res) => setDistribution(res))
      .catch((e) => console.error("ConditionDonut:", e))
      .finally(() => setLoading(false));
  }, [transformerId]);

  const data = useMemo(() => {
    if (!distribution) return [];
    return [
      { name: "Normal", value: distribution.counts.normal, level: "normal" as const },
      { name: "Warning", value: distribution.counts.warning, level: "warning" as const },
      { name: "Critical", value: distribution.counts.critical, level: "critical" as const },
    ].filter((d) => d.value > 0);
  }, [distribution]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(12rem,28vh,16rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="border-border/80 shadow-none overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Condition (24h)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Share of readings in Normal / Warning / Critical
        </p>
      </CardHeader>
      <CardContent className="overflow-hidden">
        {total === 0 ? (
          <div className="flex h-[clamp(12rem,28vh,16rem)] items-center justify-center text-sm text-muted-foreground">
            No readings in the last 24h
          </div>
        ) : (
          <div className="h-[clamp(12rem,28vh,16rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  isAnimationActive={false}
                  labelLine={false}
                  // Position labels inside the donut so they don't get clipped.
                  label={(props) => {
                    const {
                      cx,
                      cy,
                      innerRadius,
                      outerRadius,
                      midAngle,
                      value,
                    } = props as {
                      cx: number;
                      cy: number;
                      innerRadius: number;
                      outerRadius: number;
                      midAngle: number;
                      value: number;
                    };

                    if (value <= 0) return null;
                    const percent = (value / total) * 100;

                    // Slightly tighter for small slices so "1%" stays visible.
                    const radius =
                      innerRadius +
                      (outerRadius - innerRadius) * (percent < 5 ? 0.38 : 0.45);
                    const RAD = Math.PI / 180;
                    const x = cx + radius * Math.cos(-midAngle * RAD);
                    const y = cy + radius * Math.sin(-midAngle * RAD);
                    const textAnchor = x >= cx ? "start" : "end";
                    const fontSize = percent < 5 ? 10 : 11;

                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        style={{ fill: "var(--color-foreground)", fontSize }}
                        pointerEvents="none"
                      >
                        {percent.toFixed(0)}%
                      </text>
                    );
                  }}
                >
                  {data.map((entry) => (
                    <Cell key={entry.level} fill={COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : 0;
                    return [
                      `${v} (${((v / total) * 100).toFixed(1)}%)`,
                      "Readings",
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
