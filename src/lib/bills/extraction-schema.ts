import { z } from "zod";
import { structuredBillExtractionSchema } from "@/lib/validation";

/** Generation hints only. Full constraints remain enforced by Zod after extraction. */
export function generationSchema(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of ["type", "description", "enum", "required", "additionalProperties"]) {
    if (input[key] !== undefined) output[key] = input[key];
  }
  if (input.const !== undefined) output.enum = [input.const];
  if (input.properties) {
    output.properties = Object.fromEntries(
      Object.entries(input.properties as Record<string, Record<string, unknown>>).map(
        ([name, schema]) => [name, generationSchema(schema)],
      ),
    );
  }
  if (input.items) output.items = generationSchema(input.items as Record<string, unknown>);
  if (input.anyOf) {
    const variants = (input.anyOf as Record<string, unknown>[]).map(generationSchema);
    if (
      variants.every(
        (variant) =>
          typeof variant.type === "string" && !["object", "array"].includes(variant.type),
      )
    ) {
      output.type = variants.map((variant) => variant.type);
      const nonNull = variants.find((variant) => variant.type !== "null");
      if (nonNull?.enum) output.enum = nonNull.enum;
    } else output.anyOf = variants;
  }
  return output;
}

export const extractionSchema = generationSchema(
  z.toJSONSchema(structuredBillExtractionSchema, { target: "draft-7" }),
);
