import type { Fixture } from "@/src/types";

/** Accurate local kickoff time (from the ISO timestamp), with a display fallback. */
export function kickoffLabel(f: Fixture): string {
  if (f.kickoffAt) {
    return new Date(f.kickoffAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return f.kickoffTime;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DayGroup {
  key: string;
  label: string; // "Today" | "Tomorrow" | "Wed 2 Jul"
  fixtures: Fixture[];
}

/**
 * Groups fixtures into ordered day buckets: Today, Tomorrow, then each date.
 * Fixtures within a day are ordered by kickoff time. Undated fixtures go last.
 */
export function groupByDay(fixtures: Fixture[]): DayGroup[] {
  const now = new Date();
  const todayKey = localDayKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = localDayKey(tomorrow);

  const buckets = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const key = f.kickoffAt ? localDayKey(new Date(f.kickoffAt)) : "zzzz";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }

  return [...buckets.keys()]
    .sort()
    .map((key) => {
      const fx = buckets.get(key)!.sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
      let label: string;
      if (key === todayKey) label = "Today";
      else if (key === tomorrowKey) label = "Tomorrow";
      else if (key === "zzzz") label = "Scheduled";
      else {
        const d = fx[0].kickoffAt ? new Date(fx[0].kickoffAt) : now;
        label = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
      }
      return { key, label, fixtures: fx };
    });
}
