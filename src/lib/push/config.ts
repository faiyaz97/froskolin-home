import "server-only";

export function getPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/.test(privateKey))
    return null;
  try {
    const contact = new URL(subject);
    if (contact.protocol !== "mailto:" && contact.protocol !== "https:") return null;
    if (contact.protocol === "mailto:" && !contact.pathname.includes("@")) return null;
  } catch {
    return null;
  }

  return { publicKey, privateKey, subject };
}
