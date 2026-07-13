import type { AiCoachData, AiCoachRequest, AiCoachResponse } from "./aiSchemas";

const fieldLabels = {
  audience: "具体对象",
  action: "现实行动",
  deadline: "完成时间",
  passCriteria: "通过标准",
  stopCriteria: "停止或调整标准",
} as const;

export function buildFallbackCoachResponse(request: AiCoachRequest, notice = "当前使用本地规则建议，核心流程不受模型状态影响。"): AiCoachResponse {
  return {
    schemaVersion: "1.0",
    mode: request.mode,
    source: "fallback",
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
    const questions = buildFollowupQuestions(request, missingFields);
    return {
      summary: request.answer?.trim()
        ? "已收到你的回答。红队只检查这段回答是否让方案更具体，不会替你编造用户证据。"
        : "先回答最关键的缺口，再决定是否修改方案。",
      questions,
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
