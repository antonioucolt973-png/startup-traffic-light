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
npm run build
```

## 环境变量

复制 `.env.example` 并配置需要的能力：

- `AI_*`：OpenAI兼容接口，只在后端读取API Key。
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`：邮箱登录、云端项目和公开问卷。

未配置AI时自动使用本地规则拆解；未配置Supabase时保持本地游客模式。真实问卷发布需要先执行 `supabase/migrations/001_initial.sql`。
