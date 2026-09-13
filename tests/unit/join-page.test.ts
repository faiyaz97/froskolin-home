import { beforeEach, expect, it, vi } from "vitest";
import JoinPage from "@/app/(public)/join/page";

const { getUser, maybeSingle, from, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/public/auth-form", () => ({ PublicForm: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  from.mockReturnValue(query);
});

it("renders Join for a signed-out invitation recipient", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await JoinPage()).props.kind).toBe("join");
  expect(from).not.toHaveBeenCalled();
  expect(redirect).not.toHaveBeenCalled();
});

it("preserves the redirect for an existing active group member", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "member-user" } } });
  maybeSingle.mockResolvedValue({ data: { household_id: "existing-group" } });
  await expect(JoinPage()).rejects.toThrow("redirect:/h/existing-group");
});

it("allows a signed-in user without an active membership to reach Join", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "former-member" } } });
  maybeSingle.mockResolvedValue({ data: null });
  expect((await JoinPage()).props.kind).toBe("join");
  expect(redirect).not.toHaveBeenCalled();
});
