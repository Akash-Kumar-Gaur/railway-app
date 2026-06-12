import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import http from "http";

let cachedToken = null;

async function getToken() {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.access_token;
  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     process.env.OPENSKY_CLIENT_ID,
        client_secret: process.env.OPENSKY_CLIENT_SECRET,
      }),
    }
  );
  const d = await res.json();
  cachedToken = { access_token: d.access_token, expires_at: Date.now() + 270_000 };
  return cachedToken.access_token;
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  try {
    const token    = await getToken();
    const url      = new URL(req.url, "http://localhost");
    const target   = `https://opensky-network.org/api/states/all${url.search}`;
    const upstream = await fetch(target, { headers: { Authorization: `Bearer ${token}` } });
    const text     = await upstream.text();
    const left     = upstream.headers.get("X-Rate-Limit-Remaining");
    if (left) res.setHeader("X-Rate-Limit-Remaining", left);
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(process.env.PORT || 3000);