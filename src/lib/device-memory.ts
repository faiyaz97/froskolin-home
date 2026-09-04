export type RememberedDevice = {
  houseCode: string;
  memberName: string;
};

const STORAGE_KEY = "froskolin.remembered-device.v1";

export function readRememberedDevice(): RememberedDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "houseCode" in value &&
      "memberName" in value &&
      typeof value.houseCode === "string" &&
      typeof value.memberName === "string" &&
      /^FROSKO-\d{4}$/.test(value.houseCode) &&
      value.memberName.trim()
    ) {
      return { houseCode: value.houseCode, memberName: value.memberName };
    }
  } catch {
    // Invalid or blocked local storage behaves like a new device.
  }
  return null;
}

export function rememberDevice(device: RememberedDevice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        houseCode: device.houseCode.trim().toUpperCase(),
        memberName: device.memberName.trim(),
      }),
    );
  } catch {
    // Authentication still works when storage is blocked or unavailable.
  }
}

export function updateRememberedHouseCode(houseCode: string, memberName: string): void {
  rememberDevice({ houseCode, memberName });
}

export function updateRememberedMemberName(houseCode: string, memberName: string): void {
  rememberDevice({ houseCode, memberName });
}

export function forgetRememberedDevice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // There is nothing else to forget when storage is unavailable.
  }
}
