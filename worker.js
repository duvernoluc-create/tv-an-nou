const J = { "content-type": "application/json" };
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/api/config" && req.method === "GET") {
      return new Response((await env.KV.get("cfg")) || "null", { headers: J });
    }
    if (req.method !== "POST") return new Response("Not found", { status: 404 });
    let b = {};
    try { b = await req.json(); } catch (e) {}
    if (!env.ADMIN_PASSWORD || b.password !== env.ADMIN_PASSWORD) return new Response("Unauthorized", { status: 401 });
    if (u.pathname === "/api/auth") return new Response("ok");
    if (u.pathname === "/api/save") {
      await env.KV.put("cfg", JSON.stringify(b.cfg));
      return new Response("ok");
    }
    if (u.pathname === "/api/send") {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.FROM_EMAIL || "TV An Nou <onboarding@resend.dev>",
          to: [b.to], subject: b.subject, text: b.text,
          attachments: b.attachments && b.attachments.length ? b.attachments : undefined,
        }),
      });
      return new Response(await r.text(), { status: r.status });
    }
    return new Response("Not found", { status: 404 });
  },
};
