#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { registerOpcTools } from "./opc-tools.mjs";

export function createOpcMcpServer() {
  const server = new McpServer({
    name: "opc-startup-traffic-light",
    version: "1.0.0",
  }, {
    instructions: "使用工具完成创业想法理清、验证路线、路口决策、任务生成和证据复盘。工具不会预测成功率，也不会替代网页规则引擎决定灯号、投入上限或停止条件。",
  });
  registerOpcTools(server);
  return server;
}

async function main() {
  const server = createOpcMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OPC 创业红绿灯 MCP stdio server 已启动。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("MCP server 启动失败：", error);
    process.exit(1);
  });
}
