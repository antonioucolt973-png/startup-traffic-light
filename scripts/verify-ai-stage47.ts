import assert from "node:assert/strict";
import aiCoachHandler from "../api/ai/coach.ts";
import { aiCoachRequestSchema, aiCoachResponseSchema, type AiMode } from "../src/lib/aiSchemas.ts";

const project = {
  name: "社区老人用药提醒助手",
  description: "为独居老人和异地子女提供简单的用药提醒与异常通知服务。",
  targetUser: "需要长期服药的独居老人及其异地子女",
  painPoint: "老人可能漏服或重复服药，子女无法及时知道异常",
  alternative: "闹钟、纸质药盒、电话提醒",
  acquisition: "社区卫生服务站和药店",
  monetization: "家庭订阅或社区采购，均为待验证假设",
  currentStage: "idea" as const,
  existingArtifact: "一页服务流程图",
  biggestUncertainty: "老人能否持续使用，以及谁愿意付费",
};
const evidence = { interviewCount: 0, activeInterestCount: 0, trialCount: 0, paymentCount: 0, hasRetention: false };

async function invoke(mode: AiMode, stageContext: Record<string, unknown>) {
  const request = aiCoachRequestSchema.parse({ mode, project, evidence, stageContext });
  let statusCode = 200;
  let responseBody: unknown;
  const startedAt = Date.now();
  await aiCoachHandler({ method: "POST", body: request }, {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; },
    setHeader() {},
  });
  assert.equal(statusCode, 200);
  const response = aiCoachResponseSchema.parse(responseBody);
  return { response, elapsedMs: Date.now() - startedAt };
}

const solution = await invoke("solution_refinement", { step: "who", answers: { demographic: "老人", psychographic: "", behavior: "", portrait: "" } });
assert.equal(solution.response.data.solutionRefinement?.step, "who");

const research = await invoke("research_analysis", { solution: solution.response.data.solutionRefinement });
assert.equal(research.response.data.researchReport?.items.length, 5);
if (research.response.source === "ai") {
  assert.equal(research.response.data.researchReport?.items.every((item) => item.sources.length > 0), true);
}

const redTeam = await invoke("red_team_analysis", { researchReport: research.response.data.researchReport });
assert.equal(redTeam.response.data.redTeamRisks?.length, 3);

const roadmap = await invoke("task_decomposition", { risks: redTeam.response.data.redTeamRisks });
assert.ok((roadmap.response.data.roadmapDraft?.milestones.length ?? 0) >= 3);

console.log(JSON.stringify({
  model: process.env.AI_MODEL,
  solution: { source: solution.response.source, elapsedMs: solution.elapsedMs },
  research: { source: research.response.source, elapsedMs: research.elapsedMs, notice: research.response.notice },
  redTeam: { source: redTeam.response.source, elapsedMs: redTeam.elapsedMs, risks: redTeam.response.data.redTeamRisks?.length },
  roadmap: { source: roadmap.response.source, elapsedMs: roadmap.elapsedMs, milestones: roadmap.response.data.roadmapDraft?.milestones.length },
}, null, 2));
