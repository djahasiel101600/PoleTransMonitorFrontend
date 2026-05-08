import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchLoadByHour } from "../api/client";
import type { LoadByHourResponse } from "../api/client";

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 8 };

type Period = "24h" | "7d";
type LoadPoint = LoadByHourResponse["data"][number];

export function LoadByHourChart({
  transformerId,
}: {
  transformerId: number | null;
}) {
  const [data, setData] = useState<LoadPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("24h");

  useEffect(() => {
    if (transformerId == null) return;
    queueMicrotask(() => setLoading(true));
    fetchLoadByHour(transformerId, period)
      .then((res) => setData(res.data))
      .catch((e) => console.error("LoadByHourChart:", e))
      .finally(() => setLoading(false));
  }, [transformerId, period]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(10rem,35vh,18rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.loadKva > 0);

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Load by {period === "24h" ? "hour" : "day"}
        </CardTitle>
        <div className="flex gap-0.5 rounded-md border border-border/80 p-0.5">
          <button
            type="button"
            onClick={() => setPeriod("24h")}
            className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "24h" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            24h
          </button>
          <button
            type="button"
            onClick={() => setPeriod("7d")}
            className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "7d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            7d
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[clamp(10rem,35vh,18rem)] items-center justify-center text-sm text-muted-foreground">
            No load data for this period
          </div>
        ) : (
          <div className="h-[clamp(10rem,35vh,18rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey={period === "24h" ? "hour" : "day"}
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickFormatter={(v) => `${v} kVA`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : 0;
                    return [`${v.toFixed(2)} kVA`, "Avg load"];
                  }}
                  labelFormatter={(label) =>
                    period === "24h" ? `Hour ${label}` : label
                  }
                />
                <Bar
                  dataKey="loadKva"
                  name="Load (kVA)"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
