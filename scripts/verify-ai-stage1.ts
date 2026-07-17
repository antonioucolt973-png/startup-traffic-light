import assert from "node:assert/strict";
import aiCoachHandler from "../api/ai/coach.ts";
import { aiCoachRequestSchema, aiCoachResponseSchema } from "../src/lib/aiSchemas.ts";

const request = aiCoachRequestSchema.parse({
  mode: "project_intake",
  idea: "我想做一个AI一键试衣助手，帮助经常网购服装的人在下单前判断上身效果。",
  project: {
    name: "AI试衣助手",
    description: "AI一键试衣想法",
    targetUser: "",
    painPoint: "",
    alternative: "",
    acquisition: "",
    monetization: "",
    currentStage: "demo",
    existingArtifact: "一个可点击Demo和5位愿意试用的朋友",
    biggestUncertainty: "",
  },
  evidence: {
    interviewCount: 0,
    activeInterestCount: 0,
    trialCount: 0,
    paymentCount: 0,
    hasRetention: false,
  },
  intakeContext: { round: 1, history: [] },
});

let statusCode = 200;
let responseBody: unknown;
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
assert.equal(response.data.clarification?.round, 1);
assert.ok((response.data.clarification?.options.length ?? 0) >= 2);
assert.ok(response.data.projectDraft?.targetUser);

console.log(JSON.stringify({
  source: response.source,
  model: process.env.AI_MODEL,
  round: response.data.clarification?.round,
  question: response.data.clarification?.question,
  optionCount: response.data.clarification?.options.length,
}, null, 2));
