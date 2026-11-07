/** When the AI review allowance frees up again, as a short local time ("14:05" or "내일 09:30").
 * The allowance counts 24 hours from its first use, so the reset is never more than a day away. */
export function reviewResetLabel(resetsAt: string | null, now = Date.now(), timeZone?: string) {
  const reset = resetsAt ? Date.parse(resetsAt) : NaN;
  if (!Number.isFinite(reset)) return null;
  const options = { timeZone } as const;
  const time = new Intl.DateTimeFormat("ko-KR", {
    ...options,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(reset);
  const day = (value: number) =>
    new Intl.DateTimeFormat("en-CA", { ...options, dateStyle: "short" }).format(value);
  return day(reset) === day(now) ? time : `내일 ${time}`;
}
