import assert from "node:assert/strict";
import {
  buildReport,
  emptyEvidence,
  emptyProject,
  emptyRoadtestPlan,
  normalizeEvidence,
  normalizeProject,
  normalizeRoadtestPlan,
} from "../src/lib/decisionEngine.ts";
import {
  loadCalibrationHistory,
  loadEvidence,
  loadProject,
  loadRoadtestPlan,
  saveCalibrationHistory,
  saveEvidence,
  saveProject,
  saveRoadtestPlan,
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

const structureOnly = reportFor({ currentStage: "idea" });
assert.equal(structureOnly.projectStructureScore, 100);
assert.equal(structureOnly.evidenceScore, 0);
assert.equal(structureOnly.light, "yellow");
assert.equal(structureOnly.roadtestChecks.length, 6);
assert.equal(structureOnly.sevenDayTasks.length, 7);
assert.equal(structureOnly.roadtestChecks[0].status, "先停手");

const routeablePlan = buildReport(
  makeProject({ currentStage: "idea" }),
  emptyEvidence,
  {
    ...emptyRoadtestPlan,
    user: "明天联系5位独立开发者完成访谈；少于3人承认痛点就暂停。",
  },
);
assert.equal(routeablePlan.roadtestChecks[0].status, "可路测");

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

console.log("P0 verification passed: lights, normalization, report shape, local storage, history limit, and malformed-history fallback.");
