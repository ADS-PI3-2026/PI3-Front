import { redirect } from "next/navigation";
import { adminWorkspaceHref } from "../_lib/admin-workspace";

export default function MediationsPage() {
  redirect(adminWorkspaceHref("mediacoes"));
}
