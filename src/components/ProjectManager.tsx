import { ArrowRight, Check, FilePlus2, Flag, Plus, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import type { ProjectLibraryEntry } from "../types";

interface ProjectManagerProps {
  projects: ProjectLibraryEntry[];
  activeProjectId: string;
  onClose: () => void;
  onSelect: (projectId: string) => void;
  onCreateDemo: () => void;
  onCreateBlank: () => void;
}

export function ProjectManager({
  projects,
  activeProjectId,
  onClose,
  onSelect,
  onCreateDemo,
  onCreateBlank,
}: ProjectManagerProps) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="projectManagerBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="projectManagerDialog" role="dialog" aria-modal="true" aria-labelledby="project-manager-title">
        <header className="projectManagerHeader">
          <div><span><Flag size={16} />项目工作区</span><h2 id="project-manager-title">我的项目</h2><p>新建项目不会覆盖当前轮次、任务或证据。</p></div>
          <button type="button" onClick={onClose} aria-label="关闭我的项目"><X size={19} /></button>
        </header>

        <section className="projectCreationOptions" aria-label="新建项目方式">
          <button className="demoProjectOption" type="button" onClick={onCreateDemo}>
            <i><Sparkles size={20} /></i>
            <span><small>比赛推荐</small><strong>一键试衣演示项目</strong><em>预填案例想法，从第 1 轮完整运行</em></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={onCreateBlank}>
            <i><FilePlus2 size={20} /></i>
            <span><small>自由测试</small><strong>空白项目</strong><em>从空白输入开始验证其他创业想法</em></span>
            <Plus size={18} />
          </button>
        </section>

        <div className="projectListHeading"><strong>已有项目</strong><span>{projects.length} 个</span></div>
        <div className="projectManagerList">
          {projects.map((entry) => {
            const activeCycle = entry.workspace.cycles.find((cycle) => cycle.id === entry.workspace.activeCycleId);
            const project = entry.workspace.project;
            const isActive = entry.id === activeProjectId;
            const evidenceCount = entry.workspace.evidenceRecords.filter((record) => record.reviewStatus === "confirmed").length;
            return (
              <button key={entry.id} className={isActive ? "active" : ""} type="button" onClick={() => onSelect(entry.id)}>
                <span className="projectListIcon"><Flag size={17} /></span>
                <span className="projectListMain">
                  <strong>{project.name || "未命名项目"}</strong>
                  <em>{project.description || "尚未输入创业想法"}</em>
                  <small>第 {activeCycle?.cycleNumber ?? 1} 轮 · {entry.workspace.tasks.length} 项任务 · {evidenceCount} 条证据</small>
                </span>
                <span className="projectListAction">{isActive ? <><Check size={15} />当前项目</> : <>进入项目<ArrowRight size={14} /></>}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
