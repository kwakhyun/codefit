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
// An open editor holds a Web Lock named after its key; the browser drops it when the tab closes.
const lockManager = () =>
  typeof navigator !== "undefined" && navigator.locks ? navigator.locks : null;
async function heldKeys() {
  const locks = lockManager();
  if (!locks) return null;
  try {
    const state = await locks.query();
    return new Set([...(state.held ?? []), ...(state.pending ?? [])].map((l) => l.name));
  } catch {
    return null;
  }
}
/** `live` is null where the browser cannot tell whether another open tab owns the draft. */
export type StoredDraft = { key: string; record: DraftRecord; live: boolean | null };
/** Each editor gets its own key, including tabs cloned with sessionStorage. */
export function browserDraft(scope: string, id: string) {
  let onError: (message: string) => void = () => {};
  const prefix = `codefit-draft:${scope}:${id}`;
  const key = `${prefix}:${crypto.randomUUID()}`;
  let recoveredKey: string | null = null;
  let recoveredRecord: DraftRecord | null = null;
  let lastStoredCode: string | null = null;
  let release: (() => void) | null = null;
  return {
    setErrorHandler(handler: (message: string) => void) {
      onError = handler;
    },
    /** Mark this editor as open for as long as it is mounted. */
    claim() {
      const locks = lockManager();
      if (!locks || release) return;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.request(key, () => held).catch(() => {});
    },
    release() {
      release?.();
      release = null;
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
        if (!record && recoveredKey && recoveredRecord) {
          const target = recoveredKey,
            snapshot = recoveredRecord,
            exact = lastStoredCode === snapshot.code;
          recoveredKey = null;
          recoveredRecord = null;
          // A cloned tab may still be editing the recovered key. Once this editor's newer code is
          // saved, drop it unless an open tab holds it. Without Web Locks, drop it only when the
          // exact recovered bytes were acknowledged without subsequent edits.
          const unchanged = () => {
            const existing = parse(localStorage.getItem(target));
            return (
              existing?.code === snapshot.code && existing.baseRevision === snapshot.baseRevision
            );
          };
          if (!lockManager()) {
            if (exact && unchanged()) localStorage.removeItem(target);
          } else
            void heldKeys().then((held) => {
              if (held && !held.has(target) && unchanged()) localStorage.removeItem(target);
            });
        }
        return true;
      } catch {
        onError("이 브라우저에 초안을 보관하지 못했습니다. 창을 닫기 전에 코드를 복사해 주세요.");
        return false;
      }
    },
    /** Drafts other editors (open or closed tabs) kept for this problem. */
    async others(): Promise<StoredDraft[]> {
      const held = await heldKeys();
      try {
        return Object.keys(localStorage)
          .filter((k) => k.startsWith(`${prefix}:`) && k !== key)
          .flatMap((k) => {
            const record = parse(localStorage.getItem(k));
            return record ? [{ key: k, record, live: held ? held.has(k) : null }] : [];
          });
      } catch {
        return [];
      }
    },
    isRecovered: (k: string) => k === recoveredKey,
    discard(k: string) {
      try {
        if (k.startsWith(`${prefix}:`) && k !== key) localStorage.removeItem(k);
      } catch {
        /* The draft stays listed; nothing else depends on its removal. */
      }
    },
  };
}
