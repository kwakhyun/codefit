// One-shot hand-offs between workshop screens, kept per tab so a link or reload never starts paid work.
const START_KEY = "codefit-ai-workshop:start";
const GENERATE_KEY = "codefit-ai-workshop:generate";

function take(key: string, expected: string) {
  try {
    const value = sessionStorage.getItem(key);
    if (value === null) return false;
    sessionStorage.removeItem(key);
    return value === expected;
  } catch {
    return false;
  }
}
function remember(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

/** The learner confirmed the cost on the entry form; analyze this URL on arrival. */
export const requestWorkshopAnalysis = (url: string) => remember(START_KEY, url);
export const takeWorkshopAnalysis = (url: string) => take(START_KEY, url);
/** The confirmed analysis also covers the learning generation that follows it. */
export const requestWorkshopGeneration = (checkId: string) => remember(GENERATE_KEY, checkId);
export const takeWorkshopGeneration = (checkId: string) => take(GENERATE_KEY, checkId);
