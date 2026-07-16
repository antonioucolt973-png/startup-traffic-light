# OPC创业红绿灯

面向一人公司和独立创业者的AI验证陪跑系统。用户输入一段创业想法，AI将其拆成现实验证路线、行动方案和问卷工具；规则引擎再根据真实证据调整灯号、投入上限与下一轮任务。

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm run verify:p0
npm run verify:mcp
npm run build
```

## MCP 服务（比赛提交）

项目包含五个结构化 MCP 工具，覆盖想法理清、路线生成、路口决策、任务拆解和证据复盘，同时支持本地 `stdio` 与公网 Streamable HTTP：

```bash
npm run mcp:server
```

部署后的远程 MCP 地址：

```text
https://startup-traffic-light.cjmai.top/api/mcp
```

详细工具与客户端配置见 [mcp/README.md](mcp/README.md)。MCP 只提供结构化建议；灯号、投入上限和停止条件仍由网页规则引擎决定。

## 环境变量

复制 `.env.example` 并配置需要的能力：

- `AI_*`：OpenAI兼容接口，只在后端读取API Key。
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`：邮箱登录、云端项目和公开问卷。

未配置AI时自动使用本地规则拆解；未配置Supabase时保持本地游客模式。真实问卷发布需要先执行 `supabase/migrations/001_initial.sql`。

## 启用登录与真实问卷

1. 创建一个Supabase项目，在SQL编辑器执行 `supabase/migrations/001_initial.sql`。
2. 在Supabase认证设置中，将线上域名加入允许的重定向地址。
3. 在Vercel项目环境变量中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 重新部署后，首页“登录保存”会显示邮箱验证码输入；登录用户可以发布公开问卷和二维码。

不要把Supabase `service_role`、AI Key或其他私密密钥写入前端环境变量。公开问卷只使用受RLS限制的匿名公钥。
