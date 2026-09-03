"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { readRememberedDevice } from "@/lib/device-memory";

export function RememberedDeviceRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (readRememberedDevice()) router.replace("/login");
  }, [router]);

  return null;
}
