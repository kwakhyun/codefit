import { expect, it } from "vitest";
import { isPublicIPv4, pageText, publicUrl } from "./project-page";
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
