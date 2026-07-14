import type {
  Assumption,
  DecisionReport,
  Evidence,
  EvidenceRecord,
  GateActionPlan,
  GatePlans,
  Light,
  Project,
  ProjectStage,
  RedTeamQuestion,
  RoadtestCheck,
  RoadtestPlan,
  RoadtestStatus,
} from "../types";

export const emptyProject: Project = {
  id: "local-project",
  name: "",
  description: "",
  targetUser: "",
  painPoint: "",
  alternative: "",
  acquisition: "",
  monetization: "",
  currentStage: "idea",
  timeInvestedDays: 0,
  moneyInvested: 0,
  daysSinceLastExternalAction: 0,
  biggestUncertainty: "",
  existingArtifact: "",
  hasDemo: false,
  hasPublished: false,
  iterationCount: 0,
  contactedUserCount: 0,
  hasQuoted: false,
};

export const emptyEvidence: Evidence = {
  competitorResearch: false,
  interviewCount: 0,
  testPostCount: 0,
  messageCount: 0,
  signupCount: 0,
  demoTrialCount: 0,
  paymentSignalCount: 0,
  retentionSignal: false,
};

export const emptyRoadtestPlan: RoadtestPlan = {
  user: "",
  pain: "",
  alternative: "",
  acquisition: "",
  payment: "",
  delivery: "",
};

export const emptyGateActionPlan: GateActionPlan = {
  audience: "",
  action: "",
  deadline: "",
  passCriteria: "",
  stopCriteria: "",
};

export const emptyGatePlans: GatePlans = {
  user: { ...emptyGateActionPlan },
  pain: { ...emptyGateActionPlan },
  alternative: { ...emptyGateActionPlan },
  acquisition: { ...emptyGateActionPlan },
  payment: { ...emptyGateActionPlan },
  delivery: { ...emptyGateActionPlan },
};

export function normalizeProject(project: Partial<Project> | null | undefined): Project {
  const source = project ?? {};
  return {
    ...emptyProject,
    id: asText(source.id, emptyProject.id),
    name: asText(source.name),
    description: asText(source.description),
    targetUser: asText(source.targetUser),
    painPoint: asText(source.painPoint),
    alternative: asText(source.alternative),
    acquisition: asText(source.acquisition),
    monetization: asText(source.monetization),
    currentStage: asProjectStage(source.currentStage),
    timeInvestedDays: asNonNegativeNumber(source.timeInvestedDays),
    moneyInvested: asNonNegativeNumber(source.moneyInvested),
    daysSinceLastExternalAction: asNonNegativeNumber(source.daysSinceLastExternalAction),
    biggestUncertainty: asText(source.biggestUncertainty),
    existingArtifact: asText(source.existingArtifact),
    hasDemo: Boolean(source.hasDemo) || source.currentStage === "demo" || source.currentStage === "mvp" || source.currentStage === "growth",
    hasPublished: Boolean(source.hasPublished),
    iterationCount: asNonNegativeNumber(source.iterationCount),
    contactedUserCount: asNonNegativeNumber(source.contactedUserCount),
    hasQuoted: Boolean(source.hasQuoted),
  };
}

export function normalizeEvidence(evidence: Partial<Evidence> | null | undefined): Evidence {
  const source = evidence ?? {};
  return {
    competitorResearch: Boolean(source.competitorResearch),
    interviewCount: asNonNegativeNumber(source.interviewCount),
    testPostCount: asNonNegativeNumber(source.testPostCount),
    messageCount: asNonNegativeNumber(source.messageCount),
    signupCount: asNonNegativeNumber(source.signupCount),
    demoTrialCount: asNonNegativeNumber(source.demoTrialCount),
    paymentSignalCount: asNonNegativeNumber(source.paymentSignalCount),
    retentionSignal: Boolean(source.retentionSignal),
  };
}

export function normalizeRoadtestPlan(plan: Partial<RoadtestPlan> | null | undefined): RoadtestPlan {
  const source = plan ?? {};
  return {
    user: asText(source.user),
    pain: asText(source.pain),
    alternative: asText(source.alternative),
    acquisition: asText(source.acquisition),
    payment: asText(source.payment),
    delivery: asText(source.delivery),
  };
}

export function normalizeGatePlans(plans: Partial<GatePlans> | null | undefined): GatePlans {
  const source = plans ?? {};
  return {
    user: normalizeGateActionPlan(source.user),
    pain: normalizeGateActionPlan(source.pain),
    alternative: normalizeGateActionPlan(source.alternative),
    acquisition: normalizeGateActionPlan(source.acquisition),
    payment: normalizeGateActionPlan(source.payment),
    delivery: normalizeGateActionPlan(source.delivery),
  };
}

export function plansToRoadtestPlan(plans: GatePlans): RoadtestPlan {
  return {
    user: gatePlanToText(plans.user),
    pain: gatePlanToText(plans.pain),
    alternative: gatePlanToText(plans.alternative),
    acquisition: gatePlanToText(plans.acquisition),
    payment: gatePlanToText(plans.payment),
    delivery: gatePlanToText(plans.delivery),
  };
}

export function deriveEvidenceSummary(records: EvidenceRecord[]): Evidence {
  const eligibleRecords = records.filter(
    (record) => record.reviewStatus !== "pending" && record.reviewStatus !== "rejected" && record.source !== "ai_inference" && record.source !== "founder_assumption",
  );
  const total = (type: EvidenceRecord["type"]) =>
    eligibleRecords.filter((record) => record.type === type).reduce((sum, record) => sum + Math.max(0, record.quantity), 0);

  return {
    competitorResearch: total("research") > 0,
    interviewCount: total("interview") + total("problem_story"),
    testPostCount: total("test_post"),
    messageCount: total("active_interest"),
    signupCount: total("signup"),
    demoTrialCount: total("trial"),
    paymentSignalCount: total("quote") + total("payment"),
    retentionSignal: total("repeat") + total("referral") > 0,
  };
}

export function getMissingMinimumProjectFields(project: Project): string[] {
  const fields = [
    [project.name, "项目名"],
    [project.targetUser, "目标用户"],
    [project.painPoint, "用户痛点"],
  ] as const;

  return fields.filter(([value]) => !value.trim()).map(([, label]) => label);
}

export function buildReport(project: Project, evidence: Evidence, plan: RoadtestPlan = emptyRoadtestPlan): DecisionReport {
  const assumptions = buildAssumptions(project);
  const evidenceScore = scoreEvidence(evidence);
  const evidenceLevel = getEvidenceLevel(evidence);
  const projectStructureScore = scoreProjectStructure(project);
  const roadtestChecks = buildRoadtestChecks(project, evidence, normalizeRoadtestPlan(plan));
  const planScore = scorePlan(roadtestChecks);
  const planCredibility = getPlanCredibility(planScore);
  const deliveryPath = getDeliveryPath(project, evidence);
  const missingEvidence = getMissingEvidence(evidence);
  const mainRisks = getMainRisks(project, evidence);
  const redTeamQuestions = buildRedTeamQuestions(project, evidence, mainRisks, roadtestChecks);
  const light = decideLight(project, evidence, evidenceScore, evidenceLevel);
  const investmentLimit = getInvestmentLimit(light, evidenceLevel);
  const sevenDayTasks = buildSevenDayTasks(project, evidence, light);
  const nextActions = sevenDayTasks.slice(0, 3);
  const stopConditions = buildStopConditions(evidence);
  const lightLabel = getLightLabel(light);
  const lightReason = getLightReason(light, project, evidenceScore, evidenceLevel);
  const currentFocus = getCurrentFocus(project, evidence, light);
  const nextReviewTrigger = getNextReviewTrigger(light);

  const report: Omit<DecisionReport, "markdown"> = {
    light,
    lightLabel,
    lightReason,
    projectStructureScore,
    evidenceScore,
    evidenceLevel,
    planScore,
    planCredibility,
    assumptions,
    roadtestChecks,
    redTeamQuestions,
    mainRisks,
    missingEvidence,
    currentFocus,
    nextReviewTrigger,
    deliveryPath,
    investmentLimit,
    nextActions,
    sevenDayTasks,
    stopConditions,
  };

  return {
    ...report,
    markdown: toMarkdown(project, report),
  };
}

function buildAssumptions(project: Project): Assumption[] {
  return [
    {
      title: "用户假设",
      summary: project.targetUser
        ? `目标用户是：${project.targetUser}。需要验证他们是否高频遇到该问题。`
        : "目标用户尚不清晰，无法判断需求密度。",
      risk: project.targetUser.length > 12 ? "中" : "高",
    },
    {
      title: "痛点假设",
      summary: project.painPoint
        ? `痛点是：${project.painPoint}。下一步要证明它足够痛、足够频繁。`
        : "痛点描述缺失，容易变成创始人自嗨。",
      risk: project.painPoint.length > 18 ? "中" : "高",
    },
    {
      title: "付费假设",
      summary: project.monetization
        ? `变现路径是：${project.monetization}。必须寻找预订、报价接受或预算信号。`
        : "还没有明确变现方式，不能加大投入。",
      risk: project.monetization.includes("先不") ? "中" : "高",
    },
    {
      title: "获客假设",
      summary: project.acquisition
        ? `第一批用户来源：${project.acquisition}。需要用测试内容验证触达效率。`
        : "获客渠道为空，后续容易做完没人看。",
      risk: project.acquisition.length > 10 ? "中" : "高",
    },
    {
      title: "技术假设",
      summary: "最小闭环版不先追求完整产品，先用手动演示、半自动流程或原型验证需求。",
      risk: project.currentStage === "demo" || project.currentStage === "mvp" ? "低" : "中",
    },
    {
      title: "交付假设",
      summary: "交付路径要限制在一人可控范围内，先证明核心价值再扩功能。",
      risk: project.timeInvestedDays > 10 && project.moneyInvested > 1000 ? "高" : "中",
    },
  ];
}

function buildRoadtestChecks(project: Project, evidence: Evidence, plan: RoadtestPlan): RoadtestCheck[] {
  const mustLeaveTheBuilding = shouldForceExternalAction(project, evidence);
  const externalActionWarning = getExternalActionWarning(project);
  const checks: RoadtestCheck[] = [
    {
      id: "user",
      stage: "demand",
      title: "目标用户站",
      scene: "现实里先看这个人是不是具体存在，以及他是否真的被痛点困扰。",
      evidence:
        evidence.interviewCount >= 5
          ? `已访谈 ${evidence.interviewCount} 人，用户痛点有初步外部证据。`
          : `当前只有 ${evidence.interviewCount} 次访谈，用户强痛点还没站稳。`,
      plan: plan.user,
      redTeamPrompt: "你说的目标用户能不能被找到？明天能约到哪 5 个人？如果他们不承认痛点，你是否停止？",
      ...evaluateGate(
        evidence.interviewCount >= 5,
        plan.user,
        "写清楚要找哪类人、找几人、问哪 3 个问题，以及什么回答算强痛点。",
      ),
    },
    {
      id: "pain",
      stage: "demand",
      title: "痛点路口",
      scene: "用户说有兴趣不够。现实会问：这个问题是否足够痛、足够频繁、值得马上解决？",
      evidence:
        evidence.messageCount >= 3 || evidence.demoTrialCount > 0
          ? `已有 ${evidence.messageCount} 个主动反馈、${evidence.demoTrialCount} 个试用信号。`
          : "还缺少主动反馈或试用行为，痛点强度没有被外部行为证明。",
      plan: plan.pain,
      redTeamPrompt: "什么行为能证明它真的痛？主动私信、愿意发资料、愿意试用，还是愿意付费？只说“用户需要”不算。",
      ...evaluateGate(
        evidence.messageCount >= 3 || evidence.demoTrialCount > 0,
        plan.pain,
        "写清楚准备用什么用户行为证明痛点强度，而不是只问对方感不感兴趣。",
      ),
    },
    {
      id: "alternative",
      stage: "demand",
      title: "替代方案站",
      scene: "用户现在一定有替代方案。换不用你的旧办法，必须有明确理由。",
      evidence: project.alternative
        ? `已写出现有替代方案：${project.alternative}。`
        : "还没写清楚用户现在怎么解决。",
      plan: plan.alternative,
      redTeamPrompt: "如果旧办法已经够用，用户为什么要换？你的方案是省钱、省时间，还是结果更确定？",
      ...evaluateGate(
        Boolean(project.alternative && evidence.competitorResearch),
        plan.alternative,
        "写清楚要对比哪些替代方案，以及准备用什么标准判断用户愿不愿意切换。",
      ),
    },
    {
      id: "acquisition",
      stage: "transaction",
      title: "获客入口站",
      scene: "不是问你打算在哪个平台发，而是第一批 20 个具体用户从哪里来。",
      evidence:
        evidence.testPostCount >= 2 || evidence.messageCount >= 3
          ? `已有 ${evidence.testPostCount} 次测试内容和 ${evidence.messageCount} 个主动反馈。`
          : "测试内容和主动反馈还不够，获客入口没有被验证。",
      plan: plan.acquisition,
      redTeamPrompt: "不要写“小红书/社群”。你要发给谁？标题是什么？48 小时内多少主动反馈算入口有效？",
      ...(mustLeaveTheBuilding
        ? {
            status: "立即行动" as const,
            feedback: externalActionWarning,
          }
        : evaluateGate(
            evidence.testPostCount >= 2 && evidence.messageCount >= 3,
            plan.acquisition,
            "写清楚具体社群、名单或内容题目，以及用什么主动反馈判断入口有效。",
          )),
    },
    {
      id: "payment",
      stage: "transaction",
      title: "付费阻力站",
      scene: "感兴趣不是付费信号。现实会问：谁现在愿意为哪个结果付多少钱？",
      evidence:
        evidence.paymentSignalCount > 0
          ? `已有 ${evidence.paymentSignalCount} 个付费、预订或报价接受信号。`
          : "还没有付费、预订或报价接受信号。",
      plan: plan.payment,
      redTeamPrompt: "谁现在付钱？为哪个结果付？如果你不敢报价，这是不是说明价值还没被验证？",
      ...evaluateGate(
        evidence.paymentSignalCount > 0,
        plan.payment,
        "写清楚准备向谁报价、报多少钱、对方做出什么动作才算有效付费信号。",
      ),
    },
    {
      id: "delivery",
      stage: "delivery",
      title: "交付压力站",
      scene: "一人项目最容易死在交付过大。先证明核心价值，不先做完整系统。",
      evidence:
        evidence.demoTrialCount > 0
          ? `已有 ${evidence.demoTrialCount} 人试用原型或手动演示。`
          : "还没有人试用过原型或手动演示。",
      plan: plan.delivery,
      redTeamPrompt: "你是不是又想先做完整产品？7 天内只能交付一个最小验证物，哪些功能必须砍掉？",
      ...evaluateGate(
        evidence.demoTrialCount >= 3,
        plan.delivery,
        "写清楚 7 天内只交付哪个最小验证物，哪些功能明确不做。",
      ),
    },
  ];

  return checks;
}

function evaluateGate(hasEvidence: boolean, planText: string, fallback: string): Pick<RoadtestCheck, "status" | "feedback"> {
  if (hasEvidence) {
    return { status: "已通过", feedback: "已有真实行为支撑，下一步可以继续补强更高阶证据。" };
  }

  const planQuality = scorePlanText(planText);
  if (planQuality >= 3) {
    return { status: "可路测", feedback: "当前证据不足，但补证计划具体、低成本，可以进入 7 天路测。" };
  }
  if (planQuality >= 1) {
    return { status: "计划太虚", feedback: `${fallback} 现在这条计划还不足以替代行动。` };
  }
  return { status: "先停手", feedback: "这里缺少证据，也缺少补证计划；不要用继续开发代替现实验证。" };
}

function scorePlanText(text: string): number {
  const value = text.trim();
  if (!value) return 0;
  let score = 0;
  if (value.length >= 24) score += 1;
  if (/\d|一|二|三|四|五|六|七|八|九|十/.test(value)) score += 1;
  if (/访谈|私信|社群|名单|用户|试用|原型|报价|预订|付费|停止|发布|留言|转化/.test(value)) score += 1;
  if (/天|小时|今天|明天|本周|7 天|七天/.test(value)) score += 1;
  if (/如果|少于|至少|达到|超过|愿意|不愿意|停止|继续/.test(value)) score += 1;
  if (/完整产品|先开发|做完再|大规模|投广告/.test(value)) score -= 2;
  return clamp(score, 0, 5);
}

function scorePlan(checks: RoadtestCheck[]): number {
  const points: Record<RoadtestStatus, number> = {
    未检查: 0,
    已通过: 100,
    可路测: 72,
    计划太虚: 38,
    先停手: 8,
    立即行动: 18,
  };
  return Math.round(checks.reduce((total, item) => total + points[item.status], 0) / checks.length);
}

function getPlanCredibility(score: number): "高" | "中" | "低" {
  if (score >= 70) return "高";
  if (score >= 42) return "中";
  return "低";
}

function scoreEvidence(evidence: Evidence): number {
  const score =
    (evidence.competitorResearch ? 10 : 0) +
    Math.min(evidence.interviewCount, 10) * 3 +
    Math.min(evidence.testPostCount, 5) * 5 +
    Math.min(evidence.messageCount, 20) * 1.5 +
    Math.min(evidence.signupCount, 20) * 2 +
    Math.min(evidence.demoTrialCount, 30) * 1.5 +
    Math.min(evidence.paymentSignalCount, 10) * 5 +
    (evidence.retentionSignal ? 15 : 0);

  return Math.min(100, Math.round(score));
}

function getEvidenceLevel(evidence: Evidence): number {
  if (evidence.retentionSignal) return 6;
  if (evidence.paymentSignalCount > 0) return 5;
  if (evidence.demoTrialCount > 0 || evidence.signupCount >= 5) return 4;
  if (evidence.testPostCount > 0 && evidence.messageCount > 0) return 3;
  if (evidence.interviewCount >= 3) return 2;
  if (evidence.competitorResearch) return 1;
  return 0;
}

function scoreProjectStructure(project: Project): number {
  const fields = [
    project.targetUser,
    project.painPoint,
    project.alternative,
    project.acquisition,
    project.monetization,
    project.biggestUncertainty,
  ];

  return Math.round((fields.filter((value) => Boolean(value.trim())).length / fields.length) * 100);
}

function decideLight(
  project: Project,
  evidence: Evidence,
  evidenceScore: number,
  evidenceLevel: number,
): Light {
  const overCommitted =
    (project.moneyInvested > 2000 && evidenceScore < 35 && evidence.paymentSignalCount === 0) ||
    (project.timeInvestedDays >= 21 && evidenceLevel < 3);
  const strongEvidence =
    evidence.paymentSignalCount > 0 ||
    (evidence.retentionSignal && evidence.demoTrialCount >= 3 && evidence.messageCount >= 3);

  if (overCommitted) return "red";
  if (strongEvidence) return "green";
  if (shouldForceExternalAction(project, evidence)) return "blue";
  return "yellow";
}

function shouldForceExternalAction(project: Project, evidence: Evidence): boolean {
  const hasDemo = hasShowableArtifact(project);
  const externalActions =
    evidence.interviewCount +
    evidence.testPostCount +
    evidence.messageCount +
    evidence.demoTrialCount +
    evidence.paymentSignalCount;

  if (externalActions > 0) return false;

  const idleThreshold = hasDemo ? 5 : 14;
  return project.daysSinceLastExternalAction >= idleThreshold;
}

function getExternalActionWarning(project: Project): string {
  const hasDemo = hasShowableArtifact(project);
  if (hasDemo) {
    return `已有可展示成果，且已 ${project.daysSinceLastExternalAction} 天没有真实用户行动。先发给具体用户，不要再用内部打磨替代验证。`;
  }
  return `项目已 ${project.daysSinceLastExternalAction} 天没有真实用户行动。停止继续空想或收集资料，先完成一次访谈、触达或测试发布。`;
}

function getMissingEvidence(evidence: Evidence): string[] {
  const missing: string[] = [];
  if (!evidence.competitorResearch) missing.push("竞品/替代方案搜索");
  if (evidence.interviewCount < 5) missing.push("3-5 个目标用户访谈");
  if (evidence.testPostCount < 2) missing.push("至少 2 次公开测试内容");
  if (evidence.messageCount < 3) missing.push("主动留言、私信或加微信信号");
  if (evidence.demoTrialCount < 3) missing.push("原型/手动演示试用");
  if (evidence.paymentSignalCount < 1) missing.push("付费、预订或报价接受信号");
  if (!evidence.retentionSignal) missing.push("复用、留存或转介绍信号");
  return missing;
}

function getMainRisks(project: Project, evidence: Evidence): string[] {
  const risks: string[] = [];
  if (!project.targetUser || project.targetUser.length < 8) risks.push("目标用户不够具体");
  if (!project.alternative || project.alternative.length < 8) risks.push("替代方案没有说清楚");
  if (evidence.interviewCount < 3) risks.push("用户访谈证据不足");
  if (evidence.messageCount === 0 && evidence.demoTrialCount === 0) risks.push("缺少外部主动反馈");
  if (evidence.paymentSignalCount === 0) risks.push("付费证据不足");
  if (project.timeInvestedDays > 10 && evidence.demoTrialCount === 0) risks.push("投入时间已偏高但没有试用证据");
  return risks.length ? risks : ["当前主要风险是证据还不够连续，需要继续验证复用和付费"];
}

function buildRedTeamQuestions(
  project: Project,
  evidence: Evidence,
  risks: string[],
  checks: RoadtestCheck[],
): RedTeamQuestion[] {
  const weakestGate = checks.find(
    (item) => item.status === "先停手" || item.status === "计划太虚" || item.status === "立即行动",
  );
  const questions: RedTeamQuestion[] = [
    {
      role: "用户红队",
      question: `如果没有 ${project.name || "这个项目"}，目标用户现在具体怎么解决？这个替代方案为什么不够好？`,
      severity: evidence.interviewCount < 3 ? "高风险" : "中风险",
    },
    {
      role: "获客红队",
      question: `第一批 20 个目标用户从哪里来？不要只写平台名，要写具体社群、内容题目或触达名单。`,
      severity: evidence.testPostCount < 2 ? "高风险" : "中风险",
    },
    {
      role: "付费红队",
      question: "有没有人明确说愿意付多少钱、什么时候付、为哪个结果付？没有的话不要扩大开发。",
      severity: evidence.paymentSignalCount === 0 ? "高风险" : "中风险",
    },
    {
      role: "执行红队",
      question: "一人 7 天内能交付的最小验证物是什么？哪些功能必须砍掉？",
      severity: project.timeInvestedDays > 10 ? "中风险" : "低风险",
    },
    {
      role: "怀疑红队",
      question: weakestGate
        ? `${weakestGate.title}没有通行：${weakestGate.feedback}`
        : `当前最大的幻想可能是：${risks[0]}。你能拿出哪条真实用户行为反驳它？`,
      severity: "高风险",
    },
  ];

  if (project.alternative) {
    questions.splice(1, 0, {
      role: "竞品红队",
      question: `用户为什么不用「${project.alternative}」继续解决？你的差异是更省钱、更省时间，还是效果更确定？`,
      severity: "中风险",
    });
  }

  return questions.slice(0, 6);
}

function getDeliveryPath(project: Project, evidence: Evidence): string {
  if (project.currentStage === "demo" || project.currentStage === "mvp" || project.currentStage === "growth" || evidence.demoTrialCount > 0) {
    return "一人可做：保留核心流程，继续迭代最小版本，但每次迭代必须绑定一个验证指标。";
  }
  if (project.timeInvestedDays <= 7 && project.moneyInvested <= 500) {
    return "一人可做但要砍范围：先做手动演示或可点击原型，不做完整系统。";
  }
  if (project.moneyInvested > 1500 && evidence.paymentSignalCount === 0) {
    return "一人不可继续加码：暂停新增开发，只允许做访谈、测试内容和付费意愿验证。";
  }
  return "一人可做但需限制投入：7 天内只验证一个关键假设。";
}

function getInvestmentLimit(light: Light, evidenceLevel: number) {
  if (light === "green") {
    return {
      days: 14,
      money: 3000,
      bans: ["不要同时扩 3 个以上功能", "不要跳过留存验证"],
    };
  }
  if (light === "red") {
    return {
      days: 1,
      money: 0,
      bans: ["禁止继续开发完整产品", "禁止外包", "禁止投放广告"],
    };
  }
  if (light === "blue") {
    return {
      days: 2,
      money: 100,
      bans: ["禁止继续打磨方案", "禁止买域名和做 Logo", "禁止学习新工具替代用户验证"],
    };
  }
  return {
    days: Math.max(3, Math.min(7, evidenceLevel + 3)),
    money: evidenceLevel >= 3 ? 800 : 300,
    bans: ["禁止做复杂后台", "禁止做自动化大系统", "禁止在无付费信号前扩大投入"],
  };
}

function buildSevenDayTasks(project: Project, evidence: Evidence, light: Light): string[] {
  const user = project.targetUser || "目标用户";
  if (light === "red") {
    return [
      "第 1 天：冻结新增开发、外包和投放，只保留已有成果。",
      `第 2 天：列出 10 个${user}，完成至少 3 次问题访谈，不介绍产品。`,
      "第 3 天：记录用户最近一次遇到问题时怎么处理、花了什么成本。",
      "第 4 天：用截图或人工服务邀请 3 人体验，不做新功能。",
      "第 5 天：对一位意向用户提出明确报价或预订动作。",
      "第 6 天：整理拒绝理由，判断是用户、痛点还是付费假设不成立。",
      "第 7 天：只有出现真实试用或付费信号，才解除冻结并重新校准。",
    ];
  }
  if (light === "blue") {
    const hasDemo = hasShowableArtifact(project);
    return [
      hasDemo
        ? "第 1 天：停止修改非核心界面，选定当前可演示的最小流程。"
        : "第 1 天：停止继续收集资料或空想，选定一个具体用户群和一条对外验证方式。",
      `第 2 天：从已有渠道列出 5 个${user}，逐个发出试用邀请。`,
      hasDemo
        ? "第 3 天：录制 60 秒演示或准备人工服务，发送给已触达对象。"
        : "第 3 天：准备 3 个访谈问题和一条触达消息，只验证问题是否真实存在。",
      "第 4 天：安排至少 3 次试用或问题访谈，记录原话和拒绝理由。",
      "第 5 天：向有兴趣的人提出明确下一步：试用、预约或报价。",
      "第 6 天：回访有反馈的人，确认是否愿意继续使用或推荐。",
      "第 7 天：回填外部行为证据，再决定继续迭代还是调整方向。",
    ];
  }
  if (light === "green") {
    return [
      "第 1 天：列出已验证的用户行为，明确本轮只服务一个核心场景。",
      "第 2 天：从试用反馈中选择最高频的一个问题，不扩展其他功能。",
      "第 3 天：交付一个可重复使用的最小流程，并邀请下一批用户试用。",
      "第 4 天：跟踪试用后的复用、留存或转介绍，不只看首次兴趣。",
      "第 5 天：验证价格、交付成本和用户期待是否匹配。",
      "第 6 天：删除没有证据支持的功能和渠道假设。",
      "第 7 天：按复用、付款和交付成本决定下一轮受控投入。",
    ];
  }
  return [
    `第 1 天：列出 20 个${user}，完成 5 个问题访谈，确认痛点是否真实。`,
    `第 2 天：整理替代方案对比，写出用户为什么可能从旧方案切换。`,
    `第 3 天：发布 2 条测试内容，标题直接指向痛点，记录留言和私信。`,
    `第 4 天：用手动演示或截图原型让 3 个用户试用，不开发完整功能。`,
    `第 5 天：向意向用户提出明确价格或预订动作，测试付费阻力。`,
    `第 6 天：复访前 2 天有反馈的人，确认是否还愿意继续用或推荐。`,
    `第 7 天：汇总证据，按留言、试用、付费、复用四类决定是否推进。`,
  ].filter((task) => {
    if (evidence.paymentSignalCount > 0) return true;
    return !task.includes("扩大");
  });
}

function buildStopConditions(evidence: Evidence): string[] {
  const trialTarget = evidence.demoTrialCount > 0 ? 5 : 3;
  return [
    "完成 10 次目标用户触达后，少于 2 人承认痛点强烈存在。",
    "发布 2 条测试内容后，没有任何目标用户主动留言、私信或加微信。",
    `邀请 ${trialTarget} 人试用手动演示后，少于 1 人愿意继续使用。`,
    "提出明确价格或预订动作后，没有任何人愿意进入下一步。",
  ];
}

function getLightLabel(light: Light): string {
  return {
    green: "绿灯：推进",
    yellow: "黄灯：验证",
    red: "红灯：暂停",
    blue: "蓝灯：去验证",
  }[light];
}

function getLightReason(light: Light, project: Project, evidenceScore: number, evidenceLevel: number): string {
  if (light === "green") return "已有较强外部反馈，可以做受控最小版本或继续迭代。";
  if (light === "red") return "投入已明显跑在证据前面，继续加码会放大风险，先冻结开发并补真实反馈。";
  if (light === "blue") {
    const hasDemo = hasShowableArtifact(project);
    return hasDemo
      ? "已有可展示成果，却长期没有外部行动。当前任务不是继续打磨，而是立即走向真实用户。"
      : "项目长期没有真实用户行动。当前任务不是继续空想或收集资料，而是先完成一次真实触达。";
  }
  return `项目结构已被描述，但证据仅在第 ${evidenceLevel} 级（${evidenceScore}/100），还不能加大投入。`;
}

function getCurrentFocus(project: Project, evidence: Evidence, light: Light): string {
  if (light === "red") return "先冻结投入，回到真实用户问题与最小验证物。";
  if (light === "blue") return "停止内部打磨，用当前成果接触用户并记录真实反应。";
  if (project.currentStage === "idea" || project.currentStage === "research") {
    return "优先验证需求是否存在：用户、痛点和替代方案不能只靠猜测。";
  }
  if (project.currentStage === "demo") {
    return "优先验证最小价值是否被感知：试用、主动反馈和初步报价。";
  }
  if (project.currentStage === "mvp") {
    return "优先验证能否持续成交和交付：价格、成本、复用与留存。";
  }
  if (evidence.retentionSignal) return "优先验证留存与交付效率，避免在已有用户时盲目扩功能。";
  return "优先补齐当前最薄弱的现实证据，再决定下一轮投入。";
}

function getNextReviewTrigger(light: Light): string {
  if (light === "red") return "完成 3 次真实访谈或得到第一条试用信号后，立即重新校准。";
  if (light === "blue") return "完成首次真实触达、3 次访谈/试用或收到明确拒绝后，立即重新校准。";
  if (light === "green") return "出现新的付款、复用、流失或交付成本变化后，重新校准下一轮投入。";
  return "完成本轮 7 天路测，或任一关键证据发生变化后，重新校准。";
}

function toMarkdown(project: Project, report: Omit<DecisionReport, "markdown">): string {
  return `# ${project.name || "未命名项目"} 校准报告

## 当前灯号
${report.lightLabel}

${report.lightReason}

## 分数
- 项目结构清晰度：${report.projectStructureScore}/100
- 证据充分度：${report.evidenceScore}/100
- 证据阶梯：第 ${report.evidenceLevel} 级
- 补证计划可信度：${report.planCredibility}（${report.planScore}/100）

## 现实路口
${report.roadtestChecks.map((item) => `- ${item.title}：${item.status}。${item.feedback}`).join("\n")}

## 最大风险
${report.mainRisks.map((risk) => `- ${risk}`).join("\n")}

## 缺失证据
${report.missingEvidence.map((item) => `- ${item}`).join("\n")}

## 本轮重点
${report.currentFocus}

## 下次校准时机
${report.nextReviewTrigger}

## 交付路径
${report.deliveryPath}

## 投入上限
- 时间：${report.investmentLimit.days} 天
- 金钱：${report.investmentLimit.money} 元
- 禁止事项：${report.investmentLimit.bans.join("；")}

## 7 天最小验证任务
${report.sevenDayTasks.map((task) => `- ${task}`).join("\n")}

## 停止条件
${report.stopConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasShowableArtifact(project: Project): boolean {
  return project.hasDemo || Boolean(project.existingArtifact.trim()) || ["demo", "mvp", "growth"].includes(project.currentStage);
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asProjectStage(value: unknown): ProjectStage {
  return value === "idea" || value === "research" || value === "demo" || value === "mvp" || value === "growth"
    ? value
    : emptyProject.currentStage;
}

function normalizeGateActionPlan(plan: Partial<GateActionPlan> | null | undefined): GateActionPlan {
  const source = plan ?? {};
  return {
    audience: asText(source.audience),
    action: asText(source.action),
    deadline: asText(source.deadline),
    passCriteria: asText(source.passCriteria),
    stopCriteria: asText(source.stopCriteria),
  };
}

function gatePlanToText(plan: GateActionPlan): string {
  return [
    plan.audience && `对象：${plan.audience}`,
    plan.action && `行动：${plan.action}`,
    plan.deadline && `期限：${plan.deadline}`,
    plan.passCriteria && `通过：${plan.passCriteria}`,
    plan.stopCriteria && `停止：${plan.stopCriteria}`,
  ]
    .filter(Boolean)
    .join("；");
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
