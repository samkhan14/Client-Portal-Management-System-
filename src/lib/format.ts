import { Prisma } from "@prisma/client";

export function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function parseUtcDate(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Enter dates as YYYY-MM-DD.");
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

export function dateInput(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function formatWhen(value: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hourCycle: "h23",
    }).format(value) + " UTC"
  );
}

export function moneyToString(value: Prisma.Decimal | number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(num)) return null;
  return num.toFixed(2);
}

export function formatMoney(value: Prisma.Decimal | number | string | null | undefined): string {
  const raw = moneyToString(value);
  if (raw === null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "USD" }).format(Number(raw));
}

export function parseMoney(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Enter an amount with up to two decimal places.");
  }
  return Number(raw).toFixed(2);
}

export function pageOf(raw: string | undefined, pageSize = 20) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(raw || "1", 10) || 1));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function safeInternalPath(link: string | null | undefined): string | null {
  if (!link) return null;
  if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return null;
  return link.slice(0, 400);
}
