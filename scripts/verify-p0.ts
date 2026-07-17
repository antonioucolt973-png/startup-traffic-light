import assert from "node:assert/strict";
import {
  buildReport,
  deriveEvidenceSummary,
  emptyEvidence,
  emptyGatePlans,
  emptyProject,
  emptyRoadtestPlan,
  getMissingMinimumProjectFields,
  normalizeEvidence,
  normalizeGatePlans,
  normalizeProject,
  normalizeRoadtestPlan,
  plansToRoadtestPlan,
} from "../src/lib/decisionEngine.ts";
import { buildFallbackCoachResponse } from "../src/lib/aiFallback.ts";
import { competitionTryOnIdea, isCompetitionPresetIdea } from "../src/data/competitionPreset.ts";
import { aiCoachRequestSchema, aiCoachResponseSchema } from "../src/lib/aiSchemas.ts";
import { compareCalibration, createCalibrationRound, createValidationTasks } from "../src/lib/calibration.ts";
import { ensureActiveCycle, transitionJourneyCycle } from "../src/lib/cycleEngine.ts";
import { exampleCases } from "../src/data/examples.ts";
import aiCoachHandler from "../api/ai/coach.ts";
import {
  createEmptyWorkspace,
  evidenceSummaryToRecords,
  loadCalibrationHistory,
  loadEvidence,
  loadProject,
  loadRoadtestPlan,
  loadWorkspace,
  saveCalibrationHistory,
  saveEvidence,
  saveProject,
  saveRoadtestPlan,
  saveWorkspace,
} from "../src/lib/storage.ts";

const storageValues = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storageValues.get(key) ?? null,
    setItem: (key: string, value: string) => storageValues.set(key, value),
    removeItem: (key: string) => storageValues.delete(key),
    clear: () => storageValues.clear(),
  },
});

function makeProject(overrides: Partial<typeof emptyProject> = {}) {
  return {
    ...emptyProject,
    name: "validation project",
    targetUser: "specific user",
    painPoint: "repeated costly problem",
    alternative: "manual workflow",
    acquisition: "named community outreach",
    monetization: "paid service",
    biggestUncertainty: "will users pay",
    ...overrides,
  };
}

function reportFor(
  projectOverrides: Partial<typeof emptyProject> = {},
  evidenceOverrides: Partial<typeof emptyEvidence> = {},
) {
  return buildReport(
    makeProject(projectOverrides),
    { ...emptyEvidence, ...evidenceOverrides },
    emptyRoadtestPlan,
  );
}

const lights = {
  yellow: reportFor({ currentStage: "idea" }).light,
  red: reportFor({ currentStage: "research", timeInvestedDays: 28, moneyInvested: 3500 }, { competitorResearch: true }).light,
  blue: reportFor({ currentStage: "mvp", daysSinceLastExternalAction: 14 }).light,
  conservativeBlue: reportFor({ currentStage: "research", daysSinceLastExternalAction: 14 }).light,
  green: reportFor(
    { currentStage: "mvp", timeInvestedDays: 14 },
    { interviewCount: 5, demoTrialCount: 3, messageCount: 4, paymentSignalCount: 1 },
  ).light,
};

assert.deepEqual(lights, { yellow: "yellow", red: "red", blue: "blue", conservativeBlue: "blue", green: "green" });

const exampleLights = exampleCases.map((example) => buildReport(example.project, example.evidence, emptyRoadtestPlan).light);
assert.deepEqual(exampleLights, ["yellow", "red", "green", "blue"]);

const paidButEarly = reportFor(
  { currentStage: "mvp", timeInvestedDays: 14, moneyInvested: 3500 },
  { paymentSignalCount: 1 },
);
assert.equal(paidButEarly.light, "green");

const sparseProject = normalizeProject({ name: 42 } as unknown as typeof emptyProject);
const sparseEvidence = normalizeEvidence({ interviewCount: -8, messageCount: "bad" } as unknown as typeof emptyEvidence);
const sparsePlan = normalizeRoadtestPlan({ user: 99 } as unknown as typeof emptyRoadtestPlan);

assert.equal(sparseProject.name, "");
assert.equal(sparseProject.timeInvestedDays, 0);
assert.equal(sparseEvidence.interviewCount, 0);
assert.equal(sparseEvidence.messageCount, 0);
assert.equal(sparsePlan.user, "");
assert.deepEqual(getMissingMinimumProjectFields(emptyProject), ["项目名", "目标用户", "用户痛点"]);
assert.deepEqual(getMissingMinimumProjectFields(makeProject()), []);

const structureOnly = reportFor({ currentStage: "idea" });
assert.equal(structureOnly.projectStructureScore, 100);
assert.equal(structureOnly.evidenceScore, 0);
assert.equal(structureOnly.light, "yellow");
assert.equal(structureOnly.roadtestChecks.length, 6);
assert.equal(structureOnly.sevenDayTasks.length, 7);
assert.equal(structureOnly.roadtestChecks[0].status, "先停手");
assert.ok(structureOnly.redTeamQuestions.length >= 3);
assert.ok(new Set(structureOnly.redTeamQuestions.map((question) => question.role)).size >= 3);

const routeablePlan = buildReport(
  makeProject({ currentStage: "idea" }),
  emptyEvidence,
  {
    ...emptyRoadtestPlan,
    user: "明天联系5位独立开发者完成访谈；少于3人承认痛点就暂停。",
  },
);
assert.equal(routeablePlan.roadtestChecks[0].status, "可路测");

const structuredPlans = normalizeGatePlans({
  ...emptyGatePlans,
  user: {
    audience: "5 位独立开发者",
    action: "逐一完成问题访谈",
    deadline: "48 小时内",
    passCriteria: "至少 3 人承认问题",
    stopCriteria: "少于 2 人承认问题就暂停",
  },
});
assert.equal(
  buildReport(makeProject({ currentStage: "idea" }), emptyEvidence, plansToRoadtestPlan(structuredPlans)).roadtestChecks[0].status,
  "可路测",
);

const evidenceFromRecords = deriveEvidenceSummary([
  {
    id: "trial-1",
    projectId: "validation-project",
    type: "trial",
    occurredAt: "2026-07-13",
    actor: "2 位目标用户",
    behavior: "完成手动演示",
    quantity: 2,
    source: "user_behavior",
    note: "",
    url: "",
    verifiable: true,
    reviewStatus: "confirmed",
    origin: "manual",
    rawRecordIds: [],
  },
  {
    id: "ai-payment",
    projectId: "validation-project",
    type: "payment",
    occurredAt: "2026-07-13",
    actor: "AI",
    behavior: "模型推测可能付款",
    quantity: 10,
    source: "ai_inference",
    note: "",
    url: "",
    verifiable: false,
    reviewStatus: "confirmed",
    origin: "manual",
    rawRecordIds: [],
  },
]);
assert.equal(evidenceFromRecords.demoTrialCount, 2);
assert.equal(evidenceFromRecords.paymentSignalCount, 0);

const aiRequest = aiCoachRequestSchema.parse({
  mode: "plan_review",
  project: {
    name: "验证项目",
    description: "描述",
    targetUser: "目标用户",
    painPoint: "高频问题",
    alternative: "人工处理",
    acquisition: "具体社群",
    monetization: "按次付费",
    currentStage: "idea",
    existingArtifact: "草图",
    biggestUncertainty: "是否付费",
  },
  evidence: { interviewCount: 0, activeInterestCount: 0, trialCount: 0, paymentCount: 0, hasRetention: false },
  gate: { id: "user", title: "目标用户站", scene: "现实问题", currentEvidence: "缺少访谈" },
  plan: structuredPlans.user,
});
assert.equal(aiCoachResponseSchema.parse(buildFallbackCoachResponse(aiRequest)).source, "fallback");
assert.equal(aiCoachResponseSchema.safeParse({ schemaVersion: "1.0", mode: "plan_review", source: "ai", data: {} }).success, false);

const stageOneIntakeRequest = aiCoachRequestSchema.parse({
  mode: "project_intake",
  idea: "我想做一个AI试衣助手，帮助网购买衣服的人判断上身效果。",
  project: { ...makeProject(), name: "AI试衣助手", description: "AI试衣想法", currentStage: "demo" },
  evidence: { interviewCount: 0, activeInterestCount: 0, trialCount: 0, paymentCount: 0, hasRetention: false },
  intakeContext: { round: 1, history: [] },
});
assert.equal(isCompetitionPresetIdea({ name: "AI 试衣助手" }, competitionTryOnIdea), true);
assert.equal(isCompetitionPresetIdea({ name: "AI 试衣助手" }, "用户上传照片和衣服图，生成接近真实的试穿效果。"), true);
assert.equal(isCompetitionPresetIdea({ name: "另一个试衣项目" }, competitionTryOnIdea), true);
assert.equal(isCompetitionPresetIdea({ name: "老年用药提醒" }, "帮助独居老人避免漏服药物。"), false);
const intakeFallbackRound1 = aiCoachResponseSchema.parse(buildFallbackCoachResponse(stageOneIntakeRequest));
assert.equal(intakeFallbackRound1.data.clarification?.round, 1);
assert.equal(intakeFallbackRound1.data.clarification?.options.length, 3);
assert.equal(intakeFallbackRound1.data.clarification?.answerTarget, "targetUser");
const intakeFallbackRound2 = aiCoachResponseSchema.parse(buildFallbackCoachResponse({
  ...stageOneIntakeRequest,
  intakeContext: {
    round: 2,
    history: [{
      question: intakeFallbackRound1.data.clarification?.question ?? "目标用户是谁？",
      answer: "经常网购服装、担心上身效果的年轻女性",
      answerTarget: "targetUser",
    }],
  },
}));
assert.equal(intakeFallbackRound2.data.clarification?.round, 2);
assert.equal(intakeFallbackRound2.data.projectDraft?.targetUser, "经常网购服装、担心上身效果的年轻女性");

const stage23RouteRequest = aiCoachRequestSchema.parse({
  mode: "route_options",
  project: stageOneIntakeRequest.project,
  evidence: stageOneIntakeRequest.evidence,
  answer: "首次生成分析工作台与三条验证路线。",
});
const routeFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(stage23RouteRequest));
assert.equal(routeFallback.data.analysisWorkbench?.steps.length, 5);
assert.equal(routeFallback.data.routeOptions?.length, 3);
assert.equal(new Set(routeFallback.data.routeOptions?.map((route) => route.title)).size, 3);
assert.equal(routeFallback.data.routeOptions?.some((route) => /成功概率|成功率|\d+%/.test(route.validationStatus)), false);
assert.equal(routeFallback.data.routeOptions?.some((route) => /\d|%|万|亿/.test(`${route.market.tam}${route.market.sam}${route.market.growth}`)), false);
const regeneratedRouteFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse({ ...stage23RouteRequest, answer: "再来3条：生成第 2 组路线，避开此前路线的主要行动。" }));
assert.notDeepEqual(regeneratedRouteFallback.data.routeOptions?.map((route) => route.title), routeFallback.data.routeOptions?.map((route) => route.title));
const customRouteFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse({ ...stage23RouteRequest, answer: "用户自定义方向：与社区药店合作做人工提醒服务" }));
assert.match(customRouteFallback.data.routeOptions?.[2].title ?? "", /社区药店/);

const solutionFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(aiCoachRequestSchema.parse({
  ...stage23RouteRequest,
  mode: "solution_refinement",
  stageContext: { step: "who", answers: { demographic: "年轻女性", psychographic: "", behavior: "", portrait: "" } },
})));
assert.equal(solutionFallback.data.solutionRefinement?.step, "who");
assert.ok(solutionFallback.data.solutionRefinement?.gaps.length);
assert.ok(solutionFallback.data.solutionRefinement?.draftFields.length);

const researchFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(aiCoachRequestSchema.parse({ ...stage23RouteRequest, mode: "research_analysis" })));
assert.equal(researchFallback.data.researchReport?.items.length, 5);
assert.equal(researchFallback.data.researchReport?.items.every((item) => item.sources.length === 0), true);
assert.match(researchFallback.data.researchReport?.searchedAt ?? "", /未联网/);

const redTeamFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(aiCoachRequestSchema.parse({ ...stage23RouteRequest, mode: "red_team_analysis" })));
assert.equal(redTeamFallback.data.redTeamRisks?.length, 3);
assert.equal(redTeamFallback.data.redTeamRisks?.every((risk) => risk.mitigations.every((item) => Boolean(item.validationAction && item.credibilityBasis))), true);

const roadmapFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(aiCoachRequestSchema.parse({ ...stage23RouteRequest, mode: "task_decomposition" })));
assert.ok((roadmapFallback.data.roadmapDraft?.milestones.length ?? 0) >= 3);
assert.equal(roadmapFallback.data.roadmapDraft?.milestones.flatMap((milestone) => milestone.tasks).every((task) => Boolean(task.evidenceMethod && task.passCriteria && task.stopCriteria)), true);

async function invokeAiHandler(fetchMock?: typeof fetch, requestBody = aiRequest) {
  const originalFetch = globalThis.fetch;
  if (fetchMock) globalThis.fetch = fetchMock;
  let statusCode = 200;
  let body: unknown;
  await aiCoachHandler(
    { method: "POST", body: requestBody },
    {
      status(code: number) { statusCode = code; return this; },
      json(value: unknown) { body = value; },
      setHeader() {},
    },
  );
  globalThis.fetch = originalFetch;
  return { statusCode, body: aiCoachResponseSchema.parse(body) };
}

delete process.env.AI_ENABLED;
delete process.env.AI_API_KEY;
delete process.env.AI_MODEL;
assert.equal((await invokeAiHandler()).body.source, "fallback");

process.env.AI_ENABLED = "true";
process.env.AI_API_KEY = "test-key";
process.env.AI_MODEL = "test-model";
const providerFailure = async (status: number) => new Response("{}", { status });
assert.equal((await invokeAiHandler(() => providerFailure(429))).body.source, "fallback");
assert.equal((await invokeAiHandler(() => providerFailure(500))).body.source, "fallback");
assert.equal((await invokeAiHandler(async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }))).body.source, "fallback");
assert.equal((await invokeAiHandler(async () => { throw new DOMException("aborted", "AbortError"); })).body.source, "fallback");
const validAiData = { summary: "方案已具体。", questions: [], missingFields: [], suggestions: ["继续记录真实结果。"] };
assert.equal((await invokeAiHandler(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAiData) } }] }), { status: 200 }))).body.source, "ai");
const validIntakeData = {
  summary: "先确认第一批目标用户。",
  questions: ["第一批最容易联系的人是谁？"],
  missingFields: ["真实问题发生频率"],
  suggestions: ["回答不会直接计入现实证据。"],
  projectDraft: intakeFallbackRound1.data.projectDraft,
  clarification: {
    round: 1,
    question: "第一批最容易联系的人是谁？",
    hint: "缩小对象会改变后续验证渠道。",
    options: ["网购服装的年轻女性", "服装店主"],
    answerTarget: "targetUser",
  },
};
assert.equal((await invokeAiHandler(
  async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validIntakeData) } }] }), { status: 200 }),
  stageOneIntakeRequest,
)).body.source, "ai");
delete process.env.AI_ENABLED;
delete process.env.AI_API_KEY;
delete process.env.AI_MODEL;

const calibrationWorkspace = createEmptyWorkspace(exampleCases[0].project);
calibrationWorkspace.evidenceRecords = evidenceSummaryToRecords(exampleCases[0].project.id, exampleCases[0].evidence, "2026-07-13");
const calibrationStartReport = buildReport(exampleCases[0].project, exampleCases[0].evidence, emptyRoadtestPlan);
calibrationWorkspace.tasks = createValidationTasks(calibrationWorkspace.project.id, calibrationStartReport);
const baselineRound = createCalibrationRound(calibrationWorkspace, calibrationStartReport);
assert.equal(calibrationWorkspace.tasks.length, 7);
assert.equal(calibrationWorkspace.tasks[0].status, "pending");

calibrationWorkspace.evidenceRecords.push({
  id: "payment-proof",
  projectId: calibrationWorkspace.project.id,
  type: "payment",
  occurredAt: "2026-07-13",
  actor: "1 位试用用户",
  behavior: "支付小额预订",
  quantity: 1,
  source: "payment_or_retention",
  note: "",
  url: "",
  verifiable: true,
  reviewStatus: "confirmed",
  origin: "manual",
  rawRecordIds: [],
});
const recalibratedReport = buildReport(
  calibrationWorkspace.project,
  deriveEvidenceSummary(calibrationWorkspace.evidenceRecords),
  emptyRoadtestPlan,
);
const recalibratedRound = createCalibrationRound(calibrationWorkspace, recalibratedReport, baselineRound);
const calibrationDiff = compareCalibration(baselineRound, recalibratedRound);
assert.equal(baselineRound.light, "yellow");
assert.equal(recalibratedRound.light, "green");
assert.equal(calibrationDiff.lightChanged, true);
assert.equal(calibrationDiff.newEvidenceCount, 1);
assert.ok(calibrationDiff.evidenceDelta > 0);

const redReport = reportFor(
  { currentStage: "research", timeInvestedDays: 28, moneyInvested: 3500 },
  { competitorResearch: true },
);
const blueReport = reportFor({ currentStage: "mvp", daysSinceLastExternalAction: 14 });
const greenReport = reportFor(
  { currentStage: "mvp" },
  { interviewCount: 5, demoTrialCount: 3, messageCount: 4, paymentSignalCount: 1 },
);
assert.equal(redReport.investmentLimit.money, 0);
assert.equal(blueReport.investmentLimit.money, 100);
assert.equal(greenReport.investmentLimit.days, 14);

const persistedProject = makeProject({ id: "storage-project", name: "storage test" });
const persistedEvidence = { ...emptyEvidence, interviewCount: 3, testPostCount: 1 };
const persistedPlan = { ...emptyRoadtestPlan, user: "tomorrow interview 5 users" };

saveProject(persistedProject);
saveEvidence(persistedEvidence);
saveRoadtestPlan(persistedPlan);

assert.deepEqual(loadProject(), persistedProject);
assert.deepEqual(loadEvidence(), persistedEvidence);
assert.deepEqual(loadRoadtestPlan(), persistedPlan);

const history = Array.from({ length: 13 }, (_, index) => ({
  id: `snapshot-${index}`,
  projectId: "storage-project",
  projectName: "storage test",
  createdAt: new Date(2026, 0, index + 1).toISOString(),
  stage: "mvp",
  light: "yellow" as const,
  lightLabel: "yellow",
  evidenceScore: index,
  evidenceLevel: 1,
  projectStructureScore: 100,
  currentFocus: "validate",
}));

saveCalibrationHistory(history);
assert.equal(loadCalibrationHistory().length, 12);

storageValues.set("startup-traffic-light:calibration-history", JSON.stringify([{ id: "broken" }]));
assert.deepEqual(loadCalibrationHistory(), []);

const emptyWorkspace = createEmptyWorkspace(makeProject({ id: "workspace-project" }));
assert.equal(emptyWorkspace.schemaVersion, 5);
assert.equal(emptyWorkspace.initialProject, null);
emptyWorkspace.tasks = createValidationTasks(emptyWorkspace.project.id, structureOnly);
emptyWorkspace.tasks[0] = { ...emptyWorkspace.tasks[0], status: "completed", result: "完成 3 次访谈", evidenceIds: ["proof-1"] };
saveWorkspace(emptyWorkspace);
assert.equal(loadWorkspace().tasks[0].result, "完成 3 次访谈");
storageValues.set("startup-traffic-light:workspace:v5", "{broken-json");
assert.equal(loadWorkspace().schemaVersion, 5);

storageValues.delete("startup-traffic-light:workspace:v5");
storageValues.set("startup-traffic-light:workspace:v4", JSON.stringify({
  schemaVersion: 4,
  project: emptyWorkspace.project,
  initialProject: emptyWorkspace.project,
  evidenceRecords: [],
  plans: emptyGatePlans,
  redTeamTurns: [],
  tasks: emptyWorkspace.tasks,
  rounds: [],
  surveys: [],
}));
const migratedV5 = loadWorkspace();
assert.equal(migratedV5.schemaVersion, 5);
assert.deepEqual(migratedV5.cycles, []);

const cycleWorkspace = createEmptyWorkspace(makeProject({ id: "cycle-project", currentStage: "research" }));
const cycleStartReport = buildReport(cycleWorkspace.project, emptyEvidence, emptyRoadtestPlan);
const activeCycleWorkspace = ensureActiveCycle(cycleWorkspace, cycleStartReport);
assert.equal(activeCycleWorkspace.cycles.length, 1);
assert.equal(activeCycleWorkspace.cycles[0].status, "active");
assert.equal(activeCycleWorkspace.tasks.length, 7);
assert.equal(activeCycleWorkspace.tasks.every((task) => task.cycleId === activeCycleWorkspace.activeCycleId), true);
activeCycleWorkspace.tasks[0] = { ...activeCycleWorkspace.tasks[0], status: "completed", result: "访谈 5 位用户" };
activeCycleWorkspace.evidenceRecords.push({
  id: "cycle-payment-proof",
  projectId: activeCycleWorkspace.project.id,
  cycleId: activeCycleWorkspace.activeCycleId,
  type: "payment",
  occurredAt: "2026-07-15",
  actor: "1 位目标用户",
  behavior: "支付小额预订",
  quantity: 1,
  source: "payment_or_retention",
  note: "",
  url: "",
  verifiable: true,
  reviewStatus: "confirmed",
  origin: "manual",
  rawRecordIds: [],
});
const cycleEndReport = buildReport(
  activeCycleWorkspace.project,
  deriveEvidenceSummary(activeCycleWorkspace.evidenceRecords),
  emptyRoadtestPlan,
);
const nextCycleWorkspace = transitionJourneyCycle(activeCycleWorkspace, cycleEndReport, "advance");
assert.equal(nextCycleWorkspace.project.currentStage, "demo");
assert.equal(nextCycleWorkspace.cycles.filter((cycle) => cycle.status === "completed").length, 1);
assert.equal(nextCycleWorkspace.cycles.find((cycle) => cycle.status === "completed")?.taskSnapshot[0].result, "访谈 5 位用户");
assert.equal(nextCycleWorkspace.evidenceRecords.some((record) => record.id === "cycle-payment-proof"), true);
assert.equal(nextCycleWorkspace.tasks.every((task) => task.cycleId === nextCycleWorkspace.activeCycleId), true);
assert.notEqual(nextCycleWorkspace.activeCycleId, activeCycleWorkspace.activeCycleId);

const intakeRequest = aiCoachRequestSchema.parse({
  ...aiRequest,
  mode: "project_intake",
  idea: "我想做一个AI退货助手，帮助经常网购的年轻女性减少退货沟通成本",
});
const intakeFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(intakeRequest));
assert.equal(intakeFallback.mode, "project_intake");
assert.ok(intakeFallback.data.projectDraft?.targetUser);
assert.ok(intakeFallback.data.projectDraft?.biggestUncertainty);

const routeRequest = aiCoachRequestSchema.parse({ ...aiRequest, mode: "route_options" });
assert.equal(buildFallbackCoachResponse(routeRequest).data.routeOptions?.length, 3);
const surveyRequest = aiCoachRequestSchema.parse({ ...aiRequest, mode: "survey_generation" });
assert.ok((buildFallbackCoachResponse(surveyRequest).data.surveyDraft?.questions.length ?? 0) >= 3);
const taskRequest = aiCoachRequestSchema.parse({ ...aiRequest, mode: "task_decomposition" });
assert.ok((buildFallbackCoachResponse(taskRequest).data.roadmapDraft?.milestones.length ?? 0) >= 3);
const evidenceReviewRequest = aiCoachRequestSchema.parse({
  ...aiRequest,
  mode: "evidence_review",
  stageContext: {
    record: {
      behavior: "5位目标用户完成一键试衣，其中3位表示结果会影响购买判断",
      quantity: 5,
      frequency: "5人各体验1次",
      userQuote: "如果效果接近真人，我会在下单前使用",
      materialType: "screenshot：trial-results.png",
      verifiable: true,
    },
  },
});
const evidenceReviewFallback = aiCoachResponseSchema.parse(buildFallbackCoachResponse(evidenceReviewRequest));
assert.equal(evidenceReviewFallback.data.evidenceReview?.recommendation, "confirm");
assert.equal(evidenceReviewFallback.data.evidenceReview?.extracted.quantity, 5);
const cycleReviewRequest = aiCoachRequestSchema.parse({
  ...aiRequest,
  mode: "cycle_review",
  cycle: {
    cycleNumber: 2,
    completedTasks: 4,
    failedTasks: 1,
    newEvidenceCount: 3,
    evidenceDelta: 12,
    currentLight: "yellow",
    ruleRecommendation: "hold",
    previousGoal: "验证目标用户是否真的存在痛点",
  },
  stageContext: {
    hypotheses: [{ hypothesis: "用户愿意试用", status: "supported", evidence: "5次真实试用" }],
    failureReasons: ["尚未提出真实报价"],
  },
});
const cycleReviewFallback = buildFallbackCoachResponse(cycleReviewRequest);
assert.equal(cycleReviewFallback.data.cycleReview?.nextGoal.length ? true : false, true);
assert.match(cycleReviewFallback.data.cycleReview?.summary ?? "", /第 2 轮/);
assert.equal(cycleReviewFallback.data.cycleReview?.hypothesisChanges[0]?.status, "supported");
assert.equal(cycleReviewFallback.data.cycleReview?.failureReasons[0], "尚未提出真实报价");

const pendingEvidence = evidenceSummaryToRecords("pending-test", { ...emptyEvidence, interviewCount: 3 });
pendingEvidence[0].reviewStatus = "pending";
assert.equal(deriveEvidenceSummary(pendingEvidence).interviewCount, 0);
pendingEvidence[0].reviewStatus = "confirmed";
assert.equal(deriveEvidenceSummary(pendingEvidence).interviewCount, 3);

console.log("P0 verification passed: AI intake, four lights, structured plans, evidence sources, fallback, multi-cycle journey, tasks, recalibration diff, and storage migration.");
