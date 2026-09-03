import { redirect } from "next/navigation";

export default function JoinPage() {
  redirect("/?mode=join");
}
