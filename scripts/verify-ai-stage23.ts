import assert from "node:assert/strict";
import aiCoachHandler from "../api/ai/coach.ts";
import { aiCoachRequestSchema, aiCoachResponseSchema } from "../src/lib/aiSchemas.ts";

const request = aiCoachRequestSchema.parse({
  mode: "route_options",
  project: {
    name: "社区老人用药提醒助手",
    description: "为独居老人和异地子女提供简单的用药提醒与异常通知服务。",
    targetUser: "需要长期服药、独居或记忆力下降的社区老人及其异地子女",
    painPoint: "老人可能漏服或重复服药，子女无法及时知道异常情况",
    alternative: "闹钟、纸质药盒、电话提醒",
    acquisition: "社区卫生服务站、养老服务社群和药店",
    monetization: "家庭订阅或社区服务采购，均为待验证假设",
    currentStage: "idea",
    existingArtifact: "一页服务流程图",
    biggestUncertainty: "老人是否愿意持续使用，子女或社区是否愿意为异常通知付费",
  },
  evidence: {
    interviewCount: 0,
    activeInterestCount: 0,
    trialCount: 0,
    paymentCount: 0,
    hasRetention: false,
  },
  answer: "首次生成分析工作台与三条验证路线。",
});

let statusCode = 200;
let responseBody: unknown;
const startedAt = Date.now();
await aiCoachHandler(
  { method: "POST", body: request },
  {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; },
    setHeader() {},
  },
);

assert.equal(statusCode, 200);
const response = aiCoachResponseSchema.parse(responseBody);
assert.equal(response.source, "ai", response.notice ?? "MiMo请求未返回实时结果");
assert.equal(response.data.analysisWorkbench?.steps.length, 5);
assert.equal(response.data.routeOptions?.length, 3);
assert.equal(new Set(response.data.routeOptions?.map((route) => route.title)).size, 3);
assert.equal(new Set(response.data.routeOptions?.map((route) => route.action)).size, 3);
assert.ok(response.data.analysisWorkbench?.knownFacts.length);
assert.ok(response.data.analysisWorkbench?.assumptions.length);

console.log(JSON.stringify({
  source: response.source,
  model: process.env.AI_MODEL,
  elapsedMs: Date.now() - startedAt,
  analysisSteps: response.data.analysisWorkbench?.steps.map((step) => step.title),
  routeTitles: response.data.routeOptions?.map((route) => route.title),
}, null, 2));
