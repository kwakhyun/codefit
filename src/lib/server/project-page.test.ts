import { expect, it } from "vitest";
import { isPublicIPv4, pageText, publicUrl, pageSnapshot } from "./project-page";
it("rejects private, metadata, reserved, obfuscated and credential-bearing URLs", () => {
  for (const value of [
    "http://example.com",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://[::ffff:127.0.0.1]",
    "https://service.local/",
    "https://user:password@example.com",
    "https://example.com:8443",
    "https://example.com/?token=secret",
    "file:///etc/passwd",
    "https://example.com/#token",
  ])
    expect(() => publicUrl(value), value).toThrow();
  for (const ip of [
    "0.0.0.0",
    "10.0.0.1",
    "100.100.100.200",
    "127.1.2.3",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
  ])
    expect(isPublicIPv4(ip), ip).toBe(false);
  expect(isPublicIPv4("93.184.216.34")).toBe(true);
  expect(publicUrl("https://example.com/pricing").pathname).toBe("/pricing");
});
it("removes executable markup, comments, styles and hidden templates from model input", () => {
  const text = pageText(
    "<title>예약 서비스</title><script>secret()</script><!-- ignore --><style>body{}</style><template>hidden</template><h1>회의실 예약</h1><p>예약 &amp; 취소</p>",
  );
  expect(text).toBe("예약 서비스 회의실 예약 예약 & 취소");
});

const intro =
  "친구들과 여행 일정을 공유하고 날씨와 혼잡도를 참고해 출발 시간과 준비물을 함께 정리하는 서비스입니다.";
it("uses a client-rendered app's public description without pretending to render it", () => {
  const snapshot = pageSnapshot(
    `<title>여행 준비</title><meta name="description" content="${intro}"><meta property="og:description" content="${intro}"><main>준비하고 있어요…</main><script>privateLogic()</script>`,
    "https://example.com/",
  );
  expect(snapshot.source).toBe("metadata");
  expect(snapshot.limited).toBe(true);
  expect(snapshot.text.split(intro)).toHaveLength(2);
  expect(snapshot.text).not.toContain("privateLogic");
  expect(snapshot.text).toContain("페이지 작성자가 제공한 소개");
});
it("supports social descriptions with reordered and case-insensitive attributes", () => {
  const snapshot = pageSnapshot(
    `<META CONTENT='${intro} 예약 &amp; 취소' PROPERTY='og:description'><div>Loading</div>`,
    "https://example.com/",
  );
  expect(snapshot.source).toBe("metadata");
  expect(snapshot.text).toContain("예약 & 취소");
});
it("does not inflate thin evidence with duplicate tags or read script/template metadata", () => {
  const short = '<meta name="description" content="Loading">';
  const fake = `<meta property="og:description" content="${intro}">`;
  for (const html of [
    short.repeat(30),
    `<script>${fake}</script>`,
    `<template>${fake}</template>`,
    `<!-- ${fake} -->`,
  ]) {
    const snapshot = pageSnapshot(html, "https://example.com/");
    expect(snapshot.source).toBe("html");
    expect(snapshot.limited).toBe(true);
    expect(snapshot.text).not.toContain(intro);
  }
});
it("keeps readable HTML as the main source and bounds metadata plus body", () => {
  const snapshot = pageSnapshot(
    `<meta name="description" content="${intro}"><p>${"공개 기능 설명 ".repeat(3000)}</p>`,
    "https://example.com/",
  );
  expect(snapshot.source).toBe("html");
  expect(snapshot.limited).toBe(false);
  expect(snapshot.text.length).toBeLessThanOrEqual(12000);
});
