/**
 * Compute current streak (consecutive training days ending today or yesterday)
 * and longest streak from a list of distinct ISO date strings (YYYY-MM-DD).
 */
export function computeStreaks(dates: string[]): { current: number; longest: number; thisMonth: number } {
  if (dates.length === 0) return { current: 0, longest: 0, thisMonth: 0 };

  // Dedupe and sort ascending
  const days = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + "T00:00:00Z").getTime();
    const cur = new Date(days[i] + "T00:00:00Z").getTime();
    if ((cur - prev) / 86400000 === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current: count back from today / yesterday
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const set = new Set(days);
  let current = 0;
  const cursor = set.has(dateKey(today)) ? new Date(today) : set.has(dateKey(yesterday)) ? new Date(yesterday) : null;
  while (cursor && set.has(dateKey(cursor))) {
    current++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // This month count
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = days.filter((d) => d.startsWith(monthKey)).length;

  return { current, longest, thisMonth };
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
