import { describe, expect, it, vi } from "vitest";

import { applyDefaultProjectionOptions } from "../src/utils.js";

describe("utils", () => {
  describe("applyDefaultProjectionOptions", () => {
    it("returns default options when no options provided", () => {
      const result = applyDefaultProjectionOptions();
      expect(result.namespace).toBeUndefined();
      expect(result.performanceLogger).toBeDefined();
      expect(result.eventHandlerInterceptor).toBeUndefined();
      expect(result.styleApplyer).toBeDefined();
    });

    it("merges provided options with defaults", () => {
      const customLogger = vi.fn();
      const result = applyDefaultProjectionOptions({
        performanceLogger: customLogger,
      });
      expect(result.performanceLogger).toBe(customLogger);
      expect(result.styleApplyer).toBeDefined();
    });

    describe("styleApplyer", () => {
      it("sets CSS variables using setProperty", () => {
        const result = applyDefaultProjectionOptions();
        const mockDomNode = {
          style: {
            setProperty: vi.fn(),
          },
        } as unknown as HTMLElement;

        result.styleApplyer!(mockDomNode, "--custom-color", "red");

        expect(mockDomNode.style.setProperty).toHaveBeenCalledWith("--custom-color", "red");
      });

      it("sets regular style properties directly", () => {
        const result = applyDefaultProjectionOptions();
        const mockDomNode = {
          style: {} as CSSStyleDeclaration,
        } as HTMLElement;

        result.styleApplyer!(mockDomNode, "backgroundColor", "blue");

        expect((mockDomNode.style as any).backgroundColor).toBe("blue");
      });
    });

    describe("performanceLogger", () => {
      it("is a no-op function by default", () => {
        const result = applyDefaultProjectionOptions();
        // Should not throw
        expect(() => result.performanceLogger!("renderStart", undefined)).not.toThrow();
      });
    });
  });
});
