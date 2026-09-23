import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/auth";

type Context = { params: Promise<{ documentId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { documentId } = await params;
    const householdId = new URL(request.url).searchParams.get("householdId");
    if (!householdId)
      return NextResponse.json({ error: "Household is required." }, { status: 400 });
    const { supabase } = await requireHouseholdMembership(householdId);
    const { data: document, error } = await supabase
      .from("bill_documents")
      .select("storage_path, detected_mime")
      .eq("id", documentId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (error || !document) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    if (new URL(request.url).searchParams.get("inline") === "1") {
      const { data: file, error: downloadError } = await supabase.storage
        .from("froskolin-bills")
        .download(document.storage_path);
      if (downloadError || !file) throw downloadError ?? new Error("Could not open bill.");
      return new NextResponse(file, {
        headers: {
          "Content-Type": document.detected_mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const { data, error: signedUrlError } = await supabase.storage
      .from("froskolin-bills")
      .createSignedUrl(document.storage_path, 60);
    if (signedUrlError || !data?.signedUrl)
      throw signedUrlError ?? new Error("Could not create viewing link.");
    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json({ error: "You do not have access to this bill." }, { status: 403 });
  }
}
