// Run locally with Vercel OIDC credentials; never copy application secrets into the VM.
import { Sandbox } from "@vercel/sandbox";
const sandbox = await Sandbox.create({ runtime: "node24", timeout: 300_000, persistent: false });
try {
  const packages = [
    "nss",
    "nspr",
    "libxkbcommon",
    "atk",
    "at-spi2-atk",
    "at-spi2-core",
    "libXcomposite",
    "libXdamage",
    "libXrandr",
    "libXfixes",
    "mesa-libgbm",
    "cups-libs",
    "alsa-lib",
    "pango",
    "cairo",
    "google-noto-sans-cjk-ttc-fonts",
  ];
  for (const command of [
    { cmd: "dnf", args: ["install", "-y", ...packages], sudo: true },
    { cmd: "npm", args: ["install", "--prefix", "/vercel/sandbox", "playwright@1.63.0"] },
    { cmd: "/vercel/sandbox/node_modules/.bin/playwright", args: ["install", "chromium"] },
    {
      cmd: "node",
      args: [
        "-e",
        "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--no-sandbox']});await b.close()})()",
      ],
    },
  ]) {
    const result = await sandbox.runCommand(command);
    if (result.exitCode !== 0) throw new Error(await result.stderr());
    console.log(`Completed: ${command.cmd}`);
  }
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  console.log(`PROJECT_BROWSER_SNAPSHOT_ID=${snapshot.snapshotId}`);
} finally {
  await sandbox.stop();
}
