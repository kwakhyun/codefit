import { DOMAIN_IDS, LANGUAGES } from "@/lib/catalog";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span className="mono">CODE:FIT</span>
      <span>
        {DOMAIN_IDS.length}개 분야<span>/</span>
        {Object.keys(LANGUAGES).length}개 언어와 기술
      </span>
    </footer>
  );
}
