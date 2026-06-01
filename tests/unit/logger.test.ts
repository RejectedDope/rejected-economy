import { describe, it, expect, vi, beforeEach } from "vitest";

// In test env (NODE_ENV=test), logger routes all output to console.log.
// Tests verify log shape by spying on console.log.

const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

import { logger } from "@/lib/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logger.info writes a structured message", () => {
    logger.info("runtime", "something happened", { key: "value" });
    expect(logSpy).toHaveBeenCalledOnce();
    const call = String(logSpy.mock.calls[0][0]);
    expect(call).toContain("info");
    expect(call).toContain("runtime");
  });

  it("logger.warn writes a structured message", () => {
    logger.warn("auth", "suspicious request");
    expect(logSpy).toHaveBeenCalledOnce();
    const call = String(logSpy.mock.calls[0][0]);
    expect(call).toContain("warn");
  });

  it("logger.error writes a structured message", () => {
    logger.error("ingestion", "failed to parse", new Error("boom"));
    expect(logSpy).toHaveBeenCalledOnce();
    const call = String(logSpy.mock.calls[0][0]);
    expect(call).toContain("error");
    expect(call).toContain("ingestion");
  });

  it("logger.supabaseError includes table and operation in the message", () => {
    logger.supabaseError("inventory_items", "insert", "duplicate key", { userId: "abc" });
    expect(logSpy).toHaveBeenCalledOnce();
    const call = String(logSpy.mock.calls[0][0]);
    expect(call).toContain("inventory_items");
    expect(call).toContain("insert");
  });
});
