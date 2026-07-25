// Shared, realistic sample data for all three Analytics design variants.
// One week of delivery driving (Jul 19–25, 2026) for a multi-app driver.

export interface DayStat {
  label: string; // "Sun".."Sat"
  date: string; // "Jul 19"
  net: number;
  revenue: number;
  expenses: number;
  miles: number;
  hours: number;
  orders: number;
}

export interface PlatformStat {
  name: string;
  color: string;
  net: number;
  orders: number;
}

export const PERIOD_LABEL = "This Week";

export const days: DayStat[] = [
  { label: "Sun", date: "Jul 19", net: 41.2, revenue: 52.4, expenses: 11.2, miles: 28.4, hours: 2.5, orders: 6 },
  { label: "Mon", date: "Jul 20", net: 63.75, revenue: 71.25, expenses: 7.5, miles: 41.2, hours: 3.5, orders: 9 },
  { label: "Tue", date: "Jul 21", net: 0, revenue: 0, expenses: 0, miles: 0, hours: 0, orders: 0 },
  { label: "Wed", date: "Jul 22", net: 88.1, revenue: 96.6, expenses: 8.5, miles: 52.8, hours: 4.5, orders: 12 },
  { label: "Thu", date: "Jul 23", net: 54.3, revenue: 98.3, expenses: 44.0, miles: 46.1, hours: 4.0, orders: 11 },
  { label: "Fri", date: "Jul 24", net: 102.45, revenue: 112.95, expenses: 10.5, miles: 58.6, hours: 5.0, orders: 14 },
  { label: "Sat", date: "Jul 25", net: 62.2, revenue: 67.2, expenses: 5.0, miles: 31.9, hours: 3.0, orders: 8 },
];

export const totals = (() => {
  const t = days.reduce(
    (a, d) => ({
      net: a.net + d.net,
      revenue: a.revenue + d.revenue,
      expenses: a.expenses + d.expenses,
      miles: a.miles + d.miles,
      hours: a.hours + d.hours,
      orders: a.orders + d.orders,
    }),
    { net: 0, revenue: 0, expenses: 0, miles: 0, hours: 0, orders: 0 },
  );
  const activeDays = days.filter((d) => d.revenue > 0).length;
  return {
    ...t,
    activeDays,
    hourly: t.net / t.hours, // ≈ $18.35/hr
    perMile: t.net / t.miles, // ≈ $1.59/mi
    avgOrder: t.revenue / t.orders, // ≈ $8.32
    avgPerDay: t.net / activeDays,
  };
})();

// Week-over-week comparison (last week's net was $349.60 → up ~18%)
export const lastWeekNet = 349.6;
export const wowChangePct = ((totals.net - lastWeekNet) / lastWeekNet) * 100; // ≈ +18%

export const platforms: PlatformStat[] = [
  { name: "DoorDash", color: "#ef4444", net: 168.4, orders: 24 },
  { name: "UberEats", color: "#22c55e", net: 112.3, orders: 17 },
  { name: "Instacart", color: "#84cc16", net: 78.6, orders: 11 },
  { name: "GrubHub", color: "#f97316", net: 52.7, orders: 8 },
];

export const expensesByCategory = [
  { name: "Gas", emoji: "⛽", amount: 46.7 },
  { name: "Maintenance", emoji: "🔧", amount: 24.0 },
  { name: "Food", emoji: "🍔", amount: 11.0 },
  { name: "Other", emoji: "📦", amount: 5.0 },
];

// Gross earnings by hour of day (24 buckets) — dinner rush dominant.
export const hourlyEarnings = [
  0, 0, 0, 0, 0, 0, 0, 4.5, 9.2, 12.4, 18.6, 34.2, 42.8, 28.4, 14.2, 10.8,
  22.4, 48.6, 62.3, 55.1, 38.2, 22.6, 12.1, 4.3,
];

export const peakHourLabel = "6–7 PM";

// 5 weeks of weekly nets for longer trend lines
export const weeklyTrend = [286.4, 305.1, 322.8, 349.6, totals.net];

// last 28 days of daily net (for heatmap variants), 4 rows x 7 cols, oldest first
export const last28Days = [
  32.4, 51.2, 0, 44.6, 61.8, 88.2, 47.1,
  0, 58.4, 43.2, 71.5, 39.8, 95.4, 52.6,
  38.2, 0, 66.4, 49.8, 58.2, 108.6, 41.4,
  41.2, 63.75, 0, 88.1, 54.3, 102.45, 62.2,
];

export const money = (n: number, dp = 2) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(dp)}`;
