import { Fragment, useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchLoadHeatmap } from "../api/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function LoadHeatmap({
  transformerId,
}: {
  transformerId: number | null;
}) {
  const [grid, setGrid] = useState<number[][]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transformerId == null) return;
    void Promise.resolve().then(() => setLoading(true));
    fetchLoadHeatmap(transformerId)
      .then((res) => setGrid(res.grid))
      .catch((e) => console.error("LoadHeatmap:", e))
      .finally(() => setLoading(false));
  }, [transformerId]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (let i = 0; i < grid.length; i++)
      for (let j = 0; j < (grid[i]?.length ?? 0); j++)
        if (grid[i][j] > m) m = grid[i][j];
    return m || 1;
  }, [grid]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-lg sm:h-80" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Load heatmap (7 days)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Day × hour · color = avg load (kVA)
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-2 text-xs text-muted-foreground md:hidden">
          Scroll right to see all hours →
        </p>
        {/*
          Full-width heatmap: day column + 24 equal fractional columns so cells grow with the card.
          Horizontal scroll on very narrow viewports so labels stay readable.
        */}
        <div className="w-full min-w-0 overflow-x-auto">
          <div className="w-full max-w-full">
            <div className="grid grid-cols-[minmax(2.5rem,auto)_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-stretch sm:gap-x-3 sm:gap-y-2">
              <div className="pr-0.5" aria-hidden />
              <div className="grid w-full min-w-0 grid-cols-[repeat(24,minmax(0,1fr))] gap-x-0.5 sm:gap-x-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="truncate text-center text-[10px] font-medium tabular-nums text-muted-foreground sm:text-xs"
                  >
                    {h}
                  </span>
                ))}
              </div>
              {DAYS.map((day, i) => (
                <Fragment key={day}>
                  <span className="self-center text-right text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                    {day}
                  </span>
                  <div className="grid min-h-0 w-full grid-cols-[repeat(24,minmax(0,1fr))] gap-x-0.5 sm:gap-x-1">
                    {grid[i].map((v, j) => (
                      <div
                        key={j}
                        className="min-h-7 w-full min-w-0 rounded-sm transition-colors sm:min-h-10 sm:rounded-md"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          opacity:
                            maxVal > 0 ? 0.15 + 0.85 * (v / maxVal) : 0.15,
                        }}
                        title={`${day} ${j}:00 — ${v.toFixed(2)} kVA`}
                      />
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground sm:text-sm">
              <span>Low</span>
              <div className="flex gap-0.5 sm:gap-1">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <div
                    key={f}
                    className="h-3 w-5 rounded-sm sm:h-3.5 sm:w-6"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      opacity: f * 0.85 + 0.15,
                    }}
                  />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
