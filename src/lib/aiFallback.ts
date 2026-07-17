import type { AiClarification, AiCoachData, AiCoachRequest, AiCoachResponse, AiProjectDraft, ClarificationTarget } from "./aiSchemas";
import { buildSolutionPreset, researchPresets, riskPresets, roadmapPresets, solutionSteps } from "../data/intersectionDecisionPresets.ts";

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
    const baseDraft = inferProjectDraft(idea, request.project);
    const draft = applyIntakeHistory(baseDraft, request.intakeContext?.history ?? [], idea);
    const round = request.intakeContext?.round ?? 1;
    const clarification = buildFallbackClarification(idea, draft, round);
    return {
      summary: "已经把你的描述整理成一辆可上路的项目车。下面仍是假设，请确认后再进入现实验证。",
      questions: [clarification.question],
      missingFields: [],
      suggestions: [
        `先验证「${draft.targetUser}」是否真的频繁遇到这个问题。`,
        `本轮最大不确定性：${draft.biggestUncertainty}`,
        "确认后，系统会按需求、交易和交付拆成六个现实路口。",
      ],
      projectDraft: draft,
      clarification,
    };
  }

  if (request.mode === "route_options") {
    const gate = request.gate?.title || "当前路口";
    const user = request.project.targetUser || "目标用户";
    const projectName = request.project.name || "当前项目";
    const uncertainty = request.project.biggestUncertainty || "目标用户是否会采取真实行动";
    const marketUnknown = "本阶段未联网，不提供确定性数字";
    const intent = request.answer || "";
    const version = intent.includes("第 3 组") ? 2 : intent.includes("第 2 组") ? 1 : 0;
    const routeTitles = [
      ["最快接触真实用户", "用轻量问卷筛选样本", "用最小演示测试行动"],
      ["问题日记与拒绝访谈", "公开内容招募验证", "人工Concierge交付"],
      ["高痛点垂直样本验证", "渠道伙伴共创试点", "小额预售或预约验证"],
    ][version];
    const customDirection = intent.startsWith("用户自定义方向：") ? intent.slice("用户自定义方向：".length).trim() : "";
    return {
      summary: `围绕${gate}生成了3条不同成本的现实路线。任选一条继续修改，选择不等于获得证据。`,
      questions: [],
      missingFields: [],
      suggestions: [],
      analysisWorkbench: {
        steps: [
          { title: "问题拆解", method: "MECE：用户、场景、痛点、替代方案", output: `聚焦「${user}」；当前问题是「${request.project.painPoint || "核心问题仍需确认"}」。` },
          { title: "市场与替代扫描", method: "当前替代方案与可触达渠道检查", output: `用户目前依赖「${request.project.alternative || "尚未确认的替代方式"}」；本阶段未联网，不生成市场规模结论。` },
          { title: "商业路径推演", method: "价值链、获客入口、交付资源", output: `先从「${request.project.acquisition || "可直接触达的首批用户"}」开始；可用资源是「${request.project.existingArtifact || "尚未确认"}」。` },
          { title: "关键假设账本", method: "假设驱动法与80/20优先级", output: `优先验证：${uncertainty}` },
          { title: "最小验证路线", method: "低成本、可证伪、可回填证据", output: "将最大不确定性拆成访谈、筛选问卷和最小演示三种差异化行动。" },
        ],
        knownFacts: [request.project.description || `用户正在规划${projectName}`, request.project.existingArtifact || "尚未确认已有成果"],
        assumptions: [`${user}确实频繁遇到该问题`, `${user}愿意投入时间、数据或金钱尝试新方案`, "现有获客入口能够触达足够样本"],
        biggestRisk: uncertainty,
        priorityReason: "在真实行动信号出现前继续扩大开发，只会增加投入，不能降低关键不确定性。",
        methods: ["MECE问题拆解", "问题树", "假设驱动法", "价值链分析", "关键成功因素（KSF）", "最小成本验证"],
      },
      routeOptions: [
        {
          title: routeTitles[0],
          rationale: "优先获得直接反馈，避免继续在内部打磨。",
          suitability: "适合已经能直接联系少量目标用户的项目。",
          audience: `5位可以在48小时内联系到的${user}`,
          action: `逐一发送一段问题描述，邀请进行15分钟访谈，追问最近一次真实经历和现有解决方式。`,
          deadline: "48小时内",
          estimatedCost: "预计成本：0–100元",
          difficulty: "★★☆☆☆",
          passCriteria: "5人中至少3人能讲出近期发生的具体问题经历",
          stopCriteria: "少于2人承认问题真实发生时，重新定义用户或问题",
          market: { tam: marketUnknown, sam: marketUnknown, som: "以首批5位可触达用户作为验证样本", growth: marketUnknown },
          business: { model: "先验证问题强度，暂不确认收费模式", arr: "无真实交易数据，不计算ARR", breakEven: "完成需求验证后再测算" },
          keySuccessFactors: ["样本符合目标用户定义", "能讲出近期真实经历", "愿意接受后续试用或联系"],
          landingCycle: "2天",
          validationStatus: "待验证：尚无现实访谈结果",
          detailedBreakdown: ["假设：目标用户近期真实遇到过该问题。", "行动：访谈并记录原话、发生频率和现有替代方式。", "判定：只使用符合目标用户定义的真实回答。"],
        },
        {
          title: routeTitles[1],
          rationale: "适合暂时没有访谈名单的创始人。",
          suitability: "适合有社群、内容账号或公开渠道，但缺少直接联系人。",
          audience: `至少20位可能符合条件的${user}`,
          action: "发布一份不超过6题的筛选问卷，再邀请高痛点回答者继续访谈。",
          deadline: "3天内",
          estimatedCost: "预计成本：0–200元",
          difficulty: "★★☆☆☆",
          passCriteria: "获得10份有效答卷，其中至少3人愿意留下联系方式",
          stopCriteria: "触达50人仍少于5份有效答卷时，调整渠道或表述",
          market: { tam: marketUnknown, sam: marketUnknown, som: "以10份有效答卷作为首轮样本", growth: marketUnknown },
          business: { model: "筛选高痛点样本后再验证付费模式", arr: "无真实交易数据，不计算ARR", breakEven: "获得有效样本后再测算" },
          keySuccessFactors: ["问卷只询问真实经历", "渠道能触达目标用户", "高痛点用户愿意继续联系"],
          landingCycle: "3天",
          validationStatus: "待验证：尚无有效答卷",
          detailedBreakdown: ["假设：公开渠道可以触达目标用户。", "行动：用短问卷筛选近期经历和行动意愿。", "判定：排除熟人夸奖、重复答卷和非目标样本。"],
        },
        {
          title: customDirection ? customDirection.slice(0, 80) : routeTitles[2],
          rationale: customDirection ? "围绕用户自定义方向补全可证伪标准；不把该方向当成已经成立的市场结论。" : "不问用户喜不喜欢，只看是否愿意试用或预约。",
          suitability: "适合已有Demo、截图、人工流程或可展示结果的项目。",
          audience: `3至5位问题最明显的${user}`,
          action: customDirection ? `将“${customDirection}”缩成一次最小行动，邀请3至5位高痛点用户实际参与，并记录完成、拒绝和下一步行为。` : `展示${projectName}的一页说明、截图或人工服务流程，邀请对方完成一次试用或预约。`,
          deadline: "5天内",
          estimatedCost: "预计成本：0–300元",
          difficulty: "★★★☆☆",
          passCriteria: "至少2人完成试用或主动预约下一步",
          stopCriteria: "无人愿意投入时间时，暂停扩大开发",
          market: { tam: marketUnknown, sam: marketUnknown, som: "以3至5位高痛点用户作为首轮样本", growth: marketUnknown },
          business: { model: request.project.monetization || "先测试单次服务或预约意愿", arr: "无真实交易数据，不计算ARR", breakEven: "获得首个付费信号后再测算" },
          keySuccessFactors: ["用户愿意完成核心流程", "结果对用户决策有帮助", "至少出现试用、预约或付费行动"],
          landingCycle: "5天",
          validationStatus: "待验证：尚无外部试用结果",
          detailedBreakdown: ["假设：用户愿意为结果投入时间或数据。", "行动：先用最小演示或人工交付，不扩大完整产品。", "判定：记录完成率、拒绝原因和下一步行动。"],
        },
      ],
    };
  }

  if (request.mode === "solution_refinement") {
    const rawStep = request.stageContext?.step;
    const step = rawStep === "what" || rawStep === "why" || rawStep === "how" || rawStep === "when" ? rawStep : "who";
    const preset = buildSolutionPreset(request.project as Parameters<typeof buildSolutionPreset>[0])[step];
    const current = (request.stageContext?.answers ?? {}) as Record<string, unknown>;
    const fields = solutionSteps.find((item) => item.id === step)?.fields ?? [];
    const gaps = fields.filter((field) => !String(current[field.key] ?? "").trim()).map((field) => `缺少${field.label}`);
    return {
      summary: "先指出当前答案缺口，再给出一版可编辑参考；不会自动覆盖用户输入。",
      questions: [],
      missingFields: gaps,
      suggestions: [],
      solutionRefinement: {
        step,
        gaps: gaps.length ? gaps.slice(0, 4) : ["当前答案仍需用真实用户行为验证，不能当成事实"],
        draftFields: Object.entries(preset).map(([key, value]) => ({ key, value })),
        rationale: "参考改写只让对象、问题、价值、收费或执行路径更具体，最终是否采用由用户确认。",
      },
    };
  }

  if (request.mode === "research_analysis") {
    return {
      summary: "联网资料暂不可用，已明确降级为本地案例库；以下内容不能冒充实时市场证据。",
      questions: [],
      missingFields: [],
      suggestions: ["商业决策前重新联网核验来源和发布日期。"],
      researchReport: {
        items: researchPresets.map((item) => ({ ...item, id: item.id as "market" | "competitor" | "trend" | "feedback" | "policy", sources: [] })),
        conflicts: [],
        gaps: ["本地案例库没有可点击实时来源", "尚未核验市场数字、竞品近况和政策更新"],
        searchedAt: "未联网｜本地案例库",
      },
    };
  }

  if (request.mode === "red_team_analysis") {
    return {
      summary: "已从六个维度检查方案。风险是待处理问题，不代表模型已经证明项目可行或不可行。",
      questions: [],
      missingFields: [],
      suggestions: [],
      redTeamRisks: riskPresets.slice(0, 3).map((risk) => ({
        ...risk,
        dimension: risk.dimension as "需求真实性" | "竞争环境" | "技术可行性" | "商业模式" | "团队能力" | "时机与政策",
        mitigations: risk.mitigations.map((item) => ({
          ...item,
          validationAction: item.description,
          credibilityBasis: item.credibility === "高" ? "能够产生可复核的外部行为结果" : "能够缩小不确定性，但仍需后续行为验证",
        })),
      })),
    };
  }

  if (request.mode === "task_decomposition") {
    return buildFallbackRoadmap(request);
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
    const record = (request.stageContext?.record ?? {}) as Record<string, unknown>;
    const behavior = typeof record.behavior === "string" && record.behavior.trim() ? record.behavior.trim() : "尚未提供明确的现实行为";
    const quantity = typeof record.quantity === "number" && Number.isFinite(record.quantity) ? Math.max(0, Math.round(record.quantity)) : 0;
    const userQuote = typeof record.userQuote === "string" ? record.userQuote.trim() : "";
    const materialType = typeof record.materialType === "string" && record.materialType.trim() ? record.materialType.trim() : "未提供可复核材料";
    const missing = [
      ...(behavior.length < 12 ? ["补充具体对象、场景和实际发生的行为"] : []),
      ...(quantity < 1 ? ["补充有效人数或发生次数"] : []),
      ...(userQuote.length < 6 ? ["补充一条用户原话或明确拒绝理由"] : []),
      ...(/未提供/.test(materialType) ? ["补充截图、文件、数据或录音材料"] : []),
    ];
    const verifiable = record.verifiable === true && missing.length === 0;
    return {
      summary: "已把提交内容整理为结构化证据候选。该结果只是审核建议，必须由用户确认后才能进入规则引擎。",
      questions: [],
      missingFields: missing,
      suggestions: missing.length ? ["先按缺口补证，再重新评估。"] : ["核对提取内容与原始材料一致后，再确认进入证据背包。"],
      evidenceReview: {
        extracted: {
          behavior,
          quantity,
          frequency: typeof record.frequency === "string" && record.frequency.trim() ? record.frequency.trim() : `${quantity} 人/次`,
          userQuote,
          materialType,
        },
        missing,
        quality: verifiable && quantity >= 3 ? "strong" : verifiable ? "reviewable" : "insufficient",
        explanation: verifiable ? "记录包含行为、数量、用户原话和材料类型，可以由用户核对后确认。" : "当前记录缺少数量、原话或可复核材料，不能直接计入证据充分度。",
        supplementation: missing.length ? missing.map((item) => `请${item}`) : ["保留原始材料，确保评委或团队成员能够复核。"],
        recommendation: verifiable ? "confirm" : "supplement",
      },
    };
  }

  if (request.mode === "cycle_review") {
    const cycle = request.cycle;
    const recommendation = cycle?.ruleRecommendation ?? "hold";
    const recommendationText = recommendation === "advance" ? "进入下一阶段" : recommendation === "return" ? "退回上一阶段修正假设" : "留在当前阶段更换路线";
    return {
      summary: "已根据本轮任务、现实证据和规则判灯完成阶段复盘。AI只解释变化并规划下一步，不会替规则引擎升级项目。",
      questions: [],
      missingFields: [],
      suggestions: [],
      cycleReview: {
        summary: `第 ${cycle?.cycleNumber ?? 1} 轮完成 ${cycle?.completedTasks ?? 0} 项任务，${cycle?.failedTasks ?? 0} 项未通过，新增 ${cycle?.newEvidenceCount ?? 0} 条证据。规则建议：${recommendationText}。`,
        achievements: [
          cycle?.newEvidenceCount ? `带回 ${cycle.newEvidenceCount} 条新的现实证据` : "识别出本轮没有新增现实证据",
          cycle?.completedTasks ? `完成 ${cycle.completedTasks} 项外部行动` : "明确了行动仍未真正发生",
        ],
        riskChanges: [cycle?.evidenceDelta ? `证据分变化 ${cycle.evidenceDelta > 0 ? "+" : ""}${cycle.evidenceDelta}` : "证据强度没有发生变化"],
        nextGoal: request.project.biggestUncertainty || "补齐当前最薄弱的现实行为证据",
        rationale: "下一轮只处理一个关键不确定性，继承历史证据，但不继承已经失效的行动方案。",
        hypothesisChanges: Array.isArray(request.stageContext?.hypotheses)
          ? (request.stageContext.hypotheses as Array<Record<string, unknown>>).slice(0, 6).map((item) => ({
              hypothesis: typeof item.hypothesis === "string" ? item.hypothesis : "当前关键假设",
              status: item.status === "supported" || item.status === "weakened" ? item.status : "unverified",
              evidence: typeof item.evidence === "string" ? item.evidence : "尚无足够已确认证据",
            }))
          : [],
        failureReasons: Array.isArray(request.stageContext?.failureReasons)
          ? (request.stageContext.failureReasons as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 5)
          : [],
        highestRisk: request.project.biggestUncertainty || "目标用户是否会采取真实行动仍未验证",
      },
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

function buildFallbackRoadmap(request: AiCoachRequest): AiCoachData {
  const user = request.project.targetUser || "目标用户";
  let day = 1;
  return {
    summary: "已按当前资源和最高风险生成小团队可执行路线；任务必须产生访谈、试用、报价或付款等外部结果。",
    questions: [],
    missingFields: [],
    suggestions: [],
    roadmapDraft: {
      milestones: roadmapPresets.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        duration: milestone.duration,
        goal: milestone.goal,
        success: milestone.success,
        risk: milestone.risk,
        stop: milestone.stop,
        tasks: milestone.tasks.map((title) => ({
          day: day++,
          title,
          detail: `面向${user}完成“${title}”，记录实际行为、拒绝原因和原始材料。`,
          target: milestone.goal,
          actions: ["锁定具体对象名单", "执行一次真实外部行动", "保存数量、用户原话和可复核材料"],
          tools: [{ title: "行动记录模板", content: "对象｜实际行为｜数量｜用户原话｜材料链接｜下一步。" }],
          duration: milestone.duration,
          estimatedCost: milestone.id === "m4" ? "≤ ¥100" : "¥0（使用免费工具）",
          evidenceMethod: "上传截图或文件，并填写实际行为、数量与用户原话",
          passCriteria: milestone.success,
          stopCriteria: milestone.stop,
        })),
      })),
    },
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

function buildFallbackClarification(idea: string, draft: AiProjectDraft, round: number): AiClarification {
  const isTryOnDemo = /试衣|试穿|换衣|穿搭|服装|衣服图|上身效果/.test(idea);
  if (isTryOnDemo) {
    const steps: AiClarification[] = [
      {
        round: 1,
        question: "第一批先验证哪一类人？",
        hint: "先缩小对象，才能找到真实样本，不要同时面向所有服装消费者。",
        options: ["经常网购服装、担心上身效果的年轻女性", "有私域顾客的服装店主", "愿意上传照片的穿搭内容用户"],
        answerTarget: "targetUser",
      },
      {
        round: 2,
        question: "用户最愿意为哪个结果采取行动？",
        hint: "验证具体行为和结果，不把“觉得功能有趣”当作需求证据。",
        options: ["下单前确认衣服是否适合自己", "减少买错后的退货或换货", "快速获得可分享的试穿效果图"],
        answerTarget: "painPoint",
      },
      {
        round: 3,
        question: "你现在能拿来验证的最小资源是什么？",
        hint: "不需要先完成产品；人工流程、效果图或静态页面也能测试行动意愿。",
        options: ["可点击的换衣 Demo 或效果图", "先人工生成 3—5 张试穿效果", "5 位可直接联系的目标用户"],
        answerTarget: "existingArtifact",
      },
    ];
    return steps[Math.min(2, Math.max(0, round - 1))];
  }

  const steps: AiClarification[] = [
    {
      round: 1,
      question: "第一批最容易联系到、最常遇到问题的人具体是谁？",
      hint: "目标用户越具体，后续访谈和验证成本越低。",
      options: [draft.targetUser, "你身边可直接联系到的一小类用户", "已有社群或客户中的高频用户"],
      answerTarget: "targetUser",
    },
    {
      round: 2,
      question: "这个问题最近一次发生时，用户付出了什么代价？",
      hint: "优先确认发生频率、时间或金钱损失，而不是主观喜欢程度。",
      options: ["浪费了时间，需要反复手工处理", "产生了直接金钱损失", "错过机会，结果不确定且焦虑"],
      answerTarget: "painPoint",
    },
    {
      round: 3,
      question: "你本周能拿来验证的最小资源是什么？",
      hint: "先用现有资源获得外部反馈，再决定是否投入开发。",
      options: ["5 位可直接联系的目标用户", "一个原型、页面或人工服务流程", "现有社群、内容渠道或行业联系人"],
      answerTarget: "existingArtifact",
    },
  ];
  return steps[Math.min(2, Math.max(0, round - 1))];
}

function applyIntakeHistory(
  draft: AiProjectDraft,
  history: Array<{ answer: string; answerTarget: ClarificationTarget }>,
  idea: string,
): AiProjectDraft {
  return history.reduce((current, item) => applyIntakeAnswer(current, item.answerTarget, item.answer, idea), draft);
}

function applyIntakeAnswer(draft: AiProjectDraft, target: ClarificationTarget, answer: string, idea: string): AiProjectDraft {
  if (target === "painPoint" && /试衣|试穿|换衣|穿搭|服装|衣服图|上身效果/.test(idea)) {
    return {
      ...draft,
      painPoint: `${draft.targetUser}希望${answer}，但商品图、买家秀和现有试衣方式无法可靠判断自己的上身效果。`,
      biggestUncertainty: `${draft.targetUser}是否愿意上传照片，并为“${answer}”完成一次试用、留资或付费动作。`,
    };
  }
  return { ...draft, [target]: answer };
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
