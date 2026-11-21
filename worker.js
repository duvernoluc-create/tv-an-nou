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
      if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY || !env.MAILJET_FROM_EMAIL) {
        return new Response("Mailjet is not configured. Add MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL in Cloudflare Worker Secrets/Variables.", { status: 500 });
      }
      const cfg = JSON.parse((await env.KV.get("cfg")) || "{}");
      const logo = cfg.logo && cfg.logo.startsWith("data:image/") ? cfg.logo : "";
      const logoHtml = logo ? `<img src="${logo}" alt="${esc(cfg.name||"")}" style="max-width:180px;max-height:80px;display:block;margin:0 auto 20px">` : "";
      const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#202938;padding:24px">${logoHtml}<h2 style="text-align:center;color:#0b4fd1">${esc(cfg.name||"TV An Nou")}</h2><div style="white-space:pre-line;line-height:1.6">${esc(b.text||"")}</div><hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:13px;color:#667085;text-align:center">Sent by ${esc(cfg.name||"TV An Nou")} · <a href="${esc(new URL("/",req.url).href)}">Visit our website</a></p></div>`;
      const attachments = Array.isArray(b.attachments) ? b.attachments.map(a => ({
        ContentType: a.contentType || "image/jpeg",
        Filename: a.filename || "photo.jpg",
        Base64Content: a.content
      })) : [];
      const message = {
        From: { Email: env.MAILJET_FROM_EMAIL, Name: env.MAILJET_FROM_NAME || cfg.name || "TV An Nou" },
        To: [{ Email: b.to }],
        Subject: b.subject || "Message from TV An Nou",
        TextPart: b.text || "",
        HTMLPart: html
      };
      if (attachments.length) message.Attachments = attachments;
      const r = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(env.MAILJET_API_KEY + ":" + env.MAILJET_SECRET_KEY),
          "content-type": "application/json"
        },
        body: JSON.stringify({ Messages: [message] })
      });
      const body = await r.text();
      return new Response(body, { status: r.ok ? 200 : r.status, headers: J });
    }
    return new Response("Not found", { status: 404 });
  },
};
