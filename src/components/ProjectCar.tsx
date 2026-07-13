import { CarFront, PackageCheck, Timer, WalletCards } from "lucide-react";
import { motion } from "motion/react";
import { getStageLabel } from "../lib/labels";
import type { Project } from "../types";

interface ProjectCarProps {
  project: Project;
  compact?: boolean;
}

export function ProjectCar({ project, compact = false }: ProjectCarProps) {
  return (
    <article className={`projectCar ${compact ? "compact" : ""}`}>
      <motion.div
        className="projectCarIcon"
        initial={{ x: -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <CarFront size={compact ? 22 : 30} />
      </motion.div>
      <div className="projectCarBody">
        <span>当前项目车</span>
        <strong>{project.name || "等待命名的项目"}</strong>
        <p>{project.existingArtifact || project.biggestUncertainty || "补充现有成果和最大不确定性后再上路。"}</p>
        <div className="projectCarStats">
          <span><PackageCheck size={14} />{getStageLabel(project.currentStage)}</span>
          <span><Timer size={14} />已投入 {project.timeInvestedDays} 天</span>
          <span><WalletCards size={14} />{project.moneyInvested} 元</span>
        </div>
      </div>
    </article>
  );
}
