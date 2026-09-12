// Compatibility export; all financial arithmetic lives in the pure domain layer.
export {
  calculateBillTotals as normalizeExtractedBillBuckets,
  BILL_ROUNDING_TOLERANCE_CENTS,
} from "../domain/bill-analysis";
