import { requireAdminUser } from "../admin-auth";
import AdminDashboard from "./admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminUser();
  return <AdminDashboard user={{ name: user.displayName, email: user.email }} />;
}
