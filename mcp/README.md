# OPC创业红绿灯 MCP 服务

这是比赛提交使用的本地 MCP stdio 服务。它不需要 API Key，也不读取用户的姓名、联系方式、问卷链接或截图。

## 启动

```bash
npm run mcp:server
```

适合在支持 MCP stdio 的客户端中登记为：

```json
{
  "mcpServers": {
    "opc-startup-traffic-light": {
      "command": "node",
      "args": ["/绝对路径/startup-traffic-light/mcp/server.mjs"]
    }
  }
}
```

## 工具

- `opc_project_brief`：把一句创业想法整理成假设、缺口与第一条问题。
- `opc_route_options`：生成三条低成本、可证伪的现实验证路线。
- `opc_evidence_calibration`：依据已发生的用户行为指出证据缺口。

## 边界

MCP 负责结构化拆解和行动建议；网页规则引擎才负责灯号、投入上限、停止条件和证据等级。MCP 不预测成功率，也不会把计划或模型推测当作现实证据。
