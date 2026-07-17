import { aiCoachRequestSchema, aiCoachResponseSchema, type AiCoachRequest, type AiCoachResponse } from "../../src/lib/aiSchemas.ts";
import { buildFallbackCoachResponse } from "../../src/lib/aiFallback.ts";

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "只支持 POST 请求。" });
    return;
  }

  const parsed = aiCoachRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "请求结构不符合AI教练契约。" });
    return;
  }

  const enabled = process.env.AI_ENABLED === "true";
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!enabled || !apiKey || !model) {
    response.status(200).json(buildFallbackCoachResponse(parsed.data, "AI未启用，当前使用可复现的本地拆解。"));
    return;
  }

  const baseUrl = (process.env.AI_BASE_URL || "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
  const timeoutMs = parsed.data.mode === "research_analysis"
    ? Math.min(25000, Math.max(15000, Number(process.env.AI_RESEARCH_TIMEOUT_MS) || 25000))
    : parsed.data.mode === "red_team_analysis" || parsed.data.mode === "task_decomposition"
      ? Math.min(20000, Math.max(10000, Number(process.env.AI_STAGE_TIMEOUT_MS) || 18000))
    : parsed.data.mode === "solution_refinement"
      ? Math.min(15000, Math.max(8000, Number(process.env.AI_SOLUTION_TIMEOUT_MS) || 12000))
    : parsed.data.mode === "route_options"
    ? Math.min(35000, Math.max(20000, Number(process.env.AI_ROUTE_TIMEOUT_MS) || 32000))
    : Math.min(20000, Math.max(3000, Number(process.env.AI_TIMEOUT_MS) || 15000));

  try {
    const result = await callProvider({ baseUrl, apiKey, model, timeoutMs, request: parsed.data });
    response.status(200).json(result);
  } catch (error) {
    response.status(200).json(buildFallbackCoachResponse(parsed.data, fallbackNotice(error)));
  }
}

function fallbackNotice(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "模型响应超时，已自动切换本地拆解。";
  if (error instanceof SyntaxError) return "模型输出不是有效JSON，已自动切换本地拆解。";
  if (error instanceof Error && error.name === "ZodError") return "模型输出结构不完整，已自动切换本地拆解。";
  if (error instanceof Error && /provider status 401|provider status 403/.test(error.message)) return "模型鉴权失败，已自动切换本地拆解。";
  if (error instanceof Error && /provider status 429/.test(error.message)) return "模型调用额度或频率受限，已自动切换本地拆解。";
  return "模型调用失败，已自动切换本地拆解。";
}

async function callProvider(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  request: AiCoachRequest;
}): Promise<AiCoachResponse> {
  const deadline = Date.now() + options.timeoutMs;
  let lastError: unknown;

  // 比赛场景优先单次快速返回；结构不合格时直接降级，不用第二次调用继续占用时间。
  const maxAttempts = 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1000) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    try {
      const useWebSearch = options.request.mode === "research_analysis";
      const completion = await fetch(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0.2,
          max_completion_tokens: maxCompletionTokens(options.request.mode),
          response_format: { type: "json_object" },
          // 比赛与后续版本均固定关闭深度思考，避免延迟和不可控成本。
          thinking: { type: "disabled" },
          messages: [
            { role: "system", content: systemPrompt(options.request.mode) },
            { role: "user", content: JSON.stringify(providerInput(options.request)) },
          ],
          ...(useWebSearch ? {
            tools: [{ type: "web_search", max_keyword: 3, force_search: true, limit: 5 }],
            tool_choice: "auto",
          } : {}),
        }),
        signal: controller.signal,
      });
      if (!completion.ok) {
        const error = new Error(`provider status ${completion.status}`);
        if (completion.status < 500 || attempt === maxAttempts - 1) throw error;
        lastError = error;
        continue;
      }
      const payload = await completion.json() as { choices?: Array<{ message?: { content?: string; annotations?: unknown[] } }>; sources?: unknown[]; search_results?: unknown[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty provider response");
      const parsedContent = JSON.parse(extractJsonObject(content));
      const result = aiCoachResponseSchema.parse({
        schemaVersion: "1.0",
        mode: options.request.mode,
        source: "ai",
        data: parsedContent,
      });
      if (options.request.mode === "research_analysis") {
        const trustedUrls = collectTrustedSourceUrls(payload);
        const returnedUrls = result.data.researchReport?.items.flatMap((item) => item.sources.map((source) => source.url)) ?? [];
        if (trustedUrls.size === 0 || returnedUrls.some((url) => !trustedUrls.has(url))) {
          throw new Error("research sources were not returned by web_search");
        }
      }
      if (
        options.request.mode === "project_intake"
        && result.data.clarification?.round !== (options.request.intakeContext?.round ?? 1)
      ) {
        throw new Error("provider returned mismatched clarification round");
      }
      return result;
    } catch (error) {
      lastError = error;
      if (error instanceof DOMException && error.name === "AbortError") break;
      if (attempt === maxAttempts - 1) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("provider request failed");
}

function maxCompletionTokens(mode: AiCoachRequest["mode"]) {
  if (mode === "solution_refinement") return 700;
  if (mode === "research_analysis") return 1600;
  if (mode === "red_team_analysis") return 1200;
  if (mode === "task_decomposition") return 1400;
  if (mode === "evidence_review" || mode === "cycle_review") return 900;
  if (mode === "route_options") return 2100;
  if (mode === "project_intake") return 1200;
  return 900;
}

function providerInput(request: AiCoachRequest) {
  const payload = request.mode === "project_intake" ? {
    idea: request.idea,
    project: request.project,
    intakeContext: request.intakeContext ?? { round: 1, history: [] },
  } : request;
  return compactProviderValue(payload);
}

function compactProviderValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (typeof value === "string") return value.length > 900 ? `${value.slice(0, 900)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => compactProviderValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, compactProviderValue(child, depth + 1)] as const)
      .filter(([, child]) => child !== undefined),
  );
}

function extractJsonObject(content: string) {
  const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("provider did not return JSON object");
  return clean.slice(start, end + 1);
}

function collectTrustedSourceUrls(payload: { choices?: Array<{ message?: { annotations?: unknown[] } }>; sources?: unknown[]; search_results?: unknown[] }) {
  const urls = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === "url" || key === "link") && typeof child === "string" && /^https?:\/\//.test(child)) urls.add(child);
      else visit(child);
    }
  };
  visit(payload.choices?.flatMap((choice) => choice.message?.annotations ?? []));
  visit(payload.sources);
  visit(payload.search_results);
  return urls;
}

function systemPrompt(mode: AiCoachRequest["mode"]) {
  const currentDate = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (mode === "project_intake") {
    return `你是「OPC创业红绿灯」的项目出发教练。当前日期是 ${currentDate}，时区 Asia/Shanghai。
你的任务是用 MECE、问题树和缺失信息检查，把创业想法逐轮理清。你是结构化思考引导者，不替用户做最终决定。
必须区分用户输入、已知事实、AI假设和待验证问题；不能把计划、推测、点赞或口头称赞当成现实证据。
不能预测创业成功率，不能决定灯号、证据分、预算、解锁或停止条件。不要输出内部逐字思维链，只输出可复核的结构化结果。

本次只处理 intakeContext.round 指定的一轮：
1. 只提出一个会改变目标用户、核心问题、现有资源或最大不确定性的问题。
2. 提供2至3个互斥、具体、可直接选择的快捷选项，并允许用户自由输入。
3. 根据 idea、project 和 history 更新 projectDraft；history 是用户已确认的信息，不是现实证据。
4. answerTarget 只能是 targetUser、painPoint、existingArtifact、biggestUncertainty 之一，并与问题真正对应。
5. 不使用网页搜索，不编造市场数字、竞品资料或用户反馈。
6. 所有字符串使用短句，整个JSON控制在800个汉字以内，避免重复项目描述。

只输出一个JSON对象，不要Markdown，不要额外字段：
{"summary":"不超过300字的可复核摘要","questions":["本轮唯一问题"],"missingFields":["仍缺失的信息，最多4项"],"suggestions":["最多3条下一步说明"],"projectDraft":{"name":"项目名","description":"项目描述","targetUser":"目标用户","painPoint":"核心问题","alternative":"当前替代方案或保守假设","acquisition":"首批用户来源或保守假设","monetization":"付费假设，不能写成事实","currentStage":"idea|research|demo|mvp|growth","existingArtifact":"现有资源","biggestUncertainty":"最大不确定性"},"clarification":{"round":1,"question":"本轮唯一问题","hint":"为什么这个问题会影响验证路线","options":["选项1","选项2"],"answerTarget":"targetUser|painPoint|existingArtifact|biggestUncertainty"}}。
clarification.round 必须等于输入的 intakeContext.round。`;
  }

  if (mode === "route_options") {
    return `你是「OPC创业红绿灯」的分析与验证路线教练。当前日期是 ${currentDate}，时区 Asia/Shanghai。
一次完成AI分析工作台和3条验证路线。使用MECE、问题树、假设驱动法，并按项目选择价值链、商业画布、SWOT或KSF中的适用方法。
必须区分用户输入中的已知事实与待验证假设。不能把计划、市场常识或AI推测当成现实证据；不能决定灯号、证据分、预算、解锁或停止条件。
只展示方法、结构化中间产出和结论，不展示内部逐字思维链。

analysisWorkbench必须包含恰好5个步骤。routeOptions必须恰好3条且标题和主要行动不同，每条包含适用条件、对象、行动、期限、成本、通过标准、停止标准和资源匹配理由。
本阶段不联网：market.tam、market.sam、market.growth必须写“本阶段未联网，不提供确定性数字”；business.arr必须写“无真实交易数据，不计算ARR”；business.breakEven不得包含月份或金额。
不得生成创业成功概率，validationStatus只写当前缺少什么现实验证。
如果answer包含“再来3条”，避开上一组的标题和主要行动；如果answer包含“用户自定义方向”，第三条路线围绕该方向补全可证伪标准。

高度精炼：summary不超过120字；步骤output不超过80字；knownFacts最多2条；assumptions最多3条；每条路线的文本字段使用一个短句；detailedBreakdown恰好3条。
只输出一个JSON对象，不要Markdown，不要输出下列结构之外的字段：
{"summary":"可复核摘要","questions":[],"missingFields":[],"suggestions":[],"analysisWorkbench":{"steps":[{"title":"步骤名","method":"所用方法","output":"中间产出"}],"knownFacts":["用户明确提供的事实"],"assumptions":["待验证假设"],"biggestRisk":"最大风险","priorityReason":"优先原因","methods":["3至6种方法"]},"routeOptions":[{"title":"路线名","rationale":"定位与资源匹配理由","suitability":"适用条件","audience":"目标对象","action":"具体行动","deadline":"期限","estimatedCost":"预计成本","difficulty":"★☆☆☆☆|★★☆☆☆|★★★☆☆|★★★★☆|★★★★★","passCriteria":"通过标准","stopCriteria":"停止标准","market":{"tam":"本阶段未联网，不提供确定性数字","sam":"本阶段未联网，不提供确定性数字","som":"首轮可验证样本范围","growth":"本阶段未联网，不提供确定性数字"},"business":{"model":"待验证商业模式","arr":"无真实交易数据，不计算ARR","breakEven":"获得交易证据后再测算"},"keySuccessFactors":["3至5项"],"landingCycle":"落地周期","validationStatus":"待验证：当前缺少的现实结果","detailedBreakdown":["假设","行动","判定"]}]}。`;
  }

  if (mode === "solution_refinement") {
    return `你是「OPC创业红绿灯」的单步方案教练。只处理stageContext.step指定的Who、What、Why、How或When & Where一步。
先根据stageContext.answers指出1至4个具体缺口，再输出参考改写draftFields。不得自动覆盖用户原答案，不得编造用户反馈、收入或市场事实。
每个draftFields.key必须来自输入字段；value要具体、可验证、适合一人或小团队。只输出JSON：
{"summary":"简短说明","questions":[],"missingFields":[],"suggestions":[],"solutionRefinement":{"step":"who|what|why|how|when","gaps":["具体缺口"],"draftFields":[{"key":"输入字段key","value":"参考改写"}],"rationale":"为什么这样改"}}。`;
  }

  if (mode === "research_analysis") {
    return `你是「OPC创业红绿灯」的联网资料分析员。必须使用web_search检索当前项目的市场结构、至少3个竞品或替代方案、行业趋势、公开用户反馈、政策法规与隐私要求。
优先监管机构、政府、企业官网和研究机构；社区内容只能作为用户声音。每一类必须保留真实来源标题、完整URL、发布日期（未知则写“未标注”）和来源类型。
不得伪造URL、市场数字或发布日期；资料冲突、过期和缺口写入conflicts/gaps。五类items顺序为market、competitor、trend、feedback、policy。只输出JSON：
{"summary":"资料结论","questions":[],"missingFields":[],"suggestions":[],"researchReport":{"items":[{"id":"market|competitor|trend|feedback|policy","label":"类别","title":"结论","summary":"摘要","findings":["发现"],"sources":[{"title":"来源标题","url":"https://...","publishedAt":"日期或未标注","sourceType":"official|regulator|company|research|community|media"}]}],"conflicts":["冲突"],"gaps":["缺口"],"searchedAt":"当前日期"}}。`;
  }

  if (mode === "red_team_analysis") {
    return `你是「OPC创业红绿灯」红队。基于用户确认方案和stageContext.researchReport，从需求真实性、竞争环境、技术可行性、商业模式、团队能力、时机与政策六维选出恰好3个最高优先级项目风险。
每个风险只给1个最优先缓解方案，必须包含成本、周期、验证动作、可信度等级与依据。所有字段用一个短句。联网资料缺失时必须明确依据只是待验证推断。
不能自行宣布项目安全，不能决定灯号、预算或解锁。只输出JSON：
{"summary":"红队摘要","questions":[],"missingFields":[],"suggestions":[],"redTeamRisks":[{"id":"英文id","dimension":"需求真实性|竞争环境|技术可行性|商业模式|团队能力|时机与政策","title":"风险","problem":"问题","evidence":"依据及来源边界","severity":"高危|中风险|低风险","impact":"影响","mitigations":[{"title":"方案","description":"说明","cost":"低|中|高","duration":"周期","credibility":"中|高","validationAction":"现实验证动作","credibilityBasis":"可信度依据","update":"用户选择后建议如何更新方案"}]}]}。`;
  }

  if (mode === "task_decomposition") {
    return `你是「OPC创业红绿灯」路线地图教练。根据最终方案、已处理风险、当前资源和最大不确定性生成恰好3个里程碑，每个只给1个最优先任务。
任务必须适合一人或小团队，产生外部结果，优先访谈、招募、试用、报价、预售、付款、复用和转介绍；不得把继续开发完整产品作为默认任务。
每个任务必须包含目标、动作、工具、交付物/证据提交方式、耗时、成本、通过和停止标准。只输出JSON：
{"summary":"路线摘要","questions":[],"missingFields":[],"suggestions":[],"roadmapDraft":{"milestones":[{"id":"m1","title":"里程碑","duration":"周期","goal":"目标","success":"成功标准","risk":"主要风险","stop":"停止条件","tasks":[{"day":1,"title":"任务","detail":"行动说明","target":"目标","actions":["具体动作"],"tools":[{"title":"工具","content":"模板内容"}],"duration":"耗时","estimatedCost":"成本","evidenceMethod":"提交方式","passCriteria":"通过标准","stopCriteria":"停止标准"}]}]}}。`;
  }

  if (mode === "evidence_review") {
    return `你是「OPC创业红绿灯」证据审核助手。只从stageContext.record提取已经提交的行为、人数或次数、用户原话和材料类型，不得补写不存在的事实。
检查是否缺少明确行为、数量、原话或可复核材料，并给出简短补证建议。AI结果只是建议，不能决定reviewStatus、证据分、灯号、投入上限或任务解锁。
recommendation为confirm只表示材料具备人工确认条件，不代表已经确认。只输出JSON：
{"summary":"审核摘要","questions":[],"missingFields":["缺口"],"suggestions":["补证建议"],"evidenceReview":{"extracted":{"behavior":"实际行为","quantity":0,"frequency":"频次说明","userQuote":"用户原话或空字符串","materialType":"材料类型"},"missing":["缺失项"],"quality":"insufficient|reviewable|strong","explanation":"质量说明","supplementation":["补证动作"],"recommendation":"confirm|supplement|exclude"}}。`;
  }

  if (mode === "cycle_review") {
    return `你是「OPC创业红绿灯」成长回顾助手。只依据stageContext.confirmedEvidence、任务结果、假设结算和规则建议总结本轮，不能把待补证、已排除记录或任务打勾当成现实证据。
说明现实行动和新增证据；假设只能标记supported、weakened或unverified；总结风险变化和失败原因；下一轮只提出一个最高优先目标。
不得输出创业成功率、“超过多少创业者”等无依据比较；不得修改规则建议、灯号、证据分或投入上限。只输出JSON：
{"summary":"复盘摘要","questions":[],"missingFields":[],"suggestions":[],"cycleReview":{"summary":"本轮总结","achievements":["现实行动和新增证据"],"riskChanges":["风险变化"],"nextGoal":"下一轮唯一目标","rationale":"选择原因","hypothesisChanges":[{"hypothesis":"假设","status":"supported|weakened|unverified","evidence":"证据依据"}],"failureReasons":["失败或未完成原因"],"highestRisk":"当前最高风险"}}。`;
  }

  const intakeInstruction = mode === "survey_generation"
        ? "当前任务是生成 surveyDraft，包含3至8个问题，只问现实经历、频率、替代方式和行动意愿，禁止询问用户是否喜欢创意。"
        : "当前任务是拆假设、检查计划、红队追问或优化现实任务。";

  return `你是「OPC创业红绿灯」的AI路线规划员。${intakeInstruction}
禁止预测创业成功率，禁止把AI推测、计划或市场常识当成现实证据，禁止决定红黄绿蓝灯、投入上限或停止条件。
你的价值是把简单描述加工成结构化项目、低成本任务和可证伪标准，而不是复述用户输入。
route_options必须高度精炼：summary不超过120字；每个步骤output不超过80字；knownFacts最多2条；assumptions最多3条；每条路线rationale、suitability、action、passCriteria、stopCriteria均使用一个短句；detailedBreakdown恰好3条。避免重复解释同一信息。
只输出JSON对象，不要Markdown。结构必须符合：
{"summary":"不超过600字","questions":["最多3条"],"missingFields":["最多6项"],"suggestions":["最多6条"],"revisedAction":"可选","projectDraft":{"name":"项目名","description":"项目描述","targetUser":"目标用户","painPoint":"痛点","alternative":"替代方案","acquisition":"首批用户来源","monetization":"付费假设","currentStage":"idea|research|demo|mvp|growth","existingArtifact":"已有成果","biggestUncertainty":"最大不确定性"},"analysisWorkbench":{"steps":[{"title":"步骤名","method":"所用方法","output":"可复核中间产出"}],"knownFacts":["仅来自用户输入的事实"],"assumptions":["待验证假设"],"biggestRisk":"最大风险","priorityReason":"优先验证原因","methods":["使用的方法"]},"routeOptions":[{"title":"路线名","rationale":"定位和资源匹配理由","suitability":"适用条件","audience":"目标对象","action":"具体行动","deadline":"期限","estimatedCost":"预计成本","difficulty":"★☆☆☆☆|★★☆☆☆|★★★☆☆|★★★★☆|★★★★★","passCriteria":"通过标准","stopCriteria":"停止标准","market":{"tam":"无来源则明确不提供","sam":"无来源则明确不提供","som":"首轮可验证样本，不冒充市场规模","growth":"无来源则明确不提供"},"business":{"model":"待验证商业模式","arr":"无交易数据则不计算","breakEven":"无交易数据则不计算"},"keySuccessFactors":["3至5项"],"landingCycle":"落地周期","validationStatus":"待验证状态，不是成功概率","detailedBreakdown":["3至6项"]}],"surveyDraft":{"title":"问卷名","introduction":"说明","questions":[{"id":"英文标识","prompt":"问题","type":"single_choice|multiple_choice|short_text|long_text|scale","required":true,"options":[]}]},"taskDrafts":[{"day":1,"title":"任务名","detail":"行动","passCriteria":"通过标准","stopCriteria":"停止标准"}],"cycleReview":{"summary":"本轮总结","achievements":["最多4项"],"riskChanges":["最多4项"],"nextGoal":"下一轮唯一目标","rationale":"安排原因"}}`;
}
