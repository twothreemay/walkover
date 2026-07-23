import { app } from "@azure/functions";
import { clearSessionCookie, createSession, session, sessionCookie, verifyCredentials } from "../lib/auth.js";
app.http("authLogin", {
    methods: ["POST"], authLevel: "anonymous", route: "auth/login",
    handler: async (request) => {
        const body = await request.json();
        if (!body.username || !body.password || !(await verifyCredentials(body.username, body.password))) {
            return { status: 401, jsonBody: { error: "Invalid username or password" } };
        }
        return {
            jsonBody: { authenticated: true, username: body.username },
            headers: { "set-cookie": sessionCookie(createSession(body.username)), "cache-control": "no-store" }
        };
    }
});
app.http("authSession", {
    methods: ["GET"], authLevel: "anonymous", route: "auth/session",
    handler: async (request) => {
        const current = session(request);
        return current
            ? { jsonBody: { authenticated: true, username: current.username }, headers: { "cache-control": "no-store" } }
            : { status: 401, jsonBody: { authenticated: false }, headers: { "cache-control": "no-store" } };
    }
});
app.http("authLogout", {
    methods: ["POST"], authLevel: "anonymous", route: "auth/logout",
    handler: async () => ({
        status: 204, headers: { "set-cookie": clearSessionCookie(), "cache-control": "no-store" }
    })
});
//# sourceMappingURL=auth.js.map