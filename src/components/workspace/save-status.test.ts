import { describe, expect, it } from "vitest";
import { saveAnnouncement } from "./save-status";

describe("save status announcements", () => {
  it("stays silent through routine autosave cycles", () => {
    for (const state of ["local", "saving", "saved"] as const)
      expect(saveAnnouncement(state, true, false)).toBeNull();
  });
  it("announces failures and offline storage", () => {
    expect(saveAnnouncement("failed", true, false)).toMatchObject({ failed: true });
    expect(saveAnnouncement("offline", true, false)?.text).toContain("오프라인");
    expect(saveAnnouncement("saved", false, false)?.text).toContain("브라우저 보관에 실패");
  });
  it("announces only the first save after a failure", () => {
    expect(saveAnnouncement("saving", true, true)).toBeNull();
    expect(saveAnnouncement("saved", true, true)).toEqual({
      text: "코드를 다시 저장했습니다.",
      failed: false,
    });
  });
});
