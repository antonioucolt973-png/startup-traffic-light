import { z } from "zod";

const shortText = z.string().trim().max(1200);
const aiModeSchema = z.enum(["assumption_breakdown", "plan_review", "red_team_followup", "task_personalization"]);
const aiCoachRequestSchema = z.object({
  mode: aiModeSchema,
  project: z.object({
    name: shortText,
    description: shortText,
    targetUser: shortText,
    painPoint: shortText,
    alternative: shortText,
    acquisition: shortText,
    monetization: shortText,
    currentStage: z.enum(["idea", "research", "demo", "mvp", "growth"]),
    existingArtifact: shortText,
    biggestUncertainty: shortText,
  }),
  evidence: z.object({
    interviewCount: z.number().min(0).max(100000),
    activeInterestCount: z.number().min(0).max(100000),
    trialCount: z.number().min(0).max(100000),
    paymentCount: z.number().min(0).max(100000),
    hasRetention: z.boolean(),
  }),
  gate: z.object({
    id: z.enum(["user", "pain", "alternative", "acquisition", "payment", "delivery"]),
    title: shortText,
    scene: shortText,
    currentEvidence: shortText,
  }).optional(),
  plan: z.object({
    audience: shortText,
    action: shortText,
    deadline: shortText,
    passCriteria: shortText,
    stopCriteria: shortText,
  }).optional(),
  previousQuestion: shortText.optional(),
  answer: shortText.optional(),
});
const aiCoachDataSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  questions: z.array(z.string().trim().min(1).max(300)).max(3),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(6),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
  revisedAction: z.string().trim().max(600).optional(),
});

type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;
type AiCoachData = z.infer<typeof aiCoachDataSchema>;

const fieldLabels = {
  audience: "具体对象",
  action: "现实行动",
  deadline: "完成时间",
  passCriteria: "通过标准",
  stopCriteria: "停止或调整标准",
} as const;

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

function buildFallbackCoachResponse(request: AiCoachRequest, notice = "当前使用本地规则建议，核心流程不受模型状态影响。") {
  return {
    schemaVersion: "1.0" as const,
    mode: request.mode,
    source: "fallback" as const,
    notice,
    data: buildFallbackData(request),
  };
}

function buildFallbackData(request: AiCoachRequest): AiCoachData {
  if (request.mode === "assumption_breakdown") {
    return {
      summary: "项目已经被拆成六类待验证假设。下面内容是验证方向，不是已经成立的事实。",
      questions: [],
      missingFields: [],
      suggestions: [
        `用户假设：${request.project.targetUser || "谁最频繁遇到这个问题"}`,
        `痛点假设：${request.project.painPoint || "问题发生频率、损失和现有处理成本"}`,
        `替代假设：${request.project.alternative || "用户当前为什么不会继续使用旧方法"}`,
        `获客假设：${request.project.acquisition || "第一批具体用户从哪里找到"}`,
        `付费假设：${request.project.monetization || "谁会为哪个结果付钱"}`,
        `交付假设：${request.project.existingArtifact || "一人七天内能展示的最小价值"}`,
      ],
    };
  }

  const plan = request.plan;
  const missingFields = plan
    ? (Object.entries(fieldLabels) as Array<[keyof typeof fieldLabels, string]>)
      .filter(([key]) => !plan[key].trim())
      .map(([, label]) => label)
    : Object.values(fieldLabels);

  if (request.mode === "plan_review") {
    return {
      summary: missingFields.length === 0
        ? "方案已经包含对象、行动、期限和判定门槛，可以进入低成本路测，但仍不能当作现实证据。"
        : `方案还缺少 ${missingFields.join("、")}，当前不能判断它是否真的可执行。`,
      questions: missingFields.slice(0, 2).map((field) => `请补充${field}，并写成明天可以直接执行的内容。`),
      missingFields,
      suggestions: buildPlanSuggestions(request),
    };
  }

  if (request.mode === "red_team_followup") {
    return {
      summary: request.answer?.trim()
        ? "已收到你的回答。红队只检查这段回答是否让方案更具体，不会替你编造用户证据。"
        : "先回答最关键的缺口，再决定是否修改方案。",
      questions: buildFollowupQuestions(request, missingFields),
      missingFields,
      suggestions: buildPlanSuggestions(request).slice(0, 2),
    };
  }

  return {
    summary: "任务已按当前灯号和最薄弱证据拆成低成本现实行动。",
    questions: [],
    missingFields,
    suggestions: buildPlanSuggestions(request),
  };
}

function buildPlanSuggestions(request: AiCoachRequest): string[] {
  const user = request.project.targetUser || "目标用户";
  const gate = request.gate?.title || "当前路口";
  return [
    `围绕${gate}，先列出 5 个可以在 48 小时内联系到的${user}。`,
    "行动必须产生访谈、试用、报价、付款或明确拒绝中的至少一种结果。",
    "提前写清楚通过门槛和停止门槛，避免得到模糊反馈后继续自我解释。",
  ];
}

function buildFollowupQuestions(request: AiCoachRequest, missingFields: string[]): string[] {
  if (missingFields.length > 0) return missingFields.slice(0, 2).map((field) => `${field}仍然不清楚，你准备怎么补上？`);
  if (!request.answer?.trim()) return [request.gate?.currentEvidence ? `这条方案如何补上「${request.gate.currentEvidence}」所暴露的缺口？` : "这项行动具体会产生什么可复核结果？"];
  if (!/\d|一|二|三|四|五|六|七|八|九|十/.test(request.answer)) return ["你的回答没有数量门槛。要联系几个人，出现多少次行为才算通过？"];
  if (!/停止|调整|放弃|少于|低于/.test(request.answer)) return ["如果结果不理想，你会在什么数字出现时停止或调整？"];
  return ["最后确认：完成后你会记录哪条真实行为，而不是只记录自己的感受？"];
}

const systemPrompt = `你是创业红绿灯的结构化教练。你只帮助用户拆假设、检查计划、进行红队追问和优化行动任务。
禁止预测创业成功率，禁止把计划、AI 推测或市场常识当成用户证据，禁止直接决定红黄绿蓝灯、投入上限或停止条件。
只输出 JSON 对象，不要 Markdown，不要解释。结构必须是：
{"summary":"不超过200字","questions":["最多3条"],"missingFields":["最多6项"],"suggestions":["最多6条"],"revisedAction":"可选，不超过300字"}`;
