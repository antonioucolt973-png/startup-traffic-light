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
  if (request.mode === "project_intake") {
    const idea = request.idea?.trim() || request.project.description.trim();
    const draft = inferProjectDraft(idea, request.project);
    return {
      summary: "已经把你的描述整理成一辆可上路的项目车。下面仍是假设，请确认后再进入现实验证。",
      questions: buildIntakeQuestions(draft),
      missingFields: [],
      suggestions: [
        `先验证「${draft.targetUser}」是否真的频繁遇到这个问题。`,
        `本轮最大不确定性：${draft.biggestUncertainty}`,
        "确认后，系统会按需求、交易和交付拆成六个现实路口。",
      ],
      projectDraft: draft,
    };
  }

  if (request.mode === "route_options") {
    const gate = request.gate?.title || "当前路口";
    const user = request.project.targetUser || "目标用户";
    return {
      summary: `围绕${gate}生成了3条不同成本的现实路线。任选一条继续修改，选择不等于获得证据。`,
      questions: [],
      missingFields: [],
      suggestions: [],
      routeOptions: [
        {
          title: "最快接触真实用户",
          rationale: "优先获得直接反馈，避免继续在内部打磨。",
          audience: `5位可以在48小时内联系到的${user}`,
          action: `逐一发送一段问题描述，邀请进行15分钟访谈，追问最近一次真实经历和现有解决方式。`,
          deadline: "48小时内",
          passCriteria: "5人中至少3人能讲出近期发生的具体问题经历",
          stopCriteria: "少于2人承认问题真实发生时，重新定义用户或问题",
        },
        {
          title: "用轻量问卷筛选样本",
          rationale: "适合暂时没有访谈名单的创始人。",
          audience: `至少20位可能符合条件的${user}`,
          action: "发布一份不超过6题的筛选问卷，再邀请高痛点回答者继续访谈。",
          deadline: "3天内",
          passCriteria: "获得10份有效答卷，其中至少3人愿意留下联系方式",
          stopCriteria: "触达50人仍少于5份有效答卷时，调整渠道或表述",
        },
        {
          title: "用最小演示测试行动",
          rationale: "不问用户喜不喜欢，只看是否愿意试用或预约。",
          audience: `3至5位问题最明显的${user}`,
          action: "展示一页说明、截图或人工服务流程，邀请对方完成一次试用或预约。",
          deadline: "5天内",
          passCriteria: "至少2人完成试用或主动预约下一步",
          stopCriteria: "无人愿意投入时间时，暂停扩大开发",
        },
      ],
    };
  }

  if (request.mode === "survey_generation") {
    const projectName = request.project.name || "这个项目";
    return {
      summary: "已生成一份面向真实行为的短问卷。问题避免诱导用户夸奖想法，重点筛选经历、替代方案和行动意愿。",
      questions: [],
      missingFields: [],
      suggestions: [],
      surveyDraft: {
        title: `${projectName}｜现实需求小调查`,
        introduction: "这不是产品推销。我们只想了解你最近是否遇到过相关问题，填写约需2分钟。",
        questions: [
          { id: "identity", prompt: `你是否属于「${request.project.targetUser || "目标用户"}」？`, type: "single_choice", required: true, options: ["是", "部分符合", "不是"] },
          { id: "recent_event", prompt: "你最近一次遇到这个问题是什么时候？当时发生了什么？", type: "long_text", required: true, options: [] },
          { id: "frequency", prompt: "过去30天，这个问题大约发生过几次？", type: "single_choice", required: true, options: ["0次", "1次", "2至3次", "4次及以上"] },
          { id: "alternative", prompt: "你现在通常怎么解决？最不满意的地方是什么？", type: "long_text", required: true, options: [] },
          { id: "action", prompt: "如果有更省事的解决方式，你愿意采取哪一步？", type: "multiple_choice", required: true, options: ["了解更多", "试用演示", "留下联系方式", "预约沟通", "暂时不会行动"] },
          { id: "value", prompt: "什么结果会让你认为它值得付费？", type: "short_text", required: false, options: [] },
        ],
      },
    };
  }

  if (request.mode === "evidence_review") {
    return {
      summary: request.answer?.trim() || "系统已收到一批问卷答卷，但仍需要创始人核对样本身份和原始回答后才能计入证据。",
      questions: ["这些回答者是否符合目标用户定义？", "是否存在熟人样本、重复提交或明显无效回答？"],
      missingFields: [],
      suggestions: ["只确认原始数据能够直接支持的结论，不要把兴趣推断成付费。"],
    };
  }

  if (request.mode === "task_decomposition") {
    const user = request.project.targetUser || "目标用户";
    const uncertainty = request.project.biggestUncertainty || "用户是否真的会采取行动";
    const tasks = [
      ["锁定最危险假设", `把「${uncertainty}」改写成一个7天内可以被证伪的问题，只保留一个判断目标。`, "写出一个包含对象、行为和数字的判断目标", "如果无法在7天内验证，就继续缩小问题"],
      ["列出首批真实名单", `列出至少10位能够直接联系到的${user}，不要只写平台名称。`, "得到10个具体联系人或公开触达对象", "少于5个可触达对象时先换渠道"],
      ["发出第一轮邀请", "向名单发送不超过80字的邀请，只邀请访谈、问卷或试用，不推销完整产品。", "至少发出5次真实邀请", "无人回复时先修改邀请和渠道，不继续开发"],
      ["执行一次最小验证", "完成访谈、问卷、人工演示或公开测试中的一种，并保存原始回答。", "获得至少3份有效外部反馈", "样本不符合目标用户时排除并补样本"],
      ["提出更强行动", "向反馈最强的人提出试用、预约、报价或预订，不问泛泛的喜欢程度。", "至少1人愿意投入时间、数据或金钱", "无人行动时暂停扩大产品范围"],
      ["复核反例", "专门检查拒绝、沉默和负面反馈，写出当前方案最可能错误的地方。", "记录至少2条反例或拒绝原因", "只收到熟人正向评价时不升级灯号"],
      ["回填并重新校准", "把原始结果放入证据背包，确认AI总结，重新计算灯号和下一轮投入上限。", "完成证据确认并保存一轮校准", "证据没有变化时不追加预算"],
    ];
    return {
      summary: "AI已把本轮最大不确定性拆成7天行动路线。每天只安排一项会产生外部结果的任务。",
      questions: [],
      missingFields: [],
      suggestions: [],
      taskDrafts: tasks.map(([title, detail, passCriteria, stopCriteria], index) => ({ day: index + 1, title, detail, passCriteria, stopCriteria })),
    };
  }

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

function inferProjectDraft(idea: string, project: AiCoachRequest["project"]): NonNullable<AiCoachData["projectDraft"]> {
  const cleanIdea = idea.replace(/\s+/g, " ").trim() || "一个等待验证的OPC项目";
  const userMatch = cleanIdea.match(/(?:帮助|面向|给)([^，。,.]{2,24}?)(?:解决|完成|更好地|用来|做|找出|减少|提升|降低|避免)/);
  const problemMatch = cleanIdea.match(/(?:解决|改善|避免|降低|减少|找出)([^。；;]{2,60})/);
  const productMatch = cleanIdea.match(/(?:做一个|打造一个|开发一个|想做|准备做)([^，。,.]{2,28})/);
  const targetUser = project.targetUser || userMatch?.[1]?.trim() || "最可能频繁遇到该问题的一小类具体用户";
  const painPoint = project.painPoint || problemMatch?.[1]?.trim() || `目前还不确定${targetUser}在什么场景下会为这个问题付出明显代价`;
  const shortName = productMatch?.[1]?.trim() || cleanIdea.slice(0, 16);
  const stage = /已经上线|正在运营|已有用户/.test(cleanIdea)
    ? "growth"
    : /最小版本|MVP/.test(cleanIdea)
      ? "mvp"
      : /演示版|原型|demo/i.test(cleanIdea)
        ? "demo"
        : /调研|访谈/.test(cleanIdea)
          ? "research"
          : project.currentStage;

  return {
    name: project.name || shortName.replace(/[：:，,。]/g, "").slice(0, 24) || "未命名OPC项目",
    description: cleanIdea,
    targetUser,
    painPoint,
    alternative: project.alternative || "用户继续使用现有工具、人工处理或暂时不解决",
    acquisition: project.acquisition || `先从能够直接联系到的${targetUser}中寻找首批5至10人`,
    monetization: project.monetization || "先验证谁愿意为哪个明确结果付费，再决定收费方式",
    currentStage: stage,
    existingArtifact: project.existingArtifact || "目前以想法和可快速制作的验证材料为主",
    biggestUncertainty: project.biggestUncertainty || `${targetUser}是否真的愿意为解决该问题采取行动`,
  };
}

function buildIntakeQuestions(draft: NonNullable<AiCoachData["projectDraft"]>): string[] {
  const questions: string[] = [];
  if (draft.targetUser.includes("一小类具体用户")) questions.push("第一批最容易联系到、最常遇到问题的人具体是谁？");
  if (draft.painPoint.includes("还不确定")) questions.push("这个问题最近一次发生在什么时候，造成了什么损失？");
  if (!draft.monetization || draft.monetization.includes("先验证")) questions.push("最终可能是谁为哪个结果付钱？");
  return questions.slice(0, 3);
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
