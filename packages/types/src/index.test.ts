import { describe, it, expect } from "vitest";

import {
  itemInputSchema,
  itemFilterSchema,
  pageQuerySchema,
  itemStatusSchema,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  type ItemStatus,
} from "./index";

describe("itemInputSchema", () => {
  it("rejects an empty title", () => {
    const result = itemInputSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a single-character title (min length 2)", () => {
    const result = itemInputSchema.safeParse({ title: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 200 characters", () => {
    const result = itemInputSchema.safeParse({ title: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid title and defaults status to draft", () => {
    const result = itemInputSchema.parse({ title: "A valid item" });
    expect(result.status).toBe("draft");
    expect(result.title).toBe("A valid item");
  });

  it("rejects a description longer than 2000 characters", () => {
    const result = itemInputSchema.safeParse({
      title: "Valid title",
      description: "d".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null description", () => {
    const result = itemInputSchema.parse({ title: "Valid title", description: null });
    expect(result.description).toBeNull();
  });

  it("rejects an unknown status value", () => {
    const result = itemInputSchema.safeParse({ title: "Valid title", status: "published" });
    expect(result.success).toBe(false);
  });
});

describe("itemFilterSchema", () => {
  it("applies defaults when given an empty object", () => {
    const filters = itemFilterSchema.parse({});
    expect(filters).toEqual({ search: "", status: "all", sort: "recent" });
  });

  it("preserves provided filter values", () => {
    const filters = itemFilterSchema.parse({
      search: "welcome",
      status: "active",
      sort: "title",
    });
    expect(filters).toEqual({ search: "welcome", status: "active", sort: "title" });
  });

  it("accepts the literal 'all' status", () => {
    const filters = itemFilterSchema.parse({ status: "all" });
    expect(filters.status).toBe("all");
  });

  // URL params are untrusted: bad values degrade to defaults, never throw.
  it("falls back to defaults for invalid values", () => {
    expect(itemFilterSchema.parse({ sort: "oldest", status: "bogus" })).toEqual({
      search: "",
      status: "all",
      sort: "recent",
    });
  });

  it("falls back when a param is repeated (array)", () => {
    expect(itemFilterSchema.parse({ search: ["a", "b"] }).search).toBe("");
  });

  it("trims the search term", () => {
    expect(itemFilterSchema.parse({ search: "  welcome " }).search).toBe("welcome");
  });
});

describe("pageQuerySchema", () => {
  it("coerces string query params to numbers", () => {
    const query = pageQuerySchema.parse({ page: "3", pageSize: "50" });
    expect(query).toEqual({ page: 3, pageSize: 50 });
  });

  it("applies defaults when fields are missing", () => {
    const query = pageQuerySchema.parse({});
    expect(query).toEqual({ page: 1, pageSize: 20 });
  });

  it("falls back to page 1 below 1", () => {
    expect(pageQuerySchema.parse({ page: "0" }).page).toBe(1);
  });

  it("falls back to the default pageSize above 100", () => {
    expect(pageQuerySchema.parse({ pageSize: "101" }).pageSize).toBe(20);
  });

  it("falls back for non-integer and non-numeric values", () => {
    expect(pageQuerySchema.parse({ page: "1.5" }).page).toBe(1);
    expect(pageQuerySchema.parse({ page: "abc" }).page).toBe(1);
  });
});

describe("STATUS_LABELS and STATUS_DESCRIPTIONS", () => {
  const allStatuses = itemStatusSchema.options as readonly ItemStatus[];

  it("has a label for every ItemStatus", () => {
    for (const status of allStatuses) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(typeof STATUS_LABELS[status]).toBe("string");
    }
  });

  it("has a description for every ItemStatus", () => {
    for (const status of allStatuses) {
      expect(STATUS_DESCRIPTIONS[status]).toBeTruthy();
      expect(typeof STATUS_DESCRIPTIONS[status]).toBe("string");
    }
  });

  it("does not declare labels for unknown statuses", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...allStatuses].sort());
  });
});
