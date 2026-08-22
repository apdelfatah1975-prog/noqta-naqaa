import { describe, expect, it } from "vitest";
import { extractArray, normalizeListResponse, normalizeOptionalList } from "./dataNormalization";

describe("extractArray", () => {
  it("returns direct arrays unchanged", () => {
    const values = [{ id: 1 }];
    expect(extractArray(values)).toBe(values);
  });

  it("unwraps common list response keys", () => {
    expect(extractArray({ data: [1, 2] })).toEqual([1, 2]);
    expect(extractArray({ visits: [{ id: 3 }] })).toEqual([{ id: 3 }]);
    expect(extractArray({ customers: [{ id: 4 }] })).toEqual([{ id: 4 }]);
    expect(normalizeListResponse({ workOrders: [{ id: 5 }] })).toEqual([{ id: 5 }]);
  });

  it("returns an empty array for null, undefined, and non-list objects", () => {
    expect(extractArray(null)).toEqual([]);
    expect(extractArray(undefined)).toEqual([]);
    expect(extractArray({ data: { id: 1 } })).toEqual([]);
    expect(extractArray("not a list")).toEqual([]);
  });

  it("preserves null only for the explicitly optional helper", () => {
    expect(normalizeOptionalList(null)).toBeNull();
    expect(normalizeOptionalList({ alerts: [] })).toEqual([]);
  });
});
