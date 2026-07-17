const protectedFields = new Set([
  "round",
  "clarificationStatus",
  "id",
  "type",
  "difficulty",
  "gate",
  "decision",
  "evidenceStrength",
  "day",
  "estimatedMinutes",
  "boundary",
]);

const toolInstructions = {
  opc_clarify_and_analyze: "使用MECE和问题树理清目标用户、核心问题、替代方案、事实与假设，只保留一个最关键追问。",
  opc_generate_routes: "使用假设驱动法生成三条差异化、低成本、可证伪路线，不给成功概率。",
  opc_intersection_decision: "区分事实、假设和证据，给出继续、修改或补证建议，但不决定灯号。",
  opc_generate_tasks: "把路线拆成能产生外部结果的现实任务，优先访谈、试用、报价、付款、复用和转介绍。",
  opc_evaluate_evidence: "只依据真实行为数量评估证据缺口并复盘，不把计划、浏览量或口头称赞当成强证据。",
};

export async function enhanceMcpOutput(toolName, input, fallback) {
  if (process.env.MCP_AI_ENABLED !== "true" || process.env.AI_ENABLED !== "true" || !process.env.AI_API_KEY || !process.env.AI_MODEL) return fallback;
  const referenceFields = selectReferenceFields(toolName, fallback);
  const allowedPaths = new Set(Object.keys(referenceFields));
  if (allowedPaths.size === 0) return fallback;
  const controller = new AbortController();
  const timeoutMs = Math.min(12000, Math.max(3000, Number(process.env.MCP_AI_TIMEOUT_MS) || 8000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = (process.env.AI_BASE_URL || "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        temperature: 0.2,
        max_completion_tokens: toolName === "opc_generate_routes" || toolName === "opc_generate_tasks" ? 750 : 500,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: `你是OPC创业红绿灯MCP工具助手。${toolInstructions[toolName]} 不展示逐字思维链，不预测创业成功率，不修改规则引擎边界。只输出JSON：{"updates":[{"path":"允许路径","value":"精炼后的文本"}]}。最多8项，只能使用用户消息列出的路径，不输出完整结果。` },
          { role: "user", content: JSON.stringify({ input: compactValue(input), editableReferenceFields: referenceFields }) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;
    const candidate = JSON.parse(extractJson(content));
    return applyTextUpdates(fallback, candidate?.updates, allowedPaths);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(content) {
  const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("invalid MCP AI JSON");
  return clean.slice(start, end + 1);
}

function selectReferenceFields(toolName, fallback) {
  const paths = {
    opc_clarify_and_analyze: ["projectSummary", "analysis.targetUser", "analysis.coreProblem", "analysis.currentAlternative", "analysis.biggestRisk", "nextAction"],
    opc_generate_routes: [
      "focus", "recommendation",
      "routes.0.rationale", "routes.0.action", "routes.0.passCriteria",
      "routes.1.rationale", "routes.1.action", "routes.1.passCriteria",
      "routes.2.rationale", "routes.2.action", "routes.2.passCriteria",
    ],
    opc_intersection_decision: ["summary", "risks.0", "assumptions.0", "recommendedAction", "followUpQuestion"],
    opc_generate_tasks: ["objective", "successDefinition", ...taskTextPaths(fallback?.tasks)],
    opc_evaluate_evidence: ["observedSignals.0", "evidenceGaps.0", "nextAction", "review.summary", "review.achievements.0", "review.riskChanges.0", "review.nextGoal"],
  }[toolName] ?? [];
  return Object.fromEntries(paths.flatMap((path) => {
    const value = getAtPath(fallback, path);
    return typeof value === "string" ? [[path, compactText(value, 240)]] : [];
  }));
}

function taskTextPaths(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.flatMap((_, index) => [`tasks.${index}.action`, `tasks.${index}.deliverable`, `tasks.${index}.passCriteria`]);
}

function applyTextUpdates(fallback, updates, allowedPaths) {
  if (!Array.isArray(updates)) return fallback;
  const result = structuredClone(fallback);
  for (const update of updates.slice(0, 8)) {
    if (!update || typeof update.path !== "string" || typeof update.value !== "string") continue;
    if (!allowedPaths.has(update.path) || update.path.split(".").some((key) => protectedFields.has(key))) continue;
    const value = update.value.trim();
    if (!value || value.length > 500 || typeof getAtPath(result, update.path) !== "string") continue;
    setAtPath(result, update.path, value);
  }
  return result;
}

function getAtPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function setAtPath(value, path, nextValue) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current?.[key], value);
  if (target && last !== undefined) target[last] = nextValue;
}

function compactValue(value, depth = 0) {
  if (depth > 6) return undefined;
  if (typeof value === "string") return compactText(value, 500);
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => compactValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, compactValue(child, depth + 1)]).filter(([, child]) => child !== undefined));
}

function compactText(value, limit) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
