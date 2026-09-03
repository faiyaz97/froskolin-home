"use client";
import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/page";
export default function ErrorState({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl pt-12">
      <StatusNote tone="error" title="Froskolin dropped the ledger">
        This page could not be loaded. Your household data is safe.
      </StatusNote>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
