import { describe, it, expect, beforeEach, vi } from "vitest";
import { enforceAction, requireResourceOwner, requireResourceOwnerForDelete, validateOrgContext } from "@/lib/api/middleware/ownership";

const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Helper to create mock request
function createRequest(path: string = "/api/skills/skill-1"): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

describe("enforceAction middleware", () => {
  const handler = vi.fn(async (_req: Request, _ctx: any) => new Response("ok"));

  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockClear();
  });

  it("allows OWNER to do any action", async () => {
    const wrapped = enforceAction("delete", handler);
    await wrapped(createRequest(), { userId: "u1", role: "OWNER", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("allows ADMIN to do any action", async () => {
    const wrapped = enforceAction("delete", handler);
    await wrapped(createRequest(), { userId: "u1", role: "ADMIN", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("allows VIEWER to read", async () => {
    const wrapped = enforceAction("read", handler);
    await wrapped(createRequest(), { userId: "u1", role: "VIEWER", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks VIEWER from write", async () => {
    const wrapped = enforceAction("write", handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "VIEWER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("blocks VIEWER from delete", async () => {
    const wrapped = enforceAction("delete", handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "VIEWER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("allows MEMBER to read any org resource", async () => {
    const wrapped = enforceAction("read", handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("allows MEMBER to write their own resource", async () => {
    const wrapped = enforceAction("write", handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: true });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks MEMBER from writing others' resources", async () => {
    const wrapped = enforceAction("write", handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("allows MEMBER to execute their own resource", async () => {
    const wrapped = enforceAction("execute", handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: true });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks MEMBER from executing others' resources", async () => {
    const wrapped = enforceAction("execute", handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("allows MEMBER to delete their own resource", async () => {
    const wrapped = enforceAction("delete", handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: true });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks MEMBER from deleting others' resources", async () => {
    const wrapped = enforceAction("delete", handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});

describe("requireResourceOwner middleware", () => {
  const handler = vi.fn(async (_req: Request, _ctx: any) => new Response("ok"));

  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockClear();
  });

  it("allows OWNER regardless of ownership", async () => {
    const wrapped = requireResourceOwner(handler);
    await wrapped(createRequest(), { userId: "u1", role: "OWNER", isOwner: false, resourceOwnerId: "u2" });

    expect(handler).toHaveBeenCalled();
  });

  it("allows ADMIN regardless of ownership", async () => {
    const wrapped = requireResourceOwner(handler);
    await wrapped(createRequest(), { userId: "u1", role: "ADMIN", isOwner: false, resourceOwnerId: "u2" });

    expect(handler).toHaveBeenCalled();
  });

  it("allows MEMBER who owns the resource", async () => {
    const wrapped = requireResourceOwner(handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: true, resourceOwnerId: "u1" });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks MEMBER who doesn't own the resource", async () => {
    const wrapped = requireResourceOwner(handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false, resourceOwnerId: "u2" });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("blocks VIEWER from modifying", async () => {
    const wrapped = requireResourceOwner(handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "VIEWER", isOwner: true, resourceOwnerId: "u1" });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});

describe("requireResourceOwnerForDelete middleware", () => {
  const handler = vi.fn(async (_req: Request, _ctx: any) => new Response("ok"));

  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockClear();
  });

  it("allows OWNER to delete", async () => {
    const wrapped = requireResourceOwnerForDelete(handler);
    await wrapped(createRequest(), { userId: "u1", role: "OWNER", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("allows ADMIN to delete", async () => {
    const wrapped = requireResourceOwnerForDelete(handler);
    await wrapped(createRequest(), { userId: "u1", role: "ADMIN", isOwner: false });

    expect(handler).toHaveBeenCalled();
  });

  it("allows MEMBER to delete own", async () => {
    const wrapped = requireResourceOwnerForDelete(handler);
    await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: true });

    expect(handler).toHaveBeenCalled();
  });

  it("blocks MEMBER from deleting others'", async () => {
    const wrapped = requireResourceOwnerForDelete(handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "MEMBER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("blocks VIEWER from deleting", async () => {
    const wrapped = requireResourceOwnerForDelete(handler);
    const res = await wrapped(createRequest(), { userId: "u1", role: "VIEWER", isOwner: false });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});

describe("validateOrgContext middleware", () => {
  const handler = vi.fn(async (_req: Request, _ctx: any) => new Response("ok"));

  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockClear();
  });

  it("passes when organization exists", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    const wrapped = validateOrgContext(handler);

    await wrapped(createRequest(), { userId: "u1", organizationId: "org-1" });

    expect(handler).toHaveBeenCalled();
  });

  it("returns 400 when organization not found", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    const wrapped = validateOrgContext(handler);

    const res = await wrapped(createRequest(), { userId: "u1", organizationId: "org-1" });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
  });

  it("returns 403 when no organization context", async () => {
    const wrapped = validateOrgContext(handler);
    const res = await wrapped(createRequest(), { userId: "u1" });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});
