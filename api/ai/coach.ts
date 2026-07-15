import { aiCoachDataSchema, aiCoachRequestSchema, type AiCoachRequest } from "../../src/lib/aiSchemas.ts";
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
    response.status(400).json({ error: "请求结构不符合AI教练契约。" });
    return;
  }

  const enabled = process.env.AI_ENABLED === "true";
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!enabled || !apiKey || !model) {
    response.status(200).json(buildFallbackCoachResponse(parsed.data, "AI未启用，当前使用可复现的本地拆解。"));
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
        max_tokens: parsed.data.mode === "project_intake" ? 1200 : 800,
        messages: [
          { role: "system", content: systemPrompt(parsed.data.mode) },
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
    response.status(200).json(buildFallbackCoachResponse(parsed.data, "模型调用失败，已自动切换本地拆解。"));
  } finally {
    clearTimeout(timer);
  }
}

function systemPrompt(mode: AiCoachRequest["mode"]) {
  const intakeInstruction = mode === "project_intake"
    ? `当前任务是把用户的一段创业想法拆成 projectDraft。必须输出 name、description、targetUser、painPoint、alternative、acquisition、monetization、currentStage、existingArtifact、biggestUncertainty。信息不足时做保守假设，并把最多3个关键澄清问题放进 questions。`
    : mode === "route_options"
      ? "当前任务是生成3条差异明确、低成本、可证伪的 routeOptions。每条必须包含对象、行动、期限、通过和停止标准。"
      : mode === "survey_generation"
        ? "当前任务是生成 surveyDraft，包含3至8个问题，只问现实经历、频率、替代方式和行动意愿，禁止询问用户是否喜欢创意。"
        : mode === "evidence_review"
          ? "当前任务是根据系统提供的聚合答卷信息生成谨慎的证据候选摘要。必须指出样本限制，禁止把兴趣推断成试用或付费。"
          : mode === "task_decomposition"
            ? "当前任务是生成严格7条 taskDrafts，对应第1至第7天。每条任务必须产生外部结果，包含行动、通过和停止标准，不得安排继续开发完整产品。"
            : mode === "cycle_review"
              ? "当前任务是生成 cycleReview。根据本轮任务结果、证据增量和规则建议，总结进展、风险变化与下一轮唯一目标。不得改变规则建议，不得把任务完成当成证据。"
            : "当前任务是拆假设、检查计划、红队追问或优化现实任务。";

  return `你是「OPC创业红绿灯」的AI路线规划员。${intakeInstruction}
禁止预测创业成功率，禁止把AI推测、计划或市场常识当成现实证据，禁止决定红黄绿蓝灯、投入上限或停止条件。
你的价值是把简单描述加工成结构化项目、低成本任务和可证伪标准，而不是复述用户输入。
只输出JSON对象，不要Markdown。结构必须符合：
{"summary":"不超过600字","questions":["最多3条"],"missingFields":["最多6项"],"suggestions":["最多6条"],"revisedAction":"可选","projectDraft":{"name":"项目名","description":"项目描述","targetUser":"目标用户","painPoint":"痛点","alternative":"替代方案","acquisition":"首批用户来源","monetization":"付费假设","currentStage":"idea|research|demo|mvp|growth","existingArtifact":"已有成果","biggestUncertainty":"最大不确定性"},"routeOptions":[{"title":"路线名","rationale":"理由","audience":"对象","action":"行动","deadline":"期限","passCriteria":"通过标准","stopCriteria":"停止标准"}],"surveyDraft":{"title":"问卷名","introduction":"说明","questions":[{"id":"英文标识","prompt":"问题","type":"single_choice|multiple_choice|short_text|long_text|scale","required":true,"options":[]}]},"taskDrafts":[{"day":1,"title":"任务名","detail":"行动","passCriteria":"通过标准","stopCriteria":"停止标准"}],"cycleReview":{"summary":"本轮总结","achievements":["最多4项"],"riskChanges":["最多4项"],"nextGoal":"下一轮唯一目标","rationale":"安排原因"}}`;
}
