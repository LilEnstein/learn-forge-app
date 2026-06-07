import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";

// Mock the OS-level dependencies so tests never touch a real binary or disk.
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { spawn } from "node:child_process";
import {
  isMarkItDownAvailable,
  convertWithMarkItDown,
  __resetMarkItDownCache,
} from "./markitdown";

const spawnMock = vi.mocked(spawn);

/** A fake ChildProcess: an EventEmitter with a `stdout` EventEmitter and a `kill` spy. */
function makeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

/** Yield to the microtask queue so the source's `await writeFile` resolves and
 *  the child-process event listeners are attached before we emit events. */
const tick = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  __resetMarkItDownCache();
  spawnMock.mockReset();
  delete process.env.MARKITDOWN_ENABLED;
  delete process.env.VERCEL;
});

describe("isMarkItDownAvailable", () => {
  it("disabled flag → false (never spawns)", async () => {
    process.env.MARKITDOWN_ENABLED = "false";
    expect(await isMarkItDownAvailable()).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("serverless (VERCEL=1) → false (never spawns)", async () => {
    process.env.VERCEL = "1";
    expect(await isMarkItDownAvailable()).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("binary missing (spawn emits 'error') → false", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child as never);
    const promise = isMarkItDownAvailable();
    child.emit("error", new Error("ENOENT"));
    expect(await promise).toBe(false);
  });

  it("available (--version closes with code 0) → true", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child as never);
    const promise = isMarkItDownAvailable();
    child.emit("close", 0);
    expect(await promise).toBe(true);
  });
});

describe("convertWithMarkItDown", () => {
  it("convert ok (stdout data, code 0) → returns the string", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child as never);
    const promise = convertWithMarkItDown(Buffer.from("data"), "sample.docx");
    await tick();
    child.stdout.emit("data", Buffer.from("# Hello"));
    child.emit("close", 0);
    expect(await promise).toBe("# Hello");
  });

  it("convert bad exit (code ≠ 0) → null", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child as never);
    const promise = convertWithMarkItDown(Buffer.from("data"), "sample.docx");
    await tick();
    child.stdout.emit("data", Buffer.from("# Hello"));
    child.emit("close", 1);
    expect(await promise).toBeNull();
  });

  it("convert spawn throws → null", async () => {
    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    expect(await convertWithMarkItDown(Buffer.from("data"), "sample.docx")).toBeNull();
  });
});
