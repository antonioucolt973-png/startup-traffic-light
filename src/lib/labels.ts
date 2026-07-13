export const stageLabels: Record<string, string> = {
  idea: "只有想法",
  research: "调研中",
  demo: "已有演示版",
  mvp: "已有最小版本",
  growth: "已有用户运营中",
};

export function getStageLabel(stage: string) {
  return stageLabels[stage] ?? stage;
}

export function getEvidenceLevelLabel(level: number) {
  return `第 ${level} 级`;
}

export const evidenceTypeLabels = {
  research: "资料与替代方案",
  interview: "真实用户访谈",
  problem_story: "最近一次问题故事",
  test_post: "公开测试内容",
  active_interest: "主动留言或私信",
  signup: "留资或登记",
  trial: "原型或人工服务试用",
  quote: "报价接受或预订",
  payment: "实际付款",
  repeat: "复用或留存",
  referral: "转介绍",
} as const;

export const evidenceSourceLabels = {
  ai_inference: "AI 推测",
  founder_assumption: "个人假设",
  web_research: "网络资料",
  founder_report: "创始人转述",
  user_feedback: "用户明确反馈",
  user_behavior: "用户实际行为",
  payment_or_retention: "付款或复用行为",
} as const;
