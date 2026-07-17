import assert from "node:assert/strict";
import process from "node:process";
import { enhanceMcpOutput } from "../mcp/mimo-client.mjs";

process.env.AI_ENABLED = "true";
process.env.MCP_AI_ENABLED = "true";
process.env.AI_API_KEY = "test-key";
process.env.AI_MODEL = "mimo-v2.5";
process.env.MCP_AI_TIMEOUT_MS = "3000";

const fallback = {
  projectSummary: "本地项目摘要",
  round: 1,
  clarificationStatus: "needs_input",
  analysis: {
    targetUser: "本地目标用户",
    coreProblem: "本地核心问题",
    currentAlternative: "本地替代方案",
    biggestRisk: "本地最大风险",
    knownFacts: ["本地事实"],
    assumptions: ["本地假设"],
  },
  question: "本地问题",
  nextAction: "本地下一步",
  boundary: "规则边界",
};

let requestBody;
globalThis.fetch = async (_url, init) => {
  requestBody = JSON.parse(init.body);
  return {
    ok: true,
    async json() {
      return {
        choices: [{ message: { content: JSON.stringify({ updates: [
          { path: "analysis.coreProblem", value: "模型精炼后的核心问题" },
          { path: "nextAction", value: "模型建议先访谈三位真实用户" },
          { path: "round", value: "999" },
          { path: "unknown.path", value: "不得写入" },
        ] }) } }],
      };
    },
  };
};

const enhanced = await enhanceMcpOutput("opc_clarify_and_analyze", { idea: "测试项目" }, fallback);
assert.equal(enhanced.analysis.coreProblem, "模型精炼后的核心问题");
assert.equal(enhanced.nextAction, "模型建议先访谈三位真实用户");
assert.equal(enhanced.round, 1);
assert.equal(enhanced.boundary, "规则边界");
assert.equal(requestBody.thinking.type, "disabled");
assert.ok(requestBody.max_completion_tokens <= 500);
assert.ok(requestBody.messages[1].content.includes("editableReferenceFields"));
assert.ok(!requestBody.messages[1].content.includes("referenceResult"));

globalThis.fetch = async () => { throw new Error("provider unavailable"); };
const degraded = await enhanceMcpOutput("opc_clarify_and_analyze", { idea: "测试项目" }, fallback);
assert.deepEqual(degraded, fallback);

process.stdout.write("MCP AI fast-path verification passed: compact patch, protected fields, disabled thinking, and fallback.\n");
