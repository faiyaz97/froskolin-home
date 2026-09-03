import { redirect } from "next/navigation";

export default function CreateHomePage() {
  redirect("/?mode=create");
}
