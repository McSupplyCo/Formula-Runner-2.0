import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSave, setSaveWritesEnabled, writeSave } from "../src/game/save";
import { SaveOwnership } from "../src/game/saveOwnership";
import { SAVE_KEY } from "../src/game/tuning";

class FakeLockProvider {
  held = false;

  async request(
    _name: string,
    _options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: Lock | null) => Promise<void>,
  ) {
    if (this.held) return callback(null);
    this.held = true;
    try {
      return await callback({} as Lock);
    } finally {
      this.held = false;
    }
  }
}

function installMemoryStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

afterEach(() => {
  setSaveWritesEnabled(false);
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("single-tab save ownership", () => {
  it("rejects writes until this tab owns the save lock", async () => {
    const storage = installMemoryStorage();
    const locks = new FakeLockProvider();
    const session = new SaveOwnership(locks as unknown as LockManager, 5);

    expect(writeSave(defaultSave())).toBe(false);
    expect(storage.size).toBe(0);
    await session.start();
    expect(session.state).toBe("owner");
    expect(writeSave(defaultSave())).toBe(true);
    expect(JSON.parse(storage.get(SAVE_KEY)!).version).toBe(5);

    session.dispose();
    expect(writeSave(defaultSave())).toBe(false);
  });

  it("keeps a second tab read-only and promotes it after the owner closes", async () => {
    const locks = new FakeLockProvider();
    const owner = new SaveOwnership(locks as unknown as LockManager, 5);
    const waiting = new SaveOwnership(locks as unknown as LockManager, 5);

    await owner.start();
    await waiting.start();
    expect(owner.state).toBe("owner");
    expect(waiting.state).toBe("inactive");

    owner.dispose();
    await vi.waitFor(() => expect(waiting.state).toBe("owner"), { timeout: 200 });
    expect(locks.held).toBe(true);
    waiting.dispose();
    await vi.waitFor(() => expect(locks.held).toBe(false), { timeout: 200 });
  });

  it("fails closed when browser save locking is unavailable", async () => {
    const storage = installMemoryStorage();
    const session = new SaveOwnership(null);

    await session.start();
    expect(session.state).toBe("unsupported");
    expect(writeSave(defaultSave())).toBe(false);
    expect(storage.size).toBe(0);
    session.dispose();
  });
});
