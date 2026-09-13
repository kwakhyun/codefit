export const DOMAINS = [
  { id: "frontend", label: "프론트엔드", icon: "PanelTop", description: "화면과 사용자 경험", languages: ["typescript", "javascript", "tsx", "html", "css"] },
  { id: "backend", label: "백엔드", icon: "Server", description: "API와 서비스 로직", languages: ["python", "typescript", "javascript", "java", "go", "csharp", "php", "ruby", "kotlin", "rust"] },
  { id: "game", label: "게임 개발", icon: "Gamepad2", description: "게임 로직과 엔진", languages: ["csharp", "cpp", "javascript", "lua", "gdscript"] },
  { id: "network", label: "네트워크", icon: "Network", description: "프로토콜과 통신", languages: ["python", "go", "c", "cpp", "rust", "shell"] },
  { id: "database", label: "데이터베이스", icon: "Database", description: "쿼리와 데이터 모델링", languages: ["sql", "python", "javascript"] },
  { id: "infra", label: "인프라 / DevOps", icon: "Container", description: "배포와 운영 자동화", languages: ["dockerfile", "yaml", "shell", "hcl", "python", "go"] },
  { id: "mobile", label: "모바일", icon: "Smartphone", description: "앱과 모바일 인터랙션", languages: ["swift", "kotlin", "dart", "tsx"] },
  { id: "data", label: "데이터 / AI", icon: "BrainCircuit", description: "데이터 처리와 ML", languages: ["python", "sql", "r", "julia"] },
  { id: "security", label: "보안", icon: "ShieldCheck", description: "입력 검증과 안전한 설계", languages: ["python", "javascript", "go", "java", "rust", "shell"] },
  { id: "systems", label: "시스템 / 알고리즘", icon: "Cpu", description: "자료구조와 저수준 개발", languages: ["c", "cpp", "rust", "go", "python", "java", "typescript"] },
] as const;
export const DOMAIN_IDS = ["frontend", "backend", "game", "network", "database", "infra", "mobile", "data", "security", "systems"] as const;
export type DomainId = typeof DOMAIN_IDS[number];
export const LEVELS = ["하", "중", "상"] as const;
export const KINDS = ["implementation", "debugging", "refactoring"] as const;
export const KIND_LABELS = { implementation: "기능 구현", debugging: "오류 수정", refactoring: "리팩터링" } as const;
export const LANGUAGES = {
  javascript: { label: "JavaScript", ext: "js", monaco: "javascript" },
  typescript: { label: "TypeScript", ext: "ts", monaco: "typescript" },
  tsx: { label: "React / TSX", ext: "tsx", monaco: "typescript" },
  html: { label: "HTML", ext: "html", monaco: "html" },
  css: { label: "CSS", ext: "css", monaco: "css" },
  python: { label: "Python", ext: "py", monaco: "python" },
  java: { label: "Java", ext: "java", monaco: "java" },
  go: { label: "Go", ext: "go", monaco: "go" },
  csharp: { label: "C#", ext: "cs", monaco: "csharp" },
  cpp: { label: "C++", ext: "cpp", monaco: "cpp" },
  c: { label: "C", ext: "c", monaco: "c" },
  rust: { label: "Rust", ext: "rs", monaco: "rust" },
  php: { label: "PHP", ext: "php", monaco: "php" },
  ruby: { label: "Ruby", ext: "rb", monaco: "ruby" },
  kotlin: { label: "Kotlin", ext: "kt", monaco: "kotlin" },
  swift: { label: "Swift", ext: "swift", monaco: "swift" },
  dart: { label: "Dart", ext: "dart", monaco: "dart" },
  lua: { label: "Lua", ext: "lua", monaco: "lua" },
  gdscript: { label: "GDScript", ext: "gd", monaco: "python" },
  sql: { label: "SQL", ext: "sql", monaco: "sql" },
  shell: { label: "Shell", ext: "sh", monaco: "shell" },
  dockerfile: { label: "Dockerfile", ext: "dockerfile", monaco: "dockerfile" },
  yaml: { label: "YAML", ext: "yaml", monaco: "yaml" },
  hcl: { label: "Terraform / HCL", ext: "tf", monaco: "hcl" },
  r: { label: "R", ext: "r", monaco: "r" },
  julia: { label: "Julia", ext: "jl", monaco: "julia" },
} as const;
export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_IDS = Object.keys(LANGUAGES) as [Language, ...Language[]];
export const domainLabel = (id: DomainId) => DOMAINS.find(d => d.id === id)!.label;
export function supportsLanguage(domain: DomainId, language: Language) {
  return (DOMAINS.find(d => d.id === domain)!.languages as readonly string[]).includes(language);
}
