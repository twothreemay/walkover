import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

export async function getAdminUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const admin = await env.DB.prepare("SELECT email FROM admins WHERE lower(email) = lower(?)").bind(user.email).first();
  return admin ? user : null;
}

export async function requireAdminUser(): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) redirect("/signin-with-chatgpt?return_to=%2Fadmin");
  const admin = await env.DB.prepare("SELECT email FROM admins WHERE lower(email) = lower(?)").bind(user.email).first();
  if (!admin) redirect("/admin-signup");
  return user;
}
