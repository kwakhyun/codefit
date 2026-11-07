import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";

// Downloaded at build time and served from this app; the browser never contacts Google.
// Noto Sans KR is a variable font: one file per character range covers every weight the CSS
// uses (400–800, including 450/550/650). Hangul ranges load on demand via unicode-range.
const sans = Noto_Sans_KR({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-kr",
});

// Static font: only the weights the stylesheets request (450 falls back to 400 as before).
const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

/** Put on <html> so the tokens on :root (--sans, --mono) can read the font variables. */
export const fontVariables = `${sans.variable} ${mono.variable}`;
