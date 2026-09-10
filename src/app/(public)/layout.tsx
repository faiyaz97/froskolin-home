import { PublicAuthShell } from "@/components/public/auth-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicAuthShell>{children}</PublicAuthShell>;
}
