import type { Progress } from "../problem";

export type DraftStatus =
  | { kind: "saved" | "local" | "saving" | "offline" | "failed" }
  | { kind: "conflict" | "resolving"; server: Progress };
export type DraftRecord = { code: string; baseRevision: number | null };
export type DraftSnapshot = { code: string; status: DraftStatus; localSaved: boolean };
export type SaveResult = { saved: Progress } | { conflict: Progress };

/** One editor's state machine. The server revision, never a client timestamp, authorizes writes. */
export class DraftController {
  private snapshot: DraftSnapshot = { code: "", status: { kind: "saved" }, localSaved: true };
  private listeners = new Set<() => void>();
  private revision: number | null = 0;
  private edit = 0;
  private dirty = false;
  private running: Promise<boolean> | null = null;
  private conflict: Progress | null = null;
  constructor(
    private readonly io: {
      save: (code: string, revision: number) => Promise<SaveResult>;
      persist: (record: DraftRecord | null) => boolean | void;
      online: () => boolean;
      onSaved: (progress: Progress) => void;
    },
  ) {}
  setSavedHandler(handler: (progress: Progress) => void) {
    this.io.onSaved = handler;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(status: DraftStatus, code = this.snapshot.code) {
    this.snapshot = { ...this.snapshot, code, status };
    this.listeners.forEach((listener) => listener());
  }
  private persist() {
    const persisted = this.io.persist(
      this.dirty ? { code: this.snapshot.code, baseRevision: this.revision } : null,
    );
    this.snapshot = { ...this.snapshot, localSaved: !this.dirty || persisted !== false };
  }
  initialize(progress: Progress | null, starter: string, local: DraftRecord | null) {
    const serverCode = progress?.code ?? starter;
    this.revision = progress?.codeRevision ?? 0;
    this.dirty = !!local && local.code !== serverCode;
    this.conflict =
      this.dirty && local!.baseRevision !== this.revision
        ? (progress ?? {
            codeRevision: 0,
            problemId: "",
            code: serverCode,
            bookmarked: false,
            hintsViewed: 0,
            solutionViewed: false,
            status: "new",
            updatedAt: "",
          })
        : null;
    if (this.dirty) this.revision = local!.baseRevision;
    this.snapshot = { ...this.snapshot, code: this.dirty ? local!.code : serverCode };
    this.persist();
    this.publish(
      this.conflict
        ? { kind: "conflict", server: this.conflict }
        : { kind: this.dirty ? "local" : "saved" },
      this.dirty ? local!.code : serverCode,
    );
    return this.dirty;
  }
  change(code: string) {
    this.edit++;
    this.dirty = true;
    this.snapshot = { ...this.snapshot, code };
    this.persist();
    this.publish(
      this.conflict
        ? { kind: this.running ? "resolving" : "conflict", server: this.conflict }
        : { kind: this.running ? "saving" : this.io.online() ? "local" : "offline" },
      code,
    );
  }
  hasUnsaved = () => this.dirty;
  async flush(): Promise<boolean> {
    if (this.running) return this.running;
    if (this.conflict) return false;
    return this.start();
  }
  async resolve(): Promise<boolean> {
    if (!this.conflict || this.running) return false;
    // The button authorizes only the server version currently shown in the comparison.
    this.revision = this.conflict.codeRevision;
    return this.start();
  }
  private start() {
    this.running = this.pump().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async pump(): Promise<boolean> {
    while (this.dirty) {
      if (!this.io.online()) {
        this.publish(
          this.conflict ? { kind: "conflict", server: this.conflict } : { kind: "offline" },
        );
        return false;
      }
      const code = this.snapshot.code,
        edit = this.edit;
      this.publish(
        this.conflict ? { kind: "resolving", server: this.conflict } : { kind: "saving" },
      );
      try {
        const result = await this.io.save(code, this.revision!);
        if ("conflict" in result) {
          this.conflict = result.conflict;
          // Keep the original base until explicit resolution; reload cannot bypass the conflict.
          this.persist();
          this.publish({ kind: "conflict", server: this.conflict });
          return false;
        }
        this.revision = result.saved.codeRevision;
        this.conflict = null;
        this.dirty = edit !== this.edit;
        this.persist();
        this.publish({ kind: this.dirty ? "saving" : "saved" });
        this.io.onSaved(result.saved);
      } catch {
        this.publish(
          this.conflict
            ? { kind: "conflict", server: this.conflict }
            : { kind: this.io.online() ? "failed" : "offline" },
        );
        return false;
      }
    }
    return true;
  }
}
