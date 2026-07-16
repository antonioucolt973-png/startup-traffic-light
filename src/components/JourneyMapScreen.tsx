import { ArrowRight, BrainCircuit, CircleAlert, MapPinned, Route, Sparkles } from "lucide-react";
import type { DecisionReport, GateId, JourneyCycle, Project } from "../types";
import { CommercialRoadmap } from "./CommercialRoadmap";

interface JourneyMapScreenProps {
  project: Project;
  report: DecisionReport;
  activeGate: GateId;
  onGateChange: (gate: GateId) => void;
  onEnterGate: () => void;
  activeCycle?: JourneyCycle;
}

export function JourneyMapScreen({ project, report, activeGate, onGateChange, onEnterGate, activeCycle }: JourneyMapScreenProps) {
  const passedCount = report.roadtestChecks.filter((gate) => gate.status === "已通过").length;
  const activeCheck = report.roadtestChecks.find((check) => check.id === activeGate) ?? report.roadtestChecks[0];
  const facts = [
    project.targetUser ? `目标用户：${project.targetUser}` : "目标用户仍需确认",
    project.painPoint ? `待验证问题：${project.painPoint}` : "真实问题仍需确认",
    project.existingArtifact ? `现有资源：${project.existingArtifact}` : "可以从手动服务或原型开始",
  ];

  return (
    <div className="mapScreen roadmapScreen">
      <header className="roadmapHero">
        <div>
          <span className="routeEyebrow"><MapPinned size={16} />第 {activeCycle?.cycleNumber ?? 1} 轮路线</span>
          <h1>地图已画好，但每一段都要靠真实证据前进。</h1>
          <p>AI 把项目拆成可执行里程碑和当前验证站；灯号、投入上限和是否继续仍由真实用户行为决定。</p>
        </div>
        <article className={`roadmapLight light-${report.light}`}>
          <span>当前创业灯</span><strong>{report.lightLabel}</strong><p>证据 {report.evidenceScore}/100</p>
          <div><i /><i /><i /><i /></div>
        </article>
      </header>

      <section className="aiPlanningWorkbench" aria-label="AI 规划摘要">
        <header><div><Sparkles size={18} /><span>AI 规划工作台</span></div><small>展示结构化判断，不展示模型内部推理</small></header>
        <div className="aiPlanningGrid">
          <article><span>已知信息</span><ul>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></article>
          <article className="risk"><span>本轮最大风险</span><strong>{report.mainRisks[0] || "先确认用户是否真实存在"}</strong><p>{report.lightReason}</p></article>
          <article className="focus"><span>为什么先做这里</span><strong>{report.currentFocus}</strong><p>缺口最小、成本最低，能最快带来外部行为。</p></article>
          <article className="action"><span>AI 建议下一步</span><strong>{report.nextActions[0] || "先选择一个路口，生成可执行路线"}</strong><button type="button" onClick={onEnterGate}>去处理当前路口 <ArrowRight size={15} /></button></article>
        </div>
      </section>

      <CommercialRoadmap
        project={project}
        checks={report.roadtestChecks}
        activeGate={activeGate}
        onSelectGate={onGateChange}
      />

      <section className="routeStationPanel">
        <div className="routeStationIcon"><Route size={23} /></div>
        <div><span>当前验证站</span><strong>{activeCheck.title}</strong><p>{activeCheck.scene}</p></div>
        <div className="routeStationStatus"><span>{activeCheck.status}</span><p>{activeCheck.feedback}</p></div>
        <button className="primaryButton" type="button" onClick={onEnterGate}>处理这个路口 <ArrowRight size={17} /></button>
      </section>

      <footer className="roadmapProgressFooter">
        <div><BrainCircuit size={18} /><span>已消除风险</span><strong>{passedCount}/6 个验证站已通过</strong></div>
        <div><CircleAlert size={18} /><span>下一次复查</span><strong>{report.nextReviewTrigger}</strong></div>
      </footer>
    </div>
  );
}
