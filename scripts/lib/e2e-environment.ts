/** Browser tests have their own port; never replace the user's preview on 3010. */
export const E2E_BASE_URL = process.env.CODEFIT_E2E_BASE_URL || "http://127.0.0.1:3012";
const url = new URL(E2E_BASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol !== "http:")
  throw new Error("E2E tests must use an isolated local server");
export const E2E_PORT = url.port || "80";
export const E2E_HOST = url.hostname;
