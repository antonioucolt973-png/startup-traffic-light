import { aiCoachRequestSchema, aiCoachResponseSchema, type AiCoachRequest, type AiCoachResponse } from "./aiSchemas";
import { buildFallbackCoachResponse } from "./aiFallback";

export async function requestAiCoach(input: AiCoachRequest): Promise<AiCoachResponse> {
  const parsed = aiCoachRequestSchema.safeParse(input);
  if (!parsed.success) {
    return buildFallbackCoachResponse(input, "输入结构不完整，已改用本地规则建议。");
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
    return result.data;
  } catch {
    return buildFallbackCoachResponse(parsed.data);
  }
}
