/** Runs before body paint; keep the storage key aligned with ThemeProvider. */
export const themeInitScript = `(function(){var p='system';try{var v=localStorage.getItem('codefit-theme-v1');if(v==='light'||v==='dark')p=v}catch(e){}var r=document.documentElement;r.dataset.themePreference=p;r.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})();`;
