import type { ItemSummary } from "@/lib/types";

export { cn } from "@/lib/cn";

export type GreetingKey =
  | "greetingMorning"
  | "greetingNoon"
  | "greetingAfternoon"
  | "greetingEvening"
  | "greetingNight";

export function getGreetingKey(): GreetingKey {
  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

  if (minutesSinceMidnight >= 6 * 60 && minutesSinceMidnight < 12 * 60) {
    return "greetingMorning";
  }
  if (minutesSinceMidnight >= 12 * 60 && minutesSinceMidnight < 12 * 60 + 30) {
    return "greetingNoon";
  }
  if (minutesSinceMidnight >= 12 * 60 + 30 && minutesSinceMidnight < 18 * 60 + 30) {
    return "greetingAfternoon";
  }
  if (minutesSinceMidnight >= 18 * 60 + 30) {
    return "greetingEvening";
  }
  return "greetingNight";
}

export function formatUpdatedAt(timestamp: string | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function sortByPublishedAt(items: ItemSummary[]): ItemSummary[] {
  return [...items].sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime());
}
