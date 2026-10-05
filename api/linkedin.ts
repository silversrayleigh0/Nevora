import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleLinkedIn } from "./_lib/linkedin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? "https";
  const result = await handleLinkedIn(
    {
      method: req.method ?? "GET",
      query,
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
      origin: `${proto}://${req.headers["x-forwarded-host"] ?? req.headers.host}`,
      body: req.body,
    },
    process.env,
  );
  for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
  if (result.status === 302) return res.status(302).end();
  res.setHeader("Cache-Control", "no-store");
  res.status(result.status).json(result.body);
}
