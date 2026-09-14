import { describe, expect, it } from "vitest";
import { decideCallbackOutcome } from "./callback-outcome";

describe("decideCallbackOutcome", () => {
  it("procede con el code cuando todo coincide", () => {
    const result = decideCallbackOutcome({
      code: "abc123",
      state: "estado-1",
      savedState: "estado-1",
      metaError: null,
    });

    expect(result).toEqual({ type: "proceed", code: "abc123" });
  });

  it("rechaza si Meta mandó un error (el usuario canceló o negó permisos)", () => {
    const result = decideCallbackOutcome({
      code: null,
      state: null,
      savedState: "estado-1",
      metaError: "access_denied",
    });

    expect(result).toEqual({ type: "error", message: "access_denied" });
  });

  it("rechaza si falta el code", () => {
    const result = decideCallbackOutcome({
      code: null,
      state: "estado-1",
      savedState: "estado-1",
      metaError: null,
    });

    expect(result.type).toBe("error");
  });

  it("rechaza si el state no coincide con el guardado (CSRF)", () => {
    const result = decideCallbackOutcome({
      code: "abc123",
      state: "estado-atacante",
      savedState: "estado-1",
      metaError: null,
    });

    expect(result.type).toBe("error");
  });

  it("rechaza si no hay state guardado (cookie vencida o ausente)", () => {
    const result = decideCallbackOutcome({
      code: "abc123",
      state: "estado-1",
      savedState: undefined,
      metaError: null,
    });

    expect(result.type).toBe("error");
  });
});
