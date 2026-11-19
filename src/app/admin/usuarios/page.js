import { redirect } from "next/navigation";
import { adminWorkspaceHref } from "../_lib/admin-workspace";

export default function InternalUsersPage() {
  redirect(adminWorkspaceHref("administradores"));
}
