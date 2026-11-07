import { describe, expect, it } from "vitest";
import { reviewResetLabel } from "./review-quota";

describe("review reset label", () => {
  const now = Date.parse("2026-11-07T03:00:00Z"); // 12:00 in Seoul
  it("shows a same-day reset as a 24-hour clock time", () => {
    expect(reviewResetLabel("2026-11-07T05:05:00Z", now, "Asia/Seoul")).toBe("14:05");
  });
  it("marks a reset after midnight as tomorrow", () => {
    expect(reviewResetLabel("2026-11-08T00:30:00Z", now, "Asia/Seoul")).toBe("내일 09:30");
  });
  it("returns null when the reset time is unknown", () => {
    expect(reviewResetLabel(null, now)).toBeNull();
    expect(reviewResetLabel("not a date", now)).toBeNull();
  });
});
