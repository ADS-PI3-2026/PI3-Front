import { Suspense } from "react";
import AdminWorkspace from "./_components/admin-workspace";

export default function AdminDashboard() {
  return (
    <Suspense fallback={<p role="status">Carregando painel…</p>}>
      <AdminWorkspace />
    </Suspense>
  );
}
