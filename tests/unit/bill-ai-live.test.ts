import { expect, it } from "vitest";
import { GeminiBillExtractor } from "@/lib/bills/gemini-extractor";
import { calculateBillTotals } from "@/lib/domain/bill-analysis";
import { analyzeBill } from "@/lib/bills/analyze-bill";
import { rawBill, vat } from "../fixtures/bill-analysis";

// Explicit opt-in only: this test spends API quota, using synthetic data, never user files.
it.skipIf(process.env.BILL_AI_LIVE_TEST !== "1")(
  "extracts and calculates a synthetic bill through the live Gemini API",
  async () => {
    process.loadEnvFile(".env.local");
    const raw = await new GeminiBillExtractor().extract({
      mimeType: "image/png",
      bytes: new Uint8Array(),
      filename: "synthetic-test",
      extractedText: `Synthetic test bill, page 1 of 1. Provider: Example Energy. Utility: electricity.
Invoice date 2026-06-01. Service period 2026-05-01 to 2026-05-31. Currency EUR.
Subscription fixed charge: EUR 20.00. Consumption usage charge: EUR 80.00.
VAT 10%, taxable base EUR 100.00, applies to both subscription and consumption, VAT EUR 10.00.
Amount due EUR 110.00. This is the complete payable breakdown. No other charges, credits or rounding.
All dates and amounts are clearly printed and unambiguous.`,
    });
    const calculated = calculateBillTotals(raw);
    expect(calculated.analysis?.status).toBe("ready");
    expect(calculated.charges.fixedCents).toBe(2200);
    expect(calculated.charges.consumptionCents).toBe(8800);
    expect(calculated.totalDueCents).toBe(11000);
  },
  90000,
);

it.skipIf(process.env.BILL_AI_LIVE_TEST !== "1")(
  "repairs only a broken VAT relationship through the live Gemini API",
  async () => {
    process.loadEnvFile(".env.local");
    const raw = rawBill({
      totalDueCents: 11000,
      vatLines: [vat("vat", 1000, 10000, 1000, ["usage"])],
    });
    const gemini = new GeminiBillExtractor();
    const result = await analyzeBill(
      {
        mimeType: "image/png",
        bytes: new Uint8Array(),
        filename: "synthetic-repair",
        extractedText: `Synthetic gas bill: Example Energy. Invoice date 2026-06-03.
Service 2026-03-01 through 2026-05-31, consumption 53.283974 Smc. Currency EUR.
Fixed subscription EUR 40.00; usage consumption EUR 60.00.
VAT 10% applies to BOTH fixed subscription AND usage consumption, taxable base EUR 100.00, VAT EUR 10.00.
Amount due EUR 110.00. Complete source, page 1 of 1, no other charges or adjustments.`,
      },
      { extract: async () => raw, repair: gemini.repair.bind(gemini) },
    );
    expect(result.analysis?.status).toBe("ready");
    expect(result.charges).toMatchObject({ fixedCents: 4400, consumptionCents: 6600 });
  },
  90000,
);
