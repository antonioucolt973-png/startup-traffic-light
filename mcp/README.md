# OPC 创业红绿灯 MCP 服务

本项目提供同一套工具的两种 MCP 传输方式：

- 本地 `stdio`：适合 Claude Desktop、Cherry Studio 等本地 MCP 客户端。
- 公网 Streamable HTTP：部署到 Vercel 后通过 `/api/mcp` 提供，适合比赛技术评测和远程 Agent 调用。

比赛演示版使用可复现的本地规则与预设分析，不需要 API Key。后续商业化可以在不改变工具名称和输入输出契约的情况下，把工具内部实现替换为大模型调用。

## 公网 MCP 地址

生产环境：

```text
https://startup-traffic-light.cjmai.top/api/mcp
```

协议：Streamable HTTP，使用 `POST` 请求。服务采用无会话模式并启用 JSON 响应，适合自动化评测和 Serverless 部署。

为兼容不同比赛评测器，HTTP入口会自动补齐MCP要求的 `Accept: application/json, text/event-stream` 和JSON媒体类型，并兼容 `2025-06-18`、`2025-03-26`、`2024-11-05` 协议版本。不规范JSON请求会返回明确的400错误，真实服务故障才返回500。

## 本地 stdio 启动

```bash
npm install
npm run mcp:server
```

客户端配置示例：

```json
{
  "mcpServers": {
    "opc-startup-traffic-light": {
      "command": "node",
      "args": ["D:/Code/创业红绿灯/mcp/server.mjs"]
    }
  }
}
```

## 五个核心工具

### `opc_clarify_and_analyze`

通过最多三轮理清，把模糊创业想法整理为目标用户、核心问题、替代方案、事实、假设和最大风险。

### `opc_generate_routes`

生成三条差异化、低成本、可证伪的验证路线，每条都包含对象、行动、期限、成本、通过标准和停止标准。

### `opc_intersection_decision`

处理目标用户、核心痛点、替代方案、获客入口、付费阻力和交付压力六类路口，区分事实与假设并建议下一步。

### `opc_generate_tasks`

把选定路线拆成 1—7 天内可执行的现实任务，包含工具、交付物、证据提交方式和验证标准。

### `opc_evaluate_evidence`

根据访谈、主动反馈、试用、付款和复用行为评估证据强度，指出缺口并生成阶段复盘。

## 结构化输出

所有工具都包含：

- 明确的 `inputSchema`
- 明确的 `outputSchema`
- 文本 `content`
- 可供程序直接读取的 `structuredContent`
- 输入参数范围和枚举校验
- 只读、无破坏性、幂等的工具注解

## 验证

以下命令会使用官方 MCP 客户端分别连接 `stdio` 和 Streamable HTTP，列出工具并逐个调用：

```bash
npm run verify:mcp
```

还应执行：

```bash
npm run typecheck
npm run lint
npm run build
```

## 能力边界

MCP 负责理清、分析、路线、决策辅导、任务和证据复盘。它不会预测创业成功率，也不会把计划、模型推测或口头称赞当成市场事实。

红黄绿灯、投入上限、停止条件和项目阶段由网页中的确定性规则引擎计算，MCP 不会绕过或修改这些规则。
