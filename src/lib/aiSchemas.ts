import { z } from "zod";

export const aiModeSchema = z.enum([
  "project_intake",
  "route_options",
  "solution_refinement",
  "research_analysis",
  "red_team_analysis",
  "survey_generation",
  "evidence_review",
  "task_decomposition",
  "assumption_breakdown",
  "plan_review",
  "red_team_followup",
  "task_personalization",
  "cycle_review",
]);

export const gateIdSchema = z.enum(["user", "pain", "alternative", "acquisition", "payment", "delivery"]);
export const clarificationTargetSchema = z.enum(["targetUser", "painPoint", "existingArtifact", "biggestUncertainty"]);

const shortText = z.string().trim().max(1200);

export const aiCoachRequestSchema = z.object({
  mode: aiModeSchema,
  idea: shortText.optional(),
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
    id: gateIdSchema,
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
  intakeContext: z.object({
    round: z.number().int().min(1).max(3),
    history: z.array(z.object({
      question: z.string().trim().min(1).max(300),
      answer: z.string().trim().min(1).max(600),
      answerTarget: clarificationTargetSchema,
    })).max(2),
  }).optional(),
  cycle: z.object({
    cycleNumber: z.number().int().min(1).max(999),
    completedTasks: z.number().int().min(0).max(1000),
    failedTasks: z.number().int().min(0).max(1000),
    newEvidenceCount: z.number().int().min(0).max(100000),
    evidenceDelta: z.number().min(-100).max(100),
    currentLight: z.enum(["red", "yellow", "green", "blue"]),
    ruleRecommendation: z.enum(["advance", "hold", "return"]),
    previousGoal: shortText,
  }).optional(),
  stageContext: z.record(z.string(), z.unknown()).optional(),
});

export const aiProjectDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  targetUser: z.string().trim().min(1).max(240),
  painPoint: z.string().trim().min(1).max(360),
  alternative: z.string().trim().max(300),
  acquisition: z.string().trim().max(300),
  monetization: z.string().trim().max(300),
  currentStage: z.enum(["idea", "research", "demo", "mvp", "growth"]),
  existingArtifact: z.string().trim().max(300),
  biggestUncertainty: z.string().trim().min(1).max(300),
});

export const aiCoachDataSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  questions: z.array(z.string().trim().min(1).max(300)).max(3),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(6),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
  revisedAction: z.string().trim().max(600).optional(),
  projectDraft: aiProjectDraftSchema.optional(),
  clarification: z.object({
    round: z.number().int().min(1).max(3),
    question: z.string().trim().min(1).max(300),
    hint: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(180)).min(2).max(3),
    answerTarget: clarificationTargetSchema,
  }).optional(),
  analysisWorkbench: z.object({
    steps: z.array(z.object({
      title: z.string().trim().min(1).max(80),
      method: z.string().trim().min(1).max(160),
      output: z.string().trim().min(1).max(500),
    })).min(5).max(5),
    knownFacts: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
    assumptions: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
    biggestRisk: z.string().trim().min(1).max(300),
    priorityReason: z.string().trim().min(1).max(300),
    methods: z.array(z.string().trim().min(1).max(100)).min(3).max(6),
  }).optional(),
  routeOptions: z.array(z.object({
    title: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(300),
    suitability: z.string().trim().min(1).max(240),
    audience: z.string().trim().min(1).max(240),
    action: z.string().trim().min(1).max(500),
    deadline: z.string().trim().min(1).max(120),
    estimatedCost: z.string().trim().min(1).max(120),
    difficulty: z.enum(["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"]),
    passCriteria: z.string().trim().min(1).max(240),
    stopCriteria: z.string().trim().min(1).max(240),
    market: z.object({
      tam: z.string().trim().min(1).max(180),
      sam: z.string().trim().min(1).max(180),
      som: z.string().trim().min(1).max(180),
      growth: z.string().trim().min(1).max(180),
    }),
    business: z.object({
      model: z.string().trim().min(1).max(240),
      arr: z.string().trim().min(1).max(180),
      breakEven: z.string().trim().min(1).max(180),
    }),
    keySuccessFactors: z.array(z.string().trim().min(1).max(180)).min(3).max(5),
    landingCycle: z.string().trim().min(1).max(120),
    validationStatus: z.string().trim().min(1).max(180),
    detailedBreakdown: z.array(z.string().trim().min(1).max(300)).min(3).max(6),
  })).length(3).optional(),
  solutionRefinement: z.object({
    step: z.enum(["who", "what", "why", "how", "when"]),
    gaps: z.array(z.string().trim().min(1).max(180)).min(1).max(4),
    draftFields: z.array(z.object({ key: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(400) })).min(1).max(6),
    rationale: z.string().trim().min(1).max(300),
  }).optional(),
  researchReport: z.object({
    items: z.array(z.object({
      id: z.enum(["market", "competitor", "trend", "feedback", "policy"]),
      label: z.string().trim().min(1).max(40),
      title: z.string().trim().min(1).max(180),
      summary: z.string().trim().min(1).max(500),
      findings: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
      sources: z.array(z.object({
        title: z.string().trim().min(1).max(240),
        url: z.string().url().max(1000),
        publishedAt: z.string().trim().min(1).max(80),
        sourceType: z.enum(["official", "regulator", "company", "research", "community", "media"]),
      })).max(6),
    })).length(5),
    conflicts: z.array(z.string().trim().min(1).max(300)).max(5),
    gaps: z.array(z.string().trim().min(1).max(300)).max(5),
    searchedAt: z.string().trim().min(1).max(80),
  }).optional(),
  redTeamRisks: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    dimension: z.enum(["需求真实性", "竞争环境", "技术可行性", "商业模式", "团队能力", "时机与政策"]),
    title: z.string().trim().min(1).max(120),
    problem: z.string().trim().min(1).max(500),
    evidence: z.string().trim().min(1).max(500),
    severity: z.enum(["高危", "中风险", "低风险"]),
    impact: z.string().trim().min(1).max(400),
    mitigations: z.array(z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().min(1).max(400),
      cost: z.enum(["低", "中", "高"]),
      duration: z.string().trim().min(1).max(80),
      credibility: z.enum(["中", "高"]),
      validationAction: z.string().trim().min(1).max(300),
      credibilityBasis: z.string().trim().min(1).max(300),
      update: z.string().trim().min(1).max(400),
    })).min(1).max(3),
  })).min(3).max(5).optional(),
  roadmapDraft: z.object({
    milestones: z.array(z.object({
      id: z.string().trim().min(1).max(40),
      title: z.string().trim().min(1).max(120),
      duration: z.string().trim().min(1).max(80),
      goal: z.string().trim().min(1).max(300),
      success: z.string().trim().min(1).max(240),
      risk: z.string().trim().min(1).max(240),
      stop: z.string().trim().min(1).max(240),
      tasks: z.array(z.object({
        day: z.number().int().min(1).max(30),
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(500),
        target: z.string().trim().min(1).max(240),
        actions: z.array(z.string().trim().min(1).max(240)).min(2).max(5),
        tools: z.array(z.object({ title: z.string().trim().min(1).max(100), content: z.string().trim().min(1).max(500) })).max(4),
        duration: z.string().trim().min(1).max(80),
        estimatedCost: z.string().trim().min(1).max(80),
        evidenceMethod: z.string().trim().min(1).max(240),
        passCriteria: z.string().trim().min(1).max(240),
        stopCriteria: z.string().trim().min(1).max(240),
      })).min(1).max(3),
    })).min(3).max(5),
  }).optional(),
  evidenceReview: z.object({
    extracted: z.object({
      behavior: z.string().trim().min(1).max(400),
      quantity: z.number().int().min(0).max(100000),
      frequency: z.string().trim().min(1).max(120),
      userQuote: z.string().trim().max(400),
      materialType: z.string().trim().min(1).max(120),
    }),
    missing: z.array(z.string().trim().min(1).max(180)).max(5),
    quality: z.enum(["insufficient", "reviewable", "strong"]),
    explanation: z.string().trim().min(1).max(500),
    supplementation: z.array(z.string().trim().min(1).max(240)).max(5),
    recommendation: z.enum(["confirm", "supplement", "exclude"]),
  }).optional(),
  surveyDraft: z.object({
    title: z.string().trim().min(1).max(120),
    introduction: z.string().trim().max(500),
    questions: z.array(z.object({
      id: z.string().trim().min(1).max(60),
      prompt: z.string().trim().min(1).max(300),
      type: z.enum(["single_choice", "multiple_choice", "short_text", "long_text", "scale"]),
      required: z.boolean(),
      options: z.array(z.string().trim().min(1).max(100)).max(8),
    })).min(3).max(8),
  }).optional(),
  taskDrafts: z.array(z.object({
    day: z.number().int().min(1).max(7),
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().min(1).max(500),
    passCriteria: z.string().trim().min(1).max(240),
    stopCriteria: z.string().trim().min(1).max(240),
  })).max(7).optional(),
  cycleReview: z.object({
    summary: z.string().trim().min(1).max(600),
    achievements: z.array(z.string().trim().min(1).max(200)).max(4),
    riskChanges: z.array(z.string().trim().min(1).max(200)).max(4),
    nextGoal: z.string().trim().min(1).max(300),
    rationale: z.string().trim().min(1).max(400),
    hypothesisChanges: z.array(z.object({
      hypothesis: z.string().trim().min(1).max(240),
      status: z.enum(["supported", "weakened", "unverified"]),
      evidence: z.string().trim().min(1).max(300),
    })).max(6),
    failureReasons: z.array(z.string().trim().min(1).max(240)).max(5),
    highestRisk: z.string().trim().min(1).max(300),
  }).optional(),
});

export const aiCoachResponseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  mode: aiModeSchema,
  source: z.enum(["ai", "fallback"]),
  notice: z.string().max(300).optional(),
  data: aiCoachDataSchema,
}).superRefine((response, context) => {
  if (response.mode === "project_intake") {
    if (!response.data.projectDraft) {
      context.addIssue({ code: "custom", path: ["data", "projectDraft"], message: "项目出发必须返回结构化项目草稿" });
    }
    if (!response.data.clarification) {
      context.addIssue({ code: "custom", path: ["data", "clarification"], message: "项目出发必须返回单轮理清问题" });
    }
  }
  if (response.mode === "route_options") {
    if (!response.data.analysisWorkbench) {
      context.addIssue({ code: "custom", path: ["data", "analysisWorkbench"], message: "路线总览必须返回结构化分析工作台" });
    }
    if (response.data.routeOptions?.length !== 3) {
      context.addIssue({ code: "custom", path: ["data", "routeOptions"], message: "路线总览必须返回三条验证路线" });
      return;
    }
    const titles = new Set(response.data.routeOptions.map((route) => route.title));
    const actions = new Set(response.data.routeOptions.map((route) => route.action));
    if (titles.size !== 3 || actions.size !== 3) {
      context.addIssue({ code: "custom", path: ["data", "routeOptions"], message: "三条路线必须具有不同定位和行动" });
    }
    response.data.routeOptions.forEach((route, index) => {
      const unsupportedNumbers = [route.market.tam, route.market.sam, route.market.growth, route.business.arr, route.business.breakEven];
      if (unsupportedNumbers.some((value) => /\d|%|万|亿/.test(value))) {
        context.addIssue({ code: "custom", path: ["data", "routeOptions", index], message: "未联网阶段不得输出确定性市场或财务数字" });
      }
      if (/成功概率|成功率|\d+%/.test(route.validationStatus)) {
        context.addIssue({ code: "custom", path: ["data", "routeOptions", index, "validationStatus"], message: "不得生成创业成功概率" });
      }
    });
    if (response.data.analysisWorkbench) {
      const factText = response.data.analysisWorkbench.knownFacts.join(" ");
      const assumptionText = response.data.analysisWorkbench.assumptions.join(" ");
      if (!factText.trim() || !assumptionText.trim()) {
        context.addIssue({ code: "custom", path: ["data", "analysisWorkbench"], message: "必须区分已知事实和待验证假设" });
      }
    }
  }
  if (response.mode === "solution_refinement" && !response.data.solutionRefinement) {
    context.addIssue({ code: "custom", path: ["data", "solutionRefinement"], message: "方案完善必须返回缺口和参考改写" });
  }
  if (response.mode === "research_analysis") {
    const report = response.data.researchReport;
    if (!report) context.addIssue({ code: "custom", path: ["data", "researchReport"], message: "资料分析必须返回五类结果" });
    if (response.source === "ai" && report?.items.some((item) => item.sources.length === 0)) {
      context.addIssue({ code: "custom", path: ["data", "researchReport", "items"], message: "实时资料必须包含来源" });
    }
  }
  if (response.mode === "red_team_analysis" && !response.data.redTeamRisks) {
    context.addIssue({ code: "custom", path: ["data", "redTeamRisks"], message: "红队必须返回项目专属风险" });
  }
  if (response.mode === "task_decomposition" && !response.data.roadmapDraft && !response.data.taskDrafts) {
    context.addIssue({ code: "custom", path: ["data", "roadmapDraft"], message: "路线地图必须返回里程碑任务" });
  }
  if (response.mode === "evidence_review" && !response.data.evidenceReview) {
    context.addIssue({ code: "custom", path: ["data", "evidenceReview"], message: "证据评估必须返回结构化提取与补证建议" });
  }
  if (response.mode === "cycle_review" && !response.data.cycleReview) {
    context.addIssue({ code: "custom", path: ["data", "cycleReview"], message: "成长回顾必须返回结构化轮次复盘" });
  }
});

export type AiMode = z.infer<typeof aiModeSchema>;
export type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;
export type AiCoachData = z.infer<typeof aiCoachDataSchema>;
export type AiCoachResponse = z.infer<typeof aiCoachResponseSchema>;
export type AiProjectDraft = z.infer<typeof aiProjectDraftSchema>;
export type AiClarification = NonNullable<AiCoachData["clarification"]>;
export type ClarificationTarget = z.infer<typeof clarificationTargetSchema>;
