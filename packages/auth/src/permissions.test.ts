import { describe, expect, it } from "vitest";

import { accessControlRoles } from "./access-control";
import {
  type Capability,
  ROLE_CAPABILITIES,
  capabilitiesFor,
  hasAtLeastRole,
  hasPermission,
} from "./permissions";

// The app's capability map and Better Auth's access-control roles describe the
// same permissions twice. These tests fail when one changes without the other.
const RESOURCE_MAP: Record<string, string> = { items: "item", audit: "audit" };

function betterAuthGrants(role: keyof typeof accessControlRoles, capability: Capability): boolean {
  const [resource, action] = capability.split(".") as [string, string];
  const statement = RESOURCE_MAP[resource];
  if (!statement) return true; // users.* / settings.* have no Better Auth mirror
  const statements = accessControlRoles[role].statements as Record<string, readonly string[]>;
  return statements[statement]?.includes(action) ?? false;
}

describe("permission map ↔ Better Auth access control", () => {
  for (const role of Object.keys(ROLE_CAPABILITIES) as Array<keyof typeof ROLE_CAPABILITIES>) {
    it(`${role}: every mirrored capability matches`, () => {
      for (const capability of ROLE_CAPABILITIES.admin) {
        if (!RESOURCE_MAP[capability.split(".")[0] ?? ""]) continue;
        expect(betterAuthGrants(role, capability), capability).toBe(
          ROLE_CAPABILITIES[role].includes(capability),
        );
      }
    });
  }
});

describe("hasPermission", () => {
  it("grants by role", () => {
    expect(hasPermission({ role: "viewer" }, "items.read")).toBe(true);
    expect(hasPermission({ role: "viewer" }, "items.update")).toBe(false);
    expect(hasPermission({ role: "editor" }, "items.delete")).toBe(true);
    expect(hasPermission({ role: "editor" }, "users.manage")).toBe(false);
    expect(hasPermission({ role: "admin" }, "users.manage")).toBe(true);
  });

  it("denies unknown or missing roles", () => {
    expect(hasPermission({ role: "superuser" }, "items.read")).toBe(false);
    expect(hasPermission(null, "items.read")).toBe(false);
    expect(capabilitiesFor({ role: "superuser" })).toEqual({ role: null, list: [] });
  });

  it("ranks roles", () => {
    expect(hasAtLeastRole({ role: "admin" }, "editor")).toBe(true);
    expect(hasAtLeastRole({ role: "viewer" }, "editor")).toBe(false);
  });
});
