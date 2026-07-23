import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
const COOKIE_NAME = "twinplaces_session";
const SESSION_SECONDS = 8 * 60 * 60;
function required(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} is not configured`);
    if (name === "SESSION_SECRET" && value.length < 32)
        throw new Error("SESSION_SECRET must contain at least 32 characters");
    return value;
}
function encode(value) {
    return Buffer.from(value).toString("base64url");
}
function signature(payload) {
    return createHmac("sha256", required("SESSION_SECRET")).update(payload).digest("base64url");
}
function readCookie(request) {
    const cookie = request.headers.get("cookie") || "";
    return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || "";
}
export function createSession(username) {
    const payload = encode(JSON.stringify({ username, expiresAt: Date.now() + SESSION_SECONDS * 1000 }));
    return `${payload}.${signature(payload)}`;
}
export function session(request) {
    const [payload, supplied] = readCookie(request).split(".");
    if (!payload || !supplied)
        return null;
    const expected = signature(payload);
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b))
        return null;
    try {
        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return parsed.username && parsed.expiresAt > Date.now() ? parsed : null;
    }
    catch {
        return null;
    }
}
export async function verifyCredentials(username, password) {
    const configured = required("ADMIN_USERNAME");
    const left = Buffer.from(username);
    const right = Buffer.from(configured);
    const usernameMatches = left.length === right.length && timingSafeEqual(left, right);
    if (!usernameMatches)
        return false;
    try {
        return await bcrypt.compare(password, required("ADMIN_PASSWORD_HASH"));
    }
    catch {
        return false;
    }
}
export function sessionCookie(value) {
    return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}
export function clearSessionCookie() {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
export function adminRequired(request) {
    return session(request) ? null : { status: 401, jsonBody: { error: "Administrator session required" } };
}
export function adminName(request) {
    return session(request)?.username || "admin";
}
//# sourceMappingURL=auth.js.map