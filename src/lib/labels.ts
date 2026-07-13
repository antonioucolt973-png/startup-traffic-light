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
