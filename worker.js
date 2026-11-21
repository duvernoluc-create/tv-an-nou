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
      const nm = esc(cfg.name || "TV An Nou");
      const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(cfg.logo || "");
      const logoHtml = m ? `<div style="text-align:center;padding:8px 0 28px"><img src="cid:logo" alt="${nm}" width="180" style="display:inline-block;max-width:180px;height:auto;border:0"></div>` : "";
      const body = esc(b.text || "").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b4fd1">$1</a>');
      const html = `<div style="background:#f4f6f9;padding:32px 12px"><div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#ffffff;border-radius:10px;padding:36px 32px;color:#202938"><div style="height:4px;background:#0b4fd1;border-radius:4px;margin:-36px -32px 32px"></div>${logoHtml}<div style="white-space:pre-line;font-size:16px;line-height:1.7">${body}</div></div></div>`;
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
      if (m) message.InlinedAttachments = [{ ContentType: m[1], Filename: "logo", ContentID: "logo", Base64Content: m[2] }];
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
