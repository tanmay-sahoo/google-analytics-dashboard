import { addDays } from "./time";

export type MetricPayload = {
  date: Date;
  ga4: { sessions: number; users: number; conversions: number; revenue: number };
  ads: { spend: number; clicks: number; impressions: number; roas: number };
};

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

export function generateMetrics(days: number): MetricPayload[] {
  const today = new Date();
  const start = addDays(today, -days + 1);
  const data: MetricPayload[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = addDays(start, i);
    const sessions = rand(1800, 5200);
    const users = Math.round(sessions * 0.7);
    const conversions = rand(40, 160);
    const revenue = Number((conversions * rand(20, 65)).toFixed(2));
    const spend = Number(rand(600, 1800).toFixed(2));
    const clicks = rand(120, 520);
    const impressions = rand(6000, 22000);
    const roas = Number((revenue / Math.max(spend, 1)).toFixed(2));

    data.push({
      date,
      ga4: { sessions, users, conversions, revenue },
      ads: { spend, clicks, impressions, roas }
    });
  }

  return data;
}
