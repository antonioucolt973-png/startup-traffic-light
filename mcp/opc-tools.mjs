import * as z from "zod/v4";
import { enhanceMcpOutput } from "./mimo-client.mjs";

const shortText = z.string().trim().min(1).max(1200);
const optionalText = z.string().trim().max(1200).optional();

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function registerOpcTools(server) {
  server.registerTool(
    "opc_clarify_and_analyze",
    {
      title: "理清并分析创业想法",
      description: "通过最多三轮理清，把模糊创业想法整理为目标用户、核心问题、替代方案、已知事实、待验证假设和最大风险。不会预测成功率或决定红黄绿灯。",
      inputSchema: {
        idea: shortText.describe("创业想法的完整描述，至少说明想帮助谁解决什么问题"),
        round: z.number().int().min(1).max(3).default(1).describe("当前理清轮次，取值 1 到 3"),
        history: z.array(z.object({
          question: z.string().trim().min(1).max(300),
          answer: z.string().trim().min(1).max(800),
        })).max(6).default([]).describe("之前已经发生的理清问答"),
        goal: optionalText.describe("本轮最希望先确认的目标"),
        resources: optionalText.describe("当前可用时间、预算、人脉或 Demo"),
      },
      outputSchema: {
        projectSummary: z.string(),
        round: z.number().int(),
        clarificationStatus: z.enum(["needs_input", "ready"]),
        analysis: z.object({
          targetUser: z.string(),
          coreProblem: z.string(),
          currentAlternative: z.string(),
          biggestRisk: z.string(),
          knownFacts: z.array(z.string()),
          assumptions: z.array(z.string()),
        }),
        question: z.string().nullable(),
        nextAction: z.string(),
        boundary: z.string(),
      },
      annotations: toolAnnotations,
    },
    async (input) => toolResult(await enhanceMcpOutput("opc_clarify_and_analyze", input, clarifyAndAnalyze(input))),
  );

  server.registerTool(
    "opc_generate_routes",
    {
      title: "生成三条验证路线",
      description: "针对当前最大风险生成三条差异化、低成本、可证伪的现实验证路线。每条路线包含对象、动作、期限、成本、通过标准与停止标准。",
      inputSchema: {
        projectSummary: shortText.describe("已经理清过的项目摘要"),
        focus: shortText.describe("当前最需要验证的风险或目标"),
        resources: optionalText.describe("可用时间、预算、人脉、渠道和 Demo"),
      },
      outputSchema: {
        focus: z.string(),
        routes: z.array(z.object({
          id: z.enum(["A", "B", "C"]),
          type: z.enum(["interview", "signal_test", "concierge_trial"]),
          title: z.string(),
          rationale: z.string(),
          audience: z.string(),
          action: z.string(),
          deadline: z.string(),
          estimatedCost: z.string(),
          difficulty: z.enum(["low", "medium"]),
          passCriteria: z.string(),
          stopCriteria: z.string(),
        })).length(3),
        recommendation: z.string(),
        boundary: z.string(),
      },
      annotations: toolAnnotations,
    },
    async (input) => toolResult(await enhanceMcpOutput("opc_generate_routes", input, generateRoutes(input))),
  );

  server.registerTool(
    "opc_intersection_decision",
    {
      title: "路口决策辅导",
      description: "针对用户、痛点、替代方案、获客、付费或交付路口，区分事实与假设，判断应该继续、修改方案还是补充证据。",
      inputSchema: {
        gate: z.enum(["user", "pain", "alternative", "acquisition", "payment", "delivery"]).describe("当前路口类型"),
        project: shortText.describe("项目摘要"),
        answer: shortText.describe("用户对当前路口问题的回答"),
        currentEvidence: optionalText.describe("目前已有的访谈、试用、付款或复用证据"),
      },
      outputSchema: {
        gate: z.string(),
        gateTitle: z.string(),
        decision: z.enum(["proceed", "revise", "collect_more"]),
        summary: z.string(),
        verifiedFacts: z.array(z.string()),
        assumptions: z.array(z.string()),
        risks: z.array(z.string()),
        recommendedAction: z.string(),
        followUpQuestion: z.string(),
        boundary: z.string(),
      },
      annotations: toolAnnotations,
    },
    async (input) => toolResult(await enhanceMcpOutput("opc_intersection_decision", input, intersectionDecision(input))),
  );

  server.registerTool(
    "opc_generate_tasks",
    {
      title: "生成可执行验证任务",
      description: "把选定验证路线拆成 1 到 7 天内可完成的现实任务，明确动作、交付物、工具、证据提交方式、通过标准和停止标准。",
      inputSchema: {
        route: shortText.describe("已经选定的验证路线"),
        audience: shortText.describe("需要接触的目标用户"),
        constraints: optionalText.describe("时间、预算、渠道、Demo 等限制"),
        days: z.number().int().min(1).max(7).default(3).describe("任务周期，1 到 7 天"),
      },
      outputSchema: {
        objective: z.string(),
        tasks: z.array(z.object({
          day: z.number().int(),
          title: z.string(),
          action: z.string(),
          tool: z.string(),
          deliverable: z.string(),
          evidenceSubmission: z.array(z.string()),
          estimatedMinutes: z.number().int(),
          passCriteria: z.string(),
          stopCriteria: z.string(),
        })).min(1).max(7),
        successDefinition: z.string(),
        boundary: z.string(),
      },
      annotations: toolAnnotations,
    },
    async (input) => toolResult(await enhanceMcpOutput("opc_generate_tasks", input, generateTasks(input))),
  );

  server.registerTool(
    "opc_evaluate_evidence",
    {
      title: "评估证据并生成复盘",
      description: "依据真实访谈、主动反馈、试用、付款和复用行为评估证据强度，指出缺口并生成下一步与阶段复盘。计划、浏览量和口头称赞不会被当作强证据。",
      inputSchema: {
        project: shortText.describe("项目或当前验证目标"),
        interviews: z.number().int().min(0).max(100000).default(0),
        activeInterest: z.number().int().min(0).max(100000).default(0).describe("主动留资、预约、转介绍等行为数量"),
        trials: z.number().int().min(0).max(100000).default(0),
        payments: z.number().int().min(0).max(100000).default(0),
        retention: z.boolean().default(false).describe("是否出现复用、持续使用或主动推荐"),
        completedTasks: z.number().int().min(0).max(1000).default(0),
        notes: optionalText.describe("证据说明、用户原话或遇到的困难"),
      },
      outputSchema: {
        evidenceStrength: z.enum(["weak", "emerging", "strong"]),
        observedSignals: z.array(z.string()),
        evidenceGaps: z.array(z.string()),
        nextAction: z.string(),
        review: z.object({
          summary: z.string(),
          achievements: z.array(z.string()),
          riskChanges: z.array(z.string()),
          nextGoal: z.string(),
        }),
        boundary: z.string(),
      },
      annotations: toolAnnotations,
    },
    async (input) => toolResult(await enhanceMcpOutput("opc_evaluate_evidence", input, evaluateEvidence(input))),
  );
}

function clarifyAndAnalyze({ idea, round, history, goal, resources }) {
  const combined = [idea, ...history.map((item) => item.answer)].join(" ");
  const targetUser = inferTargetUser(combined);
  const coreProblem = inferProblem(combined);
  const currentAlternative = inferAlternative(combined);
  const questions = [
    `最近一次遇到“${coreProblem}”的${targetUser}，现在具体用什么方式解决？`,
    `如果不使用你的方案，${targetUser}会损失多少时间、金钱或机会？请给出最近一次真实经历。`,
    `未来 48 小时内，你能接触哪 5 位${targetUser}，并让他们完成什么可观察行为？`,
  ];
  const enoughHistory = history.length >= round || history.some((item) => item.answer.trim().length >= 30);
  const ready = round >= 3 || (history.length >= 2 && enoughHistory);
  const resourceRisk = resources?.trim()
    ? `当前资源约束是“${compact(resources, 90)}”，最大风险仍是用户是否会采取真实行动。`
    : "最大风险是只有创意描述，没有可复核的用户行为证据。";

  return {
    projectSummary: compact(`${idea}${goal ? `；本轮目标：${goal}` : ""}`, 360),
    round,
    clarificationStatus: ready ? "ready" : "needs_input",
    analysis: {
      targetUser,
      coreProblem,
      currentAlternative,
      biggestRisk: resourceRisk,
      knownFacts: ["目前唯一确定的信息来自创业者输入，尚未自动视为市场事实。", ...history.map((item) => `用户回答：${compact(item.answer, 120)}`).slice(-3)],
      assumptions: [
        `${targetUser}确实高频遇到该问题。`,
        `现有替代方式“${currentAlternative}”不够满意。`,
        "目标用户愿意通过留资、试用、预约或付费表达真实意愿。",
      ],
    },
    question: ready ? null : questions[Math.min(round - 1, questions.length - 1)],
    nextAction: ready ? "进入路线生成，优先验证用户是否会采取真实行动。" : "请回答本轮问题，再携带历史问答调用下一轮。",
    boundary: "这是可验证的分析摘要，不展示模型内部逐字推理，也不预测创业成功率。",
  };
}

function generateRoutes({ projectSummary, focus, resources }) {
  const audience = inferTargetUser(projectSummary);
  const constraint = resources?.trim() || "一人、低预算、已有简单说明或 Demo";
  const paymentFocus = /付费|价格|购买|订阅|收入/.test(focus);
  return {
    focus: compact(focus, 180),
    routes: [
      {
        id: "A",
        type: "interview",
        title: "真实经历访谈路线",
        rationale: "先确认问题是否真实发生，避免用偏好问题制造虚假积极反馈。",
        audience: `5 位最近 30 天内遇到该问题的${audience}`,
        action: "逐一询问最近一次经历、现有解决方式、实际损失和已经采取的行动，并记录原话。",
        deadline: "48 小时内",
        estimatedCost: "0—50 元",
        difficulty: "low",
        passCriteria: "至少 3 人描述相似场景，其中至少 2 人主动要求了解下一步。",
        stopCriteria: "接触 10 人后少于 2 人承认问题真实发生，重新定义用户或问题。",
      },
      {
        id: "B",
        type: "signal_test",
        title: paymentFocus ? "价格与预约信号测试" : "公开招募与留资测试",
        rationale: "用可观察行为代替口头称赞，验证用户是否愿意留下下一步承诺。",
        audience: `能通过社群、内容平台或熟人渠道触达的${audience}`,
        action: paymentFocus ? "展示明确结果、交付范围和两个价格选项，只统计预约、订金或报价接受。" : "发布一页说明或招募信息，只统计主动私信、留资、预约或转介绍。",
        deadline: "3 天内",
        estimatedCost: "0—100 元",
        difficulty: "low",
        passCriteria: paymentFocus ? "至少 3 人接受继续沟通价格，其中至少 1 人愿意支付订金或预约。" : "获得至少 5 个有效触达中的 3 个主动后续行为。",
        stopCriteria: "有效触达 50 人仍无主动行为，修改价值表达、入口或目标用户。",
      },
      {
        id: "C",
        type: "concierge_trial",
        title: "人工代办最小试用路线",
        rationale: "不用继续开发完整产品，先手动交付一次核心结果。",
        audience: `2—3 位愿意提供过程反馈的${audience}`,
        action: `在“${compact(constraint, 80)}”约束下，人工完成一次最核心结果，记录耗时、阻力和复用意愿。`,
        deadline: "7 天内",
        estimatedCost: "0—300 元",
        difficulty: "medium",
        passCriteria: "至少 2 人完成试用，且至少 1 人愿意继续使用、转介绍或讨论付费。",
        stopCriteria: "单次人工交付成本超过可承受上限，缩小承诺范围或暂停开发。",
      },
    ],
    recommendation: "资源有限时优先选择路线 A；已有可演示结果时优先选择路线 C。",
    boundary: "路线是待执行的商业假设，不是市场结论；只有完成行动后产生的外部行为才算证据。",
  };
}

function intersectionDecision({ gate, project, answer, currentEvidence }) {
  const gateInfo = {
    user: ["目标用户", "用户范围是否具体到可以在 48 小时内找到真人？"],
    pain: ["核心痛点", "问题是否来自最近发生的真实经历，而不是泛泛偏好？"],
    alternative: ["替代方案", "用户目前是否已经投入时间或金钱解决问题？"],
    acquisition: ["获客入口", "首批用户是否有明确、低成本、可重复的触达入口？"],
    payment: ["付费阻力", "是否出现报价接受、订金、付款或明确预算信号？"],
    delivery: ["交付压力", "核心结果能否先用人工或最小 Demo 稳定交付？"],
  }[gate];
  const evidence = currentEvidence?.trim() || "未提供可复核证据";
  const hasBehavior = /访谈|试用|付款|订金|预约|留资|复用|转介绍|截图|录音|订单|数据/.test(`${answer} ${evidence}`);
  const hasNumbers = /\d/.test(`${answer} ${evidence}`);
  const vague = answer.trim().length < 25 || /大家|所有人|应该|可能|我觉得|肯定/.test(answer);
  const decision = hasBehavior && hasNumbers ? "proceed" : vague ? "revise" : "collect_more";
  const actionByDecision = {
    proceed: `保留当前${gateInfo[0]}定义，用一次更强行为验证它，避免直接扩大投入。`,
    revise: `把回答改写为“具体对象 + 最近场景 + 已发生行为”，再重新回答${gateInfo[0]}路口。`,
    collect_more: `在 48 小时内补充 3—5 个真实样本，并记录数量、原话和下一步行为。`,
  };

  return {
    gate,
    gateTitle: gateInfo[0],
    decision,
    summary: compact(`项目“${project}”在${gateInfo[0]}路口的回答为：${answer}`, 360),
    verifiedFacts: hasBehavior ? [`已提供行为线索：${compact(evidence, 160)}`] : ["暂未发现可以复核的外部行为证据。"],
    assumptions: [`${gateInfo[0]}定义仍需要更多样本交叉确认。`, "创业者描述不等同于用户事实。"],
    risks: vague ? ["用户或场景表述过宽，后续任务无法准确触达。"] : ["样本量可能不足，单个积极反馈不能代表市场。"],
    recommendedAction: actionByDecision[decision],
    followUpQuestion: gateInfo[1],
    boundary: "决策只建议下一步验证动作，不替代网页规则引擎的灯号、预算和停止条件。",
  };
}

function generateTasks({ route, audience, constraints, days }) {
  const templates = [
    ["建立目标名单", `列出至少 20 位符合“${compact(audience, 80)}”条件的人，并标记可触达方式。`, "名单表格", "目标用户名单与联系方式来源", ["上传文件", "粘贴名单摘要"]],
    ["准备非诱导问题", "编写 5 个只询问最近真实经历、现有做法和实际损失的问题。", "访谈提纲", "可直接使用的访谈问题", ["上传文件", "粘贴文本"]],
    ["完成首轮触达", "联系目标用户并完成至少 3 次真实沟通，不介绍完整解决方案。", "私信或访谈", "沟通记录、用户原话和下一步行为", ["上传截图", "上传录音", "粘贴数据"]],
    ["交付最小体验", `围绕路线“${compact(route, 100)}”完成一次人工或 Demo 体验。`, "现有 Demo 或人工服务", "试用过程记录和完成结果", ["上传截图", "上传文件", "上传录音"]],
    ["提出行动请求", "向体验者提出预约、留资、转介绍、报价确认或订金请求。", "预约或支付入口", "用户是否采取行动的记录", ["上传截图", "粘贴数据"]],
    ["回访与反证", "回访未行动和已行动用户，分别记录阻力、复用意愿和停止原因。", "回访问卷", "正反两类反馈摘要", ["上传文件", "粘贴文本"]],
    ["汇总证据", "只汇总已经发生的访谈、试用、付款、复用和转介绍，不把计划算作证据。", "证据表", "结构化证据清单", ["上传文件", "粘贴数据"]],
  ];
  const count = Math.max(1, Math.min(days, templates.length));
  const selected = templates.slice(0, count).map((item, index) => ({
    day: index + 1,
    title: item[0],
    action: `${item[1]}${constraints ? ` 约束：${compact(constraints, 100)}。` : ""}`,
    tool: item[2],
    deliverable: item[3],
    evidenceSubmission: item[4],
    estimatedMinutes: [30, 45, 120, 180, 45, 60, 45][index],
    passCriteria: index < 2 ? "产出物完整且可以立即执行下一任务。" : "至少产生一个可复核的外部用户行为或明确反证。",
    stopCriteria: "无法接触真实目标用户或需要继续开发完整产品时，暂停并缩小任务。",
  }));
  return {
    objective: `在 ${count} 天内用真实用户行为验证路线“${compact(route, 160)}”。`,
    tasks: selected,
    successDefinition: "任务完成不等于验证成功；至少获得访谈、主动留资、试用、付款或复用中的一种外部证据。",
    boundary: "任务强调可执行性和证据提交，不要求继续开发完整产品。",
  };
}

function evaluateEvidence({ project, interviews, activeInterest, trials, payments, retention, completedTasks, notes }) {
  const observedSignals = [];
  if (interviews > 0) observedSignals.push(`完成 ${interviews} 次目标用户访谈。`);
  if (activeInterest > 0) observedSignals.push(`出现 ${activeInterest} 次主动留资、预约或转介绍。`);
  if (trials > 0) observedSignals.push(`完成 ${trials} 次真实试用或人工体验。`);
  if (payments > 0) observedSignals.push(`出现 ${payments} 次付款、订金或报价接受。`);
  if (retention) observedSignals.push("出现复用、持续使用或主动推荐信号。");
  const evidenceGaps = [];
  if (interviews < 5) evidenceGaps.push("补足至少 5 次目标用户访谈，并记录最近真实经历。");
  if (activeInterest < 3) evidenceGaps.push("需要更多主动留资、预约或转介绍，而不是口头称赞。");
  if (trials < 2) evidenceGaps.push("至少让 2 位目标用户完成真实试用或人工体验。");
  if (payments < 1) evidenceGaps.push("尚未验证付款、订金或报价接受信号。");
  if (!retention && trials > 0) evidenceGaps.push("回访试用者是否愿意继续使用、复用或推荐。");
  const strong = payments >= 1 && trials >= 2 && (retention || activeInterest >= 3);
  const emerging = !strong && (interviews >= 3 || activeInterest >= 1 || trials >= 1);
  const evidenceStrength = strong ? "strong" : emerging ? "emerging" : "weak";
  const nextAction = evidenceGaps[0] || "保留当前验证范围，再用不同渠道重复一次，检查结果是否可复现。";
  return {
    evidenceStrength,
    observedSignals: observedSignals.length > 0 ? observedSignals : ["目前只有计划或主观描述，尚未出现外部行为证据。"],
    evidenceGaps,
    nextAction,
    review: {
      summary: `项目“${compact(project, 160)}”已完成 ${completedTasks} 项任务，当前证据强度为 ${evidenceStrength}。${notes ? ` 补充说明：${compact(notes, 160)}` : ""}`,
      achievements: observedSignals.slice(0, 4),
      riskChanges: evidenceGaps.slice(0, 4),
      nextGoal: nextAction,
    },
    boundary: "此处只评估证据强度，不直接决定红黄绿灯、投入上限或创业成功率；最终状态由网页规则引擎计算。",
  };
}

function inferTargetUser(text) {
  if (/网购|服装|衣服|试衣|穿搭/.test(text)) return "经常网购服装、担心上身效果的消费者";
  if (/学生|大学生|校园/.test(text)) return "有明确场景的学生用户";
  if (/企业|公司|团队|商家|门店/.test(text)) return "存在明确业务流程问题的企业或商家用户";
  if (/家长|孩子|儿童/.test(text)) return "正在处理相关问题的家长用户";
  return "最接近该问题、且能在 48 小时内接触到的具体用户";
}

function inferProblem(text) {
  if (/试衣|上身|穿搭|衣服/.test(text)) return "购买前无法可靠判断衣服上身效果";
  const match = text.match(/(?:解决|帮助|避免|减少|提高)([^，。；]{4,60})/);
  return match?.[1]?.trim() || "现有解决方式成本高、效率低或结果不确定";
}

function inferAlternative(text) {
  if (/试衣|上身|穿搭|衣服/.test(text)) return "买家秀、内容测评、朋友建议、到店试穿或下单后退货";
  if (/表格|Excel/.test(text)) return "电子表格和人工整理";
  return "人工处理、搜索比较、熟人建议或暂时忍受问题";
}

function compact(value, maxLength) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

function toolResult(structuredContent) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}
