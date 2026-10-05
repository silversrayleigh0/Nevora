import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAi } from "./_lib/handler.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await handleAi(
    { method: req.method ?? "GET", authorization: req.headers.authorization, body: req.body },
    process.env,
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(result.status).json(result.body);
}
