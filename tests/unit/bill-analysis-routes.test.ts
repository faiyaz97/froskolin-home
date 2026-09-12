import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as uploadPost } from "@/app/api/bills/extract/route";
import { POST as storedPost } from "@/app/api/bills/[documentId]/extract/route";
import { rawBill, gasSummaryReference, vat } from "../fixtures/bill-analysis";

const { extract, repair, authorize, prepare, updates } = vi.hoisted(() => ({
  extract: vi.fn(),
  repair: vi.fn(),
  authorize: vi.fn(),
  prepare: vi.fn(),
  updates: [] as unknown[],
}));
vi.mock("@/lib/auth", () => ({ requireHouseholdMutation: authorize }));
vi.mock("@/lib/bills", async (original) => ({
  ...(await original<typeof import("@/lib/bills")>()),
  GeminiBillExtractor: class {
    extract = extract;
    repair = repair;
  },
  prepareBillUpload: prepare,
}));

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  extract.mockResolvedValue(rawBill());
  prepare.mockResolvedValue({
    bytes: new Uint8Array([1]),
    mimeType: "application/pdf",
    pageCount: 2,
    filename: "test.pdf",
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn(function (value: unknown) {
      updates.push(value);
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "document",
        household_id: "group",
        storage_path: "group/file",
        detected_mime: "application/pdf",
      },
      error: null,
    }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  authorize.mockResolvedValue({
    supabase: {
      from: () => builder,
      storage: {
        from: () => ({ download: async () => ({ data: new Blob(["bill"]), error: null }) }),
      },
    },
  });
});

describe("bill analysis route boundaries", () => {
  it("applies one targeted repair through the upload endpoint after authorization", async () => {
    const corrected = rawBill({
      totalDueCents: 11000,
      vatLines: [vat("vat", 1000, 10000, 1000, ["fixed", "usage"])],
    });
    const initial = structuredClone(corrected);
    initial.vatLines[0].appliesToChargeIds = [];
    extract.mockResolvedValue(initial);
    repair.mockResolvedValue(corrected);
    const body = new FormData();
    body.set("householdId", "group");
    body.set("consent", "true");
    body.set("file", new File(["bill"], "test.pdf", { type: "application/pdf" }));
    const response = await uploadPost(
      new Request("http://localhost/api/bills/extract", { method: "POST", body }),
    );
    expect((await response.json()).extraction.charges).toMatchObject({
      fixedCents: 4400,
      consumptionCents: 6600,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(repair.mock.invocationCallOrder[0]);
  });
  it("calculates buckets after extracting an uploaded bill", async () => {
    const body = new FormData();
    body.set("householdId", "group");
    body.set("consent", "true");
    body.set("file", new File(["bill"], "test.pdf", { type: "application/pdf" }));
    const response = await uploadPost(
      new Request("http://localhost/api/bills/extract", { method: "POST", body }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.extraction.charges).toMatchObject({ fixedCents: 4000, consumptionCents: 6000 });
    expect(result.extraction.structuredData).toEqual(rawBill());
    expect(authorize).toHaveBeenCalledWith("group");
  });

  it("persists versioned raw facts and review status for an existing document", async () => {
    extract.mockResolvedValue(gasSummaryReference);
    const response = await storedPost(
      new Request("http://localhost/api/bills/document/extract", {
        method: "POST",
        body: JSON.stringify({ householdId: "group", consent: true }),
      }),
      { params: Promise.resolve({ documentId: "document" }) },
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.extraction.analysis.status).toBe("needs_review");
    expect(result.extraction.charges.fixedCents).toBeNull();
    expect(updates).toContainEqual(expect.objectContaining({ extraction_schema_version: "2" }));
    expect(updates).toContainEqual(expect.objectContaining({ extraction: result.extraction }));
  });

  it("does not extract without explicit consent", async () => {
    const response = await storedPost(
      new Request("http://localhost/api/bills/document/extract", {
        method: "POST",
        body: JSON.stringify({ householdId: "group", consent: false }),
      }),
      { params: Promise.resolve({ documentId: "document" }) },
    );
    expect(response.status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });
});
