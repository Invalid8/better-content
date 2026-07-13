import { describe, expect, it } from "vitest";
import { isFilterGroup } from "../src/core/helpers";
import type { QueryCondition } from "../src/core/types";

describe("isFilterGroup", () => {
  it("narrows an OR group", () => {
    const c: QueryCondition = { or: [{ field: "tag", op: "eq", value: "x" }] };
    expect(isFilterGroup(c)).toBe(true);
  });

  it("rejects a bare filter condition", () => {
    const c: QueryCondition = { field: "title", op: "contains", value: "hi" };
    expect(isFilterGroup(c)).toBe(false);
  });
});
