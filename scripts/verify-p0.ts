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
import { aiCoachRequestSchema, aiCoachResponseSchema } from "../src/lib/aiSchemas.ts";
import { compareCalibration, createCalibrationRound, createValidationTasks } from "../src/lib/calibration.ts";
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

async function invokeAiHandler(fetchMock?: typeof fetch) {
  const originalFetch = globalThis.fetch;
  if (fetchMock) globalThis.fetch = fetchMock;
  let statusCode = 200;
  let body: unknown;
  await aiCoachHandler(
    { method: "POST", body: aiRequest },
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
assert.equal(emptyWorkspace.schemaVersion, 4);
assert.equal(emptyWorkspace.initialProject, null);
emptyWorkspace.tasks = createValidationTasks(emptyWorkspace.project.id, structureOnly);
emptyWorkspace.tasks[0] = { ...emptyWorkspace.tasks[0], status: "completed", result: "完成 3 次访谈", evidenceIds: ["proof-1"] };
saveWorkspace(emptyWorkspace);
assert.equal(loadWorkspace().tasks[0].result, "完成 3 次访谈");
storageValues.set("startup-traffic-light:workspace:v4", "{broken-json");
assert.equal(loadWorkspace().schemaVersion, 4);

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
assert.equal(buildFallbackCoachResponse(taskRequest).data.taskDrafts?.length, 7);

const pendingEvidence = evidenceSummaryToRecords("pending-test", { ...emptyEvidence, interviewCount: 3 });
pendingEvidence[0].reviewStatus = "pending";
assert.equal(deriveEvidenceSummary(pendingEvidence).interviewCount, 0);
pendingEvidence[0].reviewStatus = "confirmed";
assert.equal(deriveEvidenceSummary(pendingEvidence).interviewCount, 3);

console.log("P0 verification passed: AI intake, four lights, structured plans, evidence sources, fallback, tasks, recalibration diff, and storage migration.");
