import SiteDashboard from "../site-dashboard";
import { requireAdminUser } from "../admin-auth";

export const dynamic = "force-dynamic";

export default async function PrototypePage() {
  await requireAdminUser();
  return <SiteDashboard />;
}
