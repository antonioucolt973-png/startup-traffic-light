import type { Project } from "../types";

export const competitionTryOnIdea = "我想做一个 AI 一键试衣助手。用户上传自己的照片和衣服图，生成接近真实的试穿效果，帮助经常网购服装、担心上身效果的年轻女性在下单前判断衣服是否适合自己。目前已有一个可点击的换衣 Demo 和 5 位愿意试用的朋友。";

export function isCompetitionPresetIdea(project: Pick<Project, "name">, idea: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s，。、“”‘’]/g, "");
  const normalizedName = normalize(project.name);
  const normalizedIdea = normalize(idea);
  const canonicalIdea = normalize(competitionTryOnIdea);
  const isTryOnProject = normalizedName.includes("ai试衣助手") || normalizedName.includes("一键试衣");
  const isCanonicalIdea = normalizedIdea === canonicalIdea;
  const hasPresetSignals = normalizedIdea.includes("一键试衣")
    && normalizedIdea.includes("用户上传")
    && normalizedIdea.includes("照片")
    && normalizedIdea.includes("衣服图")
    && normalizedIdea.includes("demo")
    && (normalizedIdea.includes("5位") || normalizedIdea.includes("5个"));

  // 比赛演示项目可能在体验过程中被 AI 回填为较短描述；项目名称命中时仍必须保持预设优先。
  return isTryOnProject || isCanonicalIdea || hasPresetSignals;
}
