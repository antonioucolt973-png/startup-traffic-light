#!/usr/bin/env node

/**
 * OPC创业红绿灯的零依赖 MCP stdio server。
 *
 * It deliberately keeps the traffic-light verdict in the product's rules
 * engine. These tools structure inputs and propose falsifiable actions only.
 */
import readline from "node:readline";

const protocolVersion = "2024-11-05";

const tools = [
  {
    name: "opc_project_brief",
    description: "把一句创业想法整理成目标用户、问题、替代方案、最大风险和待确认项。不会预测成功率或给灯号。",
    inputSchema: {
      type: "object",
      required: ["idea"],
      properties: {
        idea: { type: "string", description: "创业想法的一句话描述" },
        goal: { type: "string", description: "本轮最想先验证的目标，可选" },
      },
    },
  },
  {
    name: "opc_route_options",
    description: "针对一个验证目标生成三条低成本、可证伪的现实行动路线。每条都包含对象、行动、期限、通过与停止标准。",
    inputSchema: {
      type: "object",
      required: ["project", "focus"],
      properties: {
        project: { type: "string", description: "项目摘要" },
        focus: { type: "string", description: "当前验证目标或风险" },
        resources: { type: "string", description: "可用时间、人脉、Demo 或预算，可选" },
      },
    },
  },
  {
    name: "opc_evidence_calibration",
    description: "依据已发生的访谈、主动反馈、试用、付款和复用行为，输出证据缺口与下一步，不把计划当作证据。",
    inputSchema: {
      type: "object",
      properties: {
        interviews: { type: "number" },
        activeInterest: { type: "number" },
        trials: { type: "number" },
        payments: { type: "number" },
        retention: { type: "boolean" },
      },
    },
  },
];

const lineReader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lineReader.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "解析 MCP JSON-RPC 请求失败。"))}\n`);
  }
});

function handleRequest(request) {
  if (request?.jsonrpc !== "2.0") return errorResponse(request?.id ?? null, -32600, "请求不是 JSON-RPC 2.0。");
  if (request.method === "notifications/initialized") return null;
  if (request.method === "initialize") {
    return resultResponse(request.id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "opc-startup-traffic-light", version: "0.1.0" },
      instructions: "使用工具整理创业输入与验证任务。灯号、投入上限和停止条件必须由 OPC 创业红绿灯网页规则引擎计算。",
    });
  }
  if (request.method === "tools/list") return resultResponse(request.id, { tools });
  if (request.method === "tools/call") return callTool(request.id, request.params);
  return errorResponse(request.id ?? null, -32601, `不支持的方法：${request.method}`);
}

function callTool(id, params = {}) {
  const tool = params.name;
  const args = params.arguments ?? {};
  if (tool === "opc_project_brief") return textResult(id, projectBrief(String(args.idea ?? ""), String(args.goal ?? "")));
  if (tool === "opc_route_options") return textResult(id, routeOptions(String(args.project ?? ""), String(args.focus ?? ""), String(args.resources ?? "")));
  if (tool === "opc_evidence_calibration") return textResult(id, evidenceCalibration(args));
  return errorResponse(id ?? null, -32602, `未知工具：${tool}`);
}

function projectBrief(idea, goal) {
  const normalized = idea.trim();
  if (normalized.length < 8) return { error: "请提供至少一句完整的创业想法。" };
  return {
    summary: normalized,
    currentGoal: goal || "确认最值得先验证的问题",
    facts: ["原始输入：创业者的一句话描述"],
    assumptions: ["目标用户是否真实存在且能接触到", "问题是否高频且当前方案不够好", "是否有人愿意为明确结果投入时间或金钱"],
    nextQuestion: "明天能接触到哪 5 位最接近目标用户的人？",
    boundary: "此结果是待验证假设，不是市场事实、成功概率或投资建议。",
  };
}

function routeOptions(project, focus, resources) {
  const subject = project.trim() || "当前项目";
  const constraint = resources.trim() || "一人、低成本、48 小时内";
  return {
    project: subject,
    focus: focus || "验证真实需求",
    constraint,
    routes: [
      { title: "直接访谈", audience: "5 位最接近目标用户的人", action: "展示问题描述，追问最近一次真实经历与现有做法", deadline: "48 小时内", pass: "至少 3 人能描述相同场景，并愿意继续沟通", stop: "触达 10 人后少于 2 人承认问题，缩小或更换用户" },
      { title: "最小公开测试", audience: "一个已有社群或内容渠道中的潜在用户", action: "发布单页或短问卷，只邀请留下联系方式、预约或试用", deadline: "3 天内", pass: "得到 3 个主动后续行为", stop: "有效触达后无主动行为，改写价值表达或入口" },
      { title: "手动交付验证", audience: "愿意给出具体反馈的 2 位用户", action: "不用完整产品，手动完成一次承诺中的核心结果", deadline: "7 天内", pass: "至少 1 人愿意继续使用、介绍或讨论报价", stop: "交付成本超过当前上限，砍掉承诺范围" },
    ],
    boundary: "路线是行动建议，不是现实证据；完成后需回填真实结果。",
  };
}

function evidenceCalibration(args) {
  const interviews = safeNumber(args.interviews);
  const activeInterest = safeNumber(args.activeInterest);
  const trials = safeNumber(args.trials);
  const payments = safeNumber(args.payments);
  const retention = Boolean(args.retention);
  const missing = [];
  if (interviews < 5) missing.push("至少补足 5 次目标用户访谈");
  if (activeInterest < 3) missing.push("收集主动留言、留资或预约等外部行为");
  if (trials < 2) missing.push("让至少 2 人完成试用或手动体验");
  if (payments < 1) missing.push("测试付款、预订或报价接受信号");
  if (!retention && trials > 0) missing.push("回访试用者是否愿意继续使用或推荐");
  return {
    observed: { interviews, activeInterest, trials, payments, retention },
    missing,
    nextAction: missing[0] || "证据已跨过基础门槛，请在网页规则引擎中重新校准灯号和投入上限。",
    boundary: "不根据平均分直接给绿灯；关键付款与复用门槛必须由网页规则引擎判定。",
  };
}

function safeNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function resultResponse(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function textResult(id, data) {
  return resultResponse(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
