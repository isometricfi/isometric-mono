import { addDays, addHours, startOfHour } from "date-fns";

export function estimateExpiryDate(termDays: number, now: Date = new Date()): Date {
  const roundedStart = addHours(startOfHour(now), 1);
  return addDays(roundedStart, termDays);
}
