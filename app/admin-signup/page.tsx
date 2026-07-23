import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import AccessRequestForm from "./request-form";

export const dynamic = "force-dynamic";

export default async function AdminSignupPage() {
  const user = await requireChatGPTUser("/admin-signup");
  const admin = await env.DB.prepare("SELECT email FROM admins WHERE lower(email) = lower(?)").bind(user.email).first();
  if (admin) redirect("/admin");
  const existing = await env.DB.prepare("SELECT status FROM admin_access_requests WHERE lower(email) = lower(?)").bind(user.email).first<{ status: string }>();
  return <AccessRequestForm user={{ name: user.displayName, email: user.email }} existingStatus={existing?.status || null} />;
}
