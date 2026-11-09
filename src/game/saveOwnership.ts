import { setSaveWritesEnabled } from "./save";

export type SaveSessionState = "checking" | "owner" | "inactive" | "unsupported";
type LockProvider = Pick<LockManager, "request">;

const SAVE_LOCK_NAME = "formula-runner-save-owner";
const RETRY_MS = 1000;

/** Holds one exclusive browser lock for the lifetime of the active game tab. */
export class SaveOwnership {
  state: SaveSessionState = "checking";
  private listeners = new Set<(state: SaveSessionState) => void>();
  private stopped = false;
  private requestPending = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseOwner: (() => void) | null = null;
  private resolveFirstAttempt: (() => void) | null = null;
  private firstAttempt: Promise<void> | null = null;

  constructor(
    private readonly locks: LockProvider | null | undefined =
      typeof navigator !== "undefined" ? navigator.locks : undefined,
    private readonly retryMs = RETRY_MS,
  ) {}

  subscribe(listener: (state: SaveSessionState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.firstAttempt) return this.firstAttempt;
    this.firstAttempt = new Promise((resolve) => {
      this.resolveFirstAttempt = resolve;
    });
    if (!this.locks) {
      this.setState("unsupported");
      this.resolveInitial();
      return this.firstAttempt;
    }
    void this.tryAcquire();
    return this.firstAttempt;
  }

  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.setState("inactive");
    this.releaseOwner?.();
    this.releaseOwner = null;
  }

  private async tryAcquire() {
    if (this.stopped || this.requestPending || !this.locks) return;
    this.requestPending = true;
    try {
      await this.locks.request(
        SAVE_LOCK_NAME,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (this.stopped) return;
          if (!lock) {
            this.setState("inactive");
            return;
          }
          this.setState("owner");
          this.resolveInitial();
          await new Promise<void>((resolve) => {
            this.releaseOwner = resolve;
          });
          this.releaseOwner = null;
        },
      );
    } catch {
      this.setState("unsupported");
    } finally {
      this.requestPending = false;
      this.resolveInitial();
      if (!this.stopped && this.state === "inactive") {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void this.tryAcquire();
        }, this.retryMs);
      }
    }
  }

  private resolveInitial() {
    this.resolveFirstAttempt?.();
    this.resolveFirstAttempt = null;
  }

  private setState(state: SaveSessionState) {
    if (this.state === state) return;
    this.state = state;
    setSaveWritesEnabled(state === "owner");
    this.listeners.forEach((listener) => listener(state));
  }
}
