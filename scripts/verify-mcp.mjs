import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import mcpHandler from "../api/mcp.js";

const expectedTools = [
  "opc_clarify_and_analyze",
  "opc_generate_routes",
  "opc_intersection_decision",
  "opc_generate_tasks",
  "opc_evaluate_evidence",
];

const sampleCalls = {
  opc_clarify_and_analyze: {
    idea: "为经常网购服装、担心上身效果的消费者提供一键试衣功能",
    round: 1,
    history: [],
    goal: "验证用户是否愿意试用并付费",
  },
  opc_generate_routes: {
    projectSummary: "一键试衣助手，帮助网购服装用户在购买前查看上身效果",
    focus: "验证用户是否愿意上传照片并完成试用",
    resources: "已有可点击 Demo，预算 300 元，周期 3 天",
  },
  opc_intersection_decision: {
    gate: "user",
    project: "AI 一键试衣助手",
    answer: "过去两天访谈了 5 位经常网购服装的年轻女性，其中 4 位最近一个月有退货经历",
    currentEvidence: "5 份访谈记录和 4 张退货订单截图",
  },
  opc_generate_tasks: {
    route: "用人工演示方式让目标用户完成一次一键试衣体验",
    audience: "经常网购服装、担心上身效果的年轻女性",
    constraints: "已有 Demo，预算 300 元",
    days: 3,
  },
  opc_evaluate_evidence: {
    project: "AI 一键试衣助手",
    interviews: 5,
    activeInterest: 3,
    trials: 2,
    payments: 0,
    retention: false,
    completedTasks: 4,
    notes: "两位用户完成试用，三位留下联系方式，但还没有付费测试",
  },
};

await verifyStdio();
await verifyHttp();
process.stdout.write("MCP stdio 与 Streamable HTTP 验证通过。\n");

async function verifyStdio() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  const client = createClient("stdio-check");
  try {
    await client.connect(transport);
    await verifyClient(client, "stdio");
  } finally {
    await client.close();
  }
}

async function verifyHttp() {
  const httpServer = createServer((request, response) => {
    response.status = (code) => {
      response.statusCode = code;
      return response;
    };
    response.json = (body) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(body));
    };
    void mcpHandler(request, response);
  });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("无法取得本地 HTTP 测试端口");
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/api/mcp`));
  const client = createClient("http-check");
  try {
    await client.connect(transport);
    await verifyClient(client, "http");
    await client.close();
    await verifyCompatibility(`http://127.0.0.1:${address.port}/api/mcp`);
  } finally {
    await client.close().catch(() => undefined);
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
}

async function verifyCompatibility(url) {
  const cases = [
    { name: "json-only", headers: { "Content-Type": "application/json", Accept: "application/json" }, version: "2025-03-26" },
    { name: "missing-accept", headers: { "Content-Type": "application/json" }, version: "2025-03-26" },
    { name: "text-plain", headers: { "Content-Type": "text/plain" }, version: "2024-11-05" },
  ];
  for (const testCase of cases) {
    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: testCase.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: testCase.name,
        method: "initialize",
        params: {
          protocolVersion: testCase.version,
          capabilities: {},
          clientInfo: { name: testCase.name, version: "1.0.0" },
        },
      }),
    });
    const payload = await response.json();
    if (response.status !== 200 || payload.result?.protocolVersion !== testCase.version) {
      throw new Error(`兼容测试失败：${testCase.name}，HTTP ${response.status}`);
    }
  }

  const invalid = await globalThis.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid-json",
  });
  if (invalid.status !== 400) throw new Error(`无效 JSON 应返回 400，实际为 ${invalid.status}`);

  const getResponse = await globalThis.fetch(url);
  const getPayload = await getResponse.json();
  if (getResponse.status !== 405 || getPayload.error?.data?.transport !== "streamable-http") {
    throw new Error("GET 请求没有返回清晰的 MCP 使用说明");
  }
}

function createClient(name) {
  return new Client({ name, version: "1.0.0" });
}

async function verifyClient(client, label) {
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  for (const expected of expectedTools) {
    if (!names.includes(expected)) throw new Error(`${label} 缺少工具：${expected}`);
  }
  for (const name of expectedTools) {
    const result = await client.callTool({ name, arguments: sampleCalls[name] });
    if (result.isError) throw new Error(`${label} 工具调用失败：${name}`);
    if (!result.structuredContent) throw new Error(`${label} 工具缺少 structuredContent：${name}`);
  }
}
