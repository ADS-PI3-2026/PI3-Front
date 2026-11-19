import { redirect } from "next/navigation";
import { adminWorkspaceHref } from "../_lib/admin-workspace";

export default function AuditPage() {
  redirect(adminWorkspaceHref("auditoria"));
}
