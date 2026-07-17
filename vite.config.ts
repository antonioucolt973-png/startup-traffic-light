import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import aiCoachHandler from "./api/ai/coach.ts";

function localAiApi(): Plugin {
  return {
    name: "local-ai-api",
    configureServer(server) {
      server.middlewares.use("/api/ai/coach", async (request, response) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const rawBody = Buffer.concat(chunks).toString("utf8");
          const body = rawBody ? JSON.parse(rawBody) : undefined;
          let statusCode = 200;
          const apiResponse = {
            status(code: number) {
              statusCode = code;
              return apiResponse;
            },
            json(payload: unknown) {
              response.statusCode = statusCode;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.end(JSON.stringify(payload));
            },
            setHeader(name: string, value: string) {
              response.setHeader(name, value);
            },
          };
          await aiCoachHandler({ method: request.method, body }, apiResponse);
        } catch {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "请求体不是有效 JSON。" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), localAiApi()],
  };
});
