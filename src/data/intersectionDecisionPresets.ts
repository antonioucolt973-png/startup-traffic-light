import type { Project } from "../types";

export type SolutionField = "who" | "what" | "why" | "how" | "when";

export interface SolutionStepPreset {
  id: SolutionField;
  shortLabel: string;
  title: string;
  question: string;
  hint: string;
  fields: Array<{ key: string; label: string; placeholder: string }>;
}

export interface ResearchPreset {
  id: string;
  label: string;
  title: string;
  summary: string;
  findings: string[];
}

export interface MitigationPreset {
  title: string;
  description: string;
  cost: "低" | "中" | "高";
  duration: string;
  credibility: "中" | "高";
  update: string;
}

export interface RiskPreset {
  id: string;
  dimension: string;
  title: string;
  problem: string;
  evidence: string;
  severity: "高危" | "中风险" | "低风险";
  impact: string;
  mitigations: MitigationPreset[];
}

export interface RoadmapPreset {
  id: string;
  title: string;
  duration: string;
  goal: string;
  tasks: string[];
  success: string;
  risk: string;
  stop: string;
}

export const solutionSteps: SolutionStepPreset[] = [
  {
    id: "who",
    shortLabel: "Who",
    title: "明确目标用户",
    question: "你的目标用户是谁？请具体描述。",
    hint: "越具体越好。不要只写“年轻女性”，要写清楚她们在什么场景下、有什么行为特征。",
    fields: [
      { key: "demographic", label: "人口统计特征", placeholder: "例如：22-35岁、经常网购服装的城市女性" },
      { key: "psychographic", label: "心理特征", placeholder: "例如：重视穿搭效果，担心买错和退货麻烦" },
      { key: "behavior", label: "行为特征", placeholder: "例如：每月至少网购服装1次，会查看买家秀和穿搭内容" },
      { key: "portrait", label: "用户画像确认", placeholder: "用一句话总结第一批要验证的人" },
    ],
  },
  {
    id: "what",
    shortLabel: "What",
    title: "定义核心问题",
    question: "用户真正需要解决的核心问题是什么？",
    hint: "描述问题本身，不要把“一键换衣”这样的解决方案写成问题。",
    fields: [
      { key: "pain", label: "用户当前痛点", placeholder: "例如：下单前无法可靠判断衣服穿在自己身上的效果" },
      { key: "severity", label: "痛点严重程度（1-10分）", placeholder: "例如：7分，并说明为什么" },
      { key: "alternative", label: "现有解决方案", placeholder: "例如：商品图、买家秀、线下试穿、退货" },
      { key: "shortage", label: "现有方案的不足", placeholder: "例如：无法呈现自己的身材与肤色，退货耗时" },
    ],
  },
  {
    id: "why",
    shortLabel: "Why",
    title: "提出价值主张",
    question: "你的方案为什么值得用户改变现有做法？",
    hint: "说清楚具体收益和差异，不要只写“更智能、更方便”。",
    fields: [
      { key: "solution", label: "你的解决方案", placeholder: "例如：上传个人照片，一键预览指定服装的上身效果" },
      { key: "difference", label: "为什么比现有方案好", placeholder: "例如：基于用户自己的照片，而不是通用模特图" },
      { key: "benefit", label: "用户获得的具体收益", placeholder: "例如：更快判断是否适合，减少买错和退货" },
      { key: "proposition", label: "价值主张确认", placeholder: "用一句话写出你的核心价值主张" },
    ],
  },
  {
    id: "how",
    shortLabel: "How",
    title: "设计商业模式",
    question: "这个方案准备如何收费、交付并形成收入？",
    hint: "比赛阶段先写可验证的收费假设，不把预测收入当成已实现结果。",
    fields: [
      { key: "charge", label: "收费模式", placeholder: "例如：个人按次付费，或服装店工具订阅" },
      { key: "pricing", label: "定价策略", placeholder: "例如：个人9.9元/次，店铺299元/月" },
      { key: "cost", label: "成本结构", placeholder: "例如：模型调用、服务器、人工服务与获客成本" },
      { key: "profit", label: "盈利推演", placeholder: "例如：先验证付费意愿，再判断哪类客户可覆盖交付成本" },
    ],
  },
  {
    id: "when",
    shortLabel: "When & Where",
    title: "规划执行路径",
    question: "你准备分几个阶段把方案落地？",
    hint: "先做最小验证，再决定是否开发完整产品。",
    fields: [
      { key: "mvp", label: "MVP阶段", placeholder: "例如：用现有可点击Demo完成5次人工陪跑试用" },
      { key: "milestone", label: "关键里程碑", placeholder: "例如：需求验证、效果优化、种子用户、付费验证" },
      { key: "resource", label: "资源需求", placeholder: "例如：现有Demo、5位朋友、服装图片、人工服务" },
      { key: "timeline", label: "时间线确认", placeholder: "例如：4周完成第一轮需求与付费验证" },
    ],
  },
];

export const researchPresets: ResearchPreset[] = [
  {
    id: "market",
    label: "市场规模",
    title: "服装电商需求广，但项目还没有自己的市场证据",
    summary: "大市场不等于当前方案能够获得用户。比赛阶段只把市场信息作为风险背景。",
    findings: ["服装是高频电商品类", "退货与尺码、上身效果判断相关", "当前项目尚未完成真实目标用户访谈"],
  },
  {
    id: "competitor",
    label: "竞品情况",
    title: "平台虚拟试穿、穿搭内容和线下试衣都是替代方案",
    summary: "用户已经有免费或低成本替代方案，单纯展示技术效果不足以形成付费理由。",
    findings: ["电商平台自带试穿能力", "小红书、买家秀提供穿搭参考", "线下试穿和无理由退货仍是强替代方案"],
  },
  {
    id: "trend",
    label: "行业趋势",
    title: "生成式图像降低了Demo门槛，也降低了技术稀缺性",
    summary: "技术可用性提升，但竞争者复制功能的速度也会更快。",
    findings: ["图像生成能力快速普及", "用户更关注真实度与速度", "平台拥有商品、用户和交易数据优势"],
  },
  {
    id: "feedback",
    label: "用户评论",
    title: "真实度、隐私和操作成本是最常见顾虑",
    summary: "比赛预设评论摘要不能代替项目自己的用户访谈。",
    findings: ["担心换衣效果不像本人", "不愿上传清晰正面照片", "如果步骤太多会直接放弃"],
  },
  {
    id: "policy",
    label: "政策法规",
    title: "照片、肖像和生成内容需要明确授权与删除机制",
    summary: "商业化前必须处理数据存储、用户授权和生成内容使用边界。",
    findings: ["明确照片使用目的", "允许用户删除原图和结果", "避免把用户图片用于未授权训练或营销"],
  },
];

export const riskPresets: RiskPreset[] = [
  {
    id: "accuracy",
    dimension: "技术可行性",
    title: "换衣效果准确度不足",
    problem: "方案假设用户会根据生成效果决定购买，但现有Demo是否能稳定保留身材、肤色和服装细节尚未验证。",
    evidence: "比赛预设分析：效果不可信会直接破坏购买判断，技术演示成功不等于用户愿意依赖结果。",
    severity: "高危",
    impact: "如果生成结果不能帮助用户做决定，产品核心价值不成立。",
    mitigations: [
      { title: "先验证决策帮助度", description: "用现有Demo让5位目标用户对真实商品做前后判断，记录结果是否改变购买选择。", cost: "低", duration: "3天", credibility: "高", update: "先用5次真实商品试用验证换衣结果是否能改变购买判断，再决定是否优化模型。" },
      { title: "限定服装与照片条件", description: "只支持正面照和上装，减少不可控场景。", cost: "中", duration: "1周", credibility: "高", update: "MVP只支持正面半身照与上装，先保证限定场景的稳定效果。" },
      { title: "改为人工确认服务", description: "生成后由人工筛选明显错误结果，再交给首批用户。", cost: "中", duration: "1周", credibility: "中", update: "首批试用采用AI生成加人工审核，记录错误类型后再评估自动化。" },
    ],
  },
  {
    id: "privacy",
    dimension: "需求真实性",
    title: "用户不愿上传个人照片",
    problem: "方案依赖用户上传照片，但目标用户是否愿意提供清晰照片尚未验证。",
    evidence: "比赛预设分析：肖像隐私顾虑可能让用户在体验第一步就流失。",
    severity: "高危",
    impact: "如果照片上传率低，后续效果、留资和付费都无法验证。",
    mitigations: [
      { title: "先测上传意愿", description: "向20位目标用户展示授权说明，记录愿意上传的人数和拒绝理由。", cost: "低", duration: "3天", credibility: "高", update: "先完成20次照片上传意愿测试，达到30%再继续投入。" },
      { title: "提供本地删除承诺", description: "明确原图用途、保存时间和一键删除机制。", cost: "中", duration: "1周", credibility: "中", update: "在体验前展示照片用途、保存时间和删除入口，再测试上传转化。" },
      { title: "先用非露脸照片", description: "允许裁剪脸部或使用半身照，降低隐私门槛。", cost: "中", duration: "1周", credibility: "中", update: "MVP允许遮挡脸部和裁剪照片，比较两种流程的完成率。" },
    ],
  },
  {
    id: "payment",
    dimension: "商业模式",
    title: "个人用户付费意愿低",
    problem: "用户可能觉得试穿有趣，但不愿为单次生成或订阅付费。",
    evidence: "比赛预设分析：免费买家秀、退货和平台功能会压低个人付费意愿。",
    severity: "高危",
    impact: "如果个人付费不能覆盖生成和获客成本，商业模式无法成立。",
    mitigations: [
      { title: "先做免费MVP验证付费意愿", description: "先让用户完成试用，再展示9.9元继续使用选项。", cost: "低", duration: "2周", credibility: "高", update: "先免费完成首次试用，在结果页测试9.9元继续使用或预约意愿。" },
      { title: "调整为按次付费", description: "取消订阅假设，降低首次支付门槛。", cost: "中", duration: "2周", credibility: "中", update: "个人端先测试9.9元按次付费，不验证月度订阅。" },
      { title: "转向服装店客户", description: "把付费方改为希望提高转化或降低退货的店铺。", cost: "高", duration: "1个月", credibility: "高", update: "同时访谈5家服装店，比较店铺订阅与个人按次付费的意愿。" },
    ],
  },
  {
    id: "acquisition",
    dimension: "商业模式",
    title: "获客成本可能高于收入",
    problem: "如果需要持续投放才能获得个人用户，低客单价难以覆盖获客成本。",
    evidence: "比赛预设分析：项目目前只有朋友试用资源，没有稳定获客入口。",
    severity: "中风险",
    impact: "产品能用但无法低成本找到用户，仍不能形成可持续业务。",
    mitigations: [
      { title: "先测试私域转介绍", description: "通过朋友和穿搭社群完成第一批20次触达。", cost: "低", duration: "1周", credibility: "中", update: "第一轮只使用朋友转介绍和穿搭社群，不购买广告流量。" },
      { title: "与服装店合作获客", description: "让店铺把工具提供给现有顾客。", cost: "中", duration: "2周", credibility: "高", update: "寻找2家服装店测试店内顾客体验入口。" },
      { title: "做试穿对比内容", description: "发布真实商品试穿前后对比，记录自然咨询。", cost: "低", duration: "1周", credibility: "中", update: "发布3条试穿对比内容，以主动咨询数量判断内容获客能力。" },
    ],
  },
  {
    id: "platform",
    dimension: "竞争环境",
    title: "电商平台可能快速复制功能",
    problem: "平台拥有商品图片、用户和交易数据，单一换衣功能缺少长期壁垒。",
    evidence: "比赛预设分析：生成能力正在普及，功能本身容易同质化。",
    severity: "中风险",
    impact: "即使早期有用户，也可能被平台免费功能替代。",
    mitigations: [
      { title: "聚焦跨平台衣橱", description: "帮助用户比较多个平台商品，而不是依赖单一店铺。", cost: "中", duration: "1个月", credibility: "中", update: "价值主张调整为跨平台商品对比和个人穿搭记录。" },
      { title: "积累个人适配反馈", description: "记录用户对版型和风格的反馈，形成个性化数据。", cost: "中", duration: "1个月", credibility: "中", update: "每次试用记录用户对版型、风格和购买结果的反馈。" },
      { title: "先做店铺服务", description: "用人工服务和运营能力形成短期交付差异。", cost: "低", duration: "2周", credibility: "高", update: "短期不与平台拼功能，先为小服装店提供人工辅助试穿服务。" },
    ],
  },
  {
    id: "compliance",
    dimension: "时机与政策",
    title: "肖像、隐私和图片存储风险",
    problem: "用户照片属于敏感素材，商业化需要明确授权、存储和删除规则。",
    evidence: "比赛预设分析：当前Demo没有形成完整的隐私授权与数据处理说明。",
    severity: "中风险",
    impact: "处理不当会造成用户投诉、信任损失和合规成本。",
    mitigations: [
      { title: "测试阶段不长期存图", description: "生成完成后在约定时间内删除原图和结果。", cost: "低", duration: "3天", credibility: "高", update: "测试阶段默认24小时删除原图，不用于训练和营销。" },
      { title: "增加明确授权流程", description: "在上传前说明用途、保存期限和退出方式。", cost: "中", duration: "1周", credibility: "高", update: "上传前增加单独授权确认，并提供结果与原图删除入口。" },
      { title: "只做现场演示", description: "首轮测试由用户现场上传并当场删除。", cost: "低", duration: "1周", credibility: "中", update: "第一轮采用现场试用和当场删除，暂不开放远程照片上传。" },
    ],
  },
];

export const roadmapPresets: RoadmapPreset[] = [
  { id: "m1", title: "M1 验证需求", duration: "1周", goal: "确认目标用户是否愿意上传照片并依赖换衣结果做购买判断。", tasks: ["访谈5位目标用户", "完成20次上传意愿测试"], success: "至少3人承认问题，上传意愿达到30%", risk: "用户只觉得有趣，没有真实决策需求", stop: "20次触达后少于3人愿意上传照片" },
  { id: "m2", title: "M2 优化换衣Demo", duration: "1周", goal: "在限定场景下验证结果是否足够可信。", tasks: ["限定正面半身照与上装", "完成5次真实商品对比试用"], success: "至少3人认为结果能帮助购买判断", risk: "效果失真导致用户不信任", stop: "5次试用中少于2人认为结果有帮助" },
  { id: "m3", title: "M3 获取种子用户", duration: "1周", goal: "通过私域、穿搭社群或店铺合作获得主动试用。", tasks: ["发布3条试穿对比内容", "邀请10位用户完成体验"], success: "至少5人完成体验，3人愿意留下联系方式", risk: "获客入口没有自然反馈", stop: "完成30次有效触达仍无人主动咨询" },
  { id: "m4", title: "M4 验证付费或店铺合作", duration: "1周", goal: "比较个人按次付费与店铺工具服务两种商业路径。", tasks: ["测试9.9元按次付费", "访谈5家服装店"], success: "出现至少1次付款、预订或店铺试用承诺", risk: "付费金额无法覆盖交付成本", stop: "两类客户都拒绝付费且没有明确下一步" },
];

export function buildSolutionPreset(project: Project): Record<SolutionField, Record<string, string>> {
  const target = project.targetUser || "经常网购服装、担心上身效果的22-35岁城市女性";
  return {
    who: {
      demographic: target,
      psychographic: "重视穿搭效果，担心买错、退货和照片与真人差距",
      behavior: "每月至少网购服装1次，下单前会查看商品图、买家秀和穿搭内容",
      portrait: `第一批验证对象是${target}`,
    },
    what: {
      pain: project.painPoint || "下单前无法可靠判断衣服穿在自己身上的效果",
      severity: "7分：问题会影响购买决定，但用户仍可通过退货和线下试穿解决",
      alternative: project.alternative || "商品图、买家秀、小红书穿搭内容、线下试穿和退货",
      shortage: "无法呈现用户自己的身材和肤色，退货与线下试穿需要额外时间",
    },
    why: {
      solution: "用户上传个人照片后，一键预览指定服装的上身效果",
      difference: "基于用户自己的照片生成，而不是只查看模特图和他人买家秀",
      benefit: "更快判断衣服是否适合自己，减少买错和退货",
      proposition: "让经常网购服装的女性在下单前先看到自己的穿衣效果",
    },
    how: {
      charge: project.monetization || "个人按次付费，同时测试服装店工具订阅",
      pricing: "个人9.9元/次；店铺测试价299元/月",
      cost: "模型调用、图片存储、服务器、人工审核和获客",
      profit: "先比较个人付费与店铺合作意愿，再选择能覆盖交付成本的模式",
    },
    when: {
      mvp: project.existingArtifact || "使用现有可点击换衣Demo完成5次人工陪跑试用",
      milestone: "需求验证 → Demo效果验证 → 种子用户 → 付费或店铺合作",
      resource: "可点击Demo、5位愿意试用的朋友、服装商品图和人工服务时间",
      timeline: "4周完成第一轮需求、效果、获客和付费验证",
    },
  };
}
