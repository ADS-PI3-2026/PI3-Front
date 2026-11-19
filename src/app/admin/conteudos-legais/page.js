import { redirect } from "next/navigation";
import { adminWorkspaceHref } from "../_lib/admin-workspace";

export default function LegalContentPage() {
  redirect(adminWorkspaceHref("textos"));
}
