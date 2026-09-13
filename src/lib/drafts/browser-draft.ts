import type { DraftRecord } from "./draft-controller";

function parse(raw: string | null): DraftRecord | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value.code !== "string" || value.code.length > 30000) return null;
    return {
      code: value.code,
      baseRevision:
        Number.isSafeInteger(value.baseRevision) && value.baseRevision >= 0
          ? value.baseRevision
          : null,
    };
  } catch {
    return null;
  }
}
/** Each editor gets its own key, including tabs cloned with sessionStorage. */
export function browserDraft(scope: string, id: string) {
  let onError: (message: string) => void = () => {};
  const prefix = `codefit-draft:${scope}:${id}`;
  const key = `${prefix}:${crypto.randomUUID()}`;
  let recoveredKey: string | null = null;
  let recoveredRecord: DraftRecord | null = null;
  let lastStoredCode: string | null = null;
  return {
    setErrorHandler(handler: (message: string) => void) {
      onError = handler;
    },
    read() {
      try {
        recoveredKey = sessionStorage.getItem(prefix);
        const local = recoveredKey && parse(localStorage.getItem(recoveredKey));
        if (local) {
          recoveredRecord = local;
          return local;
        }
        recoveredKey = prefix;
        const legacy = parse(localStorage.getItem(prefix));
        if (legacy) {
          recoveredRecord = legacy;
          return legacy;
        }
        if (scope.startsWith("guest:")) {
          recoveredKey = `recode-draft:${id}`;
          recoveredRecord = parse(localStorage.getItem(recoveredKey));
          return recoveredRecord;
        }
      } catch {
        onError("브라우저 초안을 읽을 수 없습니다. 저장 공간 설정을 확인해 주세요.");
      }
      return null;
    },
    write(record: DraftRecord | null) {
      try {
        if (record) {
          localStorage.setItem(key, JSON.stringify(record));
          lastStoredCode = record.code;
          sessionStorage.setItem(prefix, key);
        } else {
          localStorage.removeItem(key);
          if (sessionStorage.getItem(prefix) === key) sessionStorage.removeItem(prefix);
        }
        // A cloned tab may still be editing the recovered key. Never delete it while copying.
        // Retain it unless the exact recovered bytes were acknowledged without subsequent edits.
        if (!record && recoveredKey && recoveredRecord && lastStoredCode === recoveredRecord.code) {
          const existing = parse(localStorage.getItem(recoveredKey));
          if (
            existing?.code === recoveredRecord.code &&
            existing.baseRevision === recoveredRecord.baseRevision
          )
            localStorage.removeItem(recoveredKey);
          recoveredKey = null;
          recoveredRecord = null;
        }
        return true;
      } catch {
        onError("이 브라우저에 초안을 보관하지 못했습니다. 창을 닫기 전에 코드를 복사해 주세요.");
        return false;
      }
    },
    remaining() {
      try {
        return Object.keys(localStorage)
          .filter((k) => k.startsWith(`${prefix}:`) && k !== key)
          .flatMap((k) => {
            const record = parse(localStorage.getItem(k));
            return record ? [{ key: k, record }] : [];
          });
      } catch {
        return [];
      }
    },
  };
}
