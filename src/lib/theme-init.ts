/** Runs before body paint; keep the storage key aligned with ThemeProvider. */
export const themeInitScript = `(function(){var p='system';try{var v=localStorage.getItem('codefit-theme-v1');if(v==='light'||v==='dark')p=v}catch(e){}var r=document.documentElement;r.dataset.themePreference=p;r.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})();`;

/** The same steps for screens rendered on the client, where an inline script does not run. */
export function applyStoredTheme() {
  let preference = "system";
  try {
    const value = localStorage.getItem("codefit-theme-v1");
    if (value === "light" || value === "dark") preference = value;
  } catch {
    /* Blocked storage falls back to the system setting. */
  }
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme =
    preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
}
