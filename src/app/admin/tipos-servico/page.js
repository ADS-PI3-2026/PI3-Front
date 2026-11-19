import { redirect } from "next/navigation";
import { adminWorkspaceHref } from "../_lib/admin-workspace";

export default async function ServiceTypesPage({ searchParams }) {
  redirect(adminWorkspaceHref("servicos", await searchParams));
}
