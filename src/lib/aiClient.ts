import { aiCoachRequestSchema, aiCoachResponseSchema, type AiCoachRequest, type AiCoachResponse } from "./aiSchemas";
import { buildFallbackCoachResponse } from "./aiFallback";

interface AiCoachRequestOptions {
  strategy?: "live-first" | "preset-only";
  cacheKey?: string;
}

const responseCache = new Map<string, AiCoachResponse>();

function readCachedResponse(cacheKey?: string) {
  if (!cacheKey) return undefined;
  const memory = responseCache.get(cacheKey);
  if (memory) return memory;
  try {
    const stored = sessionStorage.getItem(`opc-ai:${cacheKey}`);
    if (!stored) return undefined;
    const parsed = aiCoachResponseSchema.safeParse(JSON.parse(stored));
    if (!parsed.success) return undefined;
    responseCache.set(cacheKey, parsed.data);
    return parsed.data;
  } catch {
    return undefined;
  }
}

function cacheResponse(cacheKey: string | undefined, response: AiCoachResponse) {
  if (!cacheKey || response.source !== "ai") return;
  responseCache.set(cacheKey, response);
  try {
    sessionStorage.setItem(`opc-ai:${cacheKey}`, JSON.stringify(response));
  } catch {
    // 缓存不可用不应中断比赛流程。
  }
}

export async function requestAiCoach(input: AiCoachRequest, options: AiCoachRequestOptions = {}): Promise<AiCoachResponse> {
  const parsed = aiCoachRequestSchema.safeParse(input);
  if (!parsed.success) {
    return buildFallbackCoachResponse(input, "输入结构不完整，已改用本地规则建议。");
  }

  if (options.strategy === "preset-only") {
    return buildFallbackCoachResponse(parsed.data, "比赛预设案例已直接使用本地稳定数据，未发起模型请求。");
  }

  const cached = readCachedResponse(options.cacheKey);
  if (cached) return { ...cached, notice: "已复用本项目相同输入的AI分析结果。" };

  const endpointEnabled = import.meta.env.DEV || import.meta.env.PROD || import.meta.env.VITE_AI_ENDPOINT_ENABLED === "true";
  if (!endpointEnabled) {
    return buildFallbackCoachResponse(parsed.data, "当前为本地界面测试，已使用稳定规则生成内容。");
  }

  try {
    const response = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
    const body = await response.json();
    const result = aiCoachResponseSchema.safeParse(body);
    if (!result.success) throw new Error("AI response schema mismatch");
    cacheResponse(options.cacheKey, result.data);
    return result.data;
  } catch {
    return buildFallbackCoachResponse(parsed.data);
  }
}
