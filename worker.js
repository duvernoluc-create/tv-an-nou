const J = { "content-type": "application/json" };
const esc = (s="") => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/api/config" && req.method === "GET") {
      return new Response((await env.KV.get("cfg")) || "null", { headers: J });
    }
    if (req.method !== "POST") return new Response("Not found", { status: 404 });
    let b = {};
    try { b = await req.json(); } catch {}
    if (!env.ADMIN_PASSWORD || b.password !== env.ADMIN_PASSWORD) return new Response("Unauthorized", { status: 401 });
    if (u.pathname === "/api/auth") return new Response("ok");
    if (u.pathname === "/api/save") {
      await env.KV.put("cfg", JSON.stringify(b.cfg));
      return new Response("ok");
    }
    if (u.pathname === "/api/send") {
      const cfg = JSON.parse((await env.KV.get("cfg")) || "{}");
      const logo = cfg.logo && cfg.logo.startsWith("data:image/") ? cfg.logo : "";
      const logoHtml = logo ? `<img src="${logo}" alt="${esc(cfg.name||"")}" style="max-width:180px;max-height:80px;display:block;margin:0 auto 20px">` : "";
      const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#202938;padding:24px">${logoHtml}<h2 style="text-align:center;color:#0b4fd1">${esc(cfg.name||"")}</h2><div style="white-space:pre-line;line-height:1.6">${esc(b.text||"")}</div><hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:13px;color:#667085;text-align:center">Sent by ${esc(cfg.name||"")} · <a href="${esc(new URL("/",req.url).href)}">Visit our website</a></p></div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.FROM_EMAIL || "TV An Nou <onboarding@resend.dev>",
          to: [b.to], subject: b.subject, text: b.text, html,
          attachments: b.attachments && b.attachments.length ? b.attachments : undefined,
        }),
      });
      return new Response(await r.text(), { status: r.status });
    }
    return new Response("Not found", { status: 404 });
  },
};
