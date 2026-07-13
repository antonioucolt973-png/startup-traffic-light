import { aiCoachDataSchema, aiCoachRequestSchema } from "../../src/lib/aiSchemas.ts";
import { buildFallbackCoachResponse } from "../../src/lib/aiFallback.ts";

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "只支持 POST 请求。" });
    return;
  }

  const parsed = aiCoachRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "请求结构不符合 AI 教练契约。" });
    return;
  }

  const enabled = process.env.AI_ENABLED === "true";
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!enabled || !apiKey || !model) {
    response.status(200).json(buildFallbackCoachResponse(parsed.data, "AI 未启用，当前使用可复现的本地规则建议。"));
    return;
  }

  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const timeoutMs = Math.min(20000, Math.max(3000, Number(process.env.AI_TIMEOUT_MS) || 10000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(parsed.data) },
        ],
      }),
      signal: controller.signal,
    });
    if (!completion.ok) throw new Error(`provider status ${completion.status}`);
    const payload = await completion.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty provider response");
    const clean = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const data = aiCoachDataSchema.parse(JSON.parse(clean));
    response.status(200).json({ schemaVersion: "1.0", mode: parsed.data.mode, source: "ai", data });
  } catch {
    response.status(200).json(buildFallbackCoachResponse(parsed.data, "模型调用失败，已自动切换本地规则建议。"));
  } finally {
    clearTimeout(timer);
  }
}

const systemPrompt = `你是创业红绿灯的结构化教练。你只帮助用户拆假设、检查计划、进行红队追问和优化行动任务。
禁止预测创业成功率，禁止把计划、AI 推测或市场常识当成用户证据，禁止直接决定红黄绿蓝灯、投入上限或停止条件。
只输出 JSON 对象，不要 Markdown，不要解释。结构必须是：
{"summary":"不超过200字","questions":["最多3条"],"missingFields":["最多6项"],"suggestions":["最多6条"],"revisedAction":"可选，不超过300字"}`;
