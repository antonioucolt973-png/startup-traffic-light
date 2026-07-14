# 上线检查表

## 已由代码保证

- AI Key只在 `/api/ai/coach` 的后端环境变量中读取。
- AI、错误JSON、超时和限流失败时自动回退本地规则。
- 游客数据保存在当前浏览器，不与其他游客共享。
- 待确认或被排除的问卷证据不参与判灯。
- `/survey/:slug` 通过 `vercel.json` 回退到单页应用。

## Vercel环境变量

```text
AI_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=<server only>
AI_MODEL=<model name>
AI_TIMEOUT_MS=10000
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<publishable anon key>
```

## Supabase

1. 执行 `supabase/migrations/001_initial.sql`。
2. 开启邮箱验证码登录。
3. 设置站点URL为 `https://startup-traffic-light.cjmai.top`。
4. 增加重定向地址 `https://startup-traffic-light.cjmai.top/**`。
5. 使用两个不同浏览器验证：项目方发布问卷，受访者匿名提交，项目方刷新答卷并生成待确认证据。
