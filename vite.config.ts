import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// In development, serve /api/ai and /api/linkedin from the same handlers Vercel runs in production.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: "nevora-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/ai", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        const { handleAi } = (await server.ssrLoadModule("/api/_lib/handler.ts")) as typeof import("./api/_lib/handler");
        const result = await handleAi({ method: req.method ?? "GET", authorization: req.headers.authorization, body }, env);
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(result.body));
      });
      server.middlewares.use("/api/linkedin", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
        } catch {
          body = null;
        }
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const { handleLinkedIn } = (await server.ssrLoadModule("/api/_lib/linkedin.ts")) as typeof import("./api/_lib/linkedin");
        const result = await handleLinkedIn(
          {
            method: req.method ?? "GET",
            query: Object.fromEntries(url.searchParams),
            authorization: req.headers.authorization,
            cookie: req.headers.cookie,
            origin: `http://${req.headers.host}`,
            body,
          },
          env,
        );
        res.statusCode = result.status;
        for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
        if (result.status === 302) return res.end();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), devApi(env)],
    build: {
      target: "es2022",
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router"],
            firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          },
        },
      },
    },
  };
});
