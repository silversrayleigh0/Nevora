import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// In development, serve /api/ai from the same handler Vercel runs in production.
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
