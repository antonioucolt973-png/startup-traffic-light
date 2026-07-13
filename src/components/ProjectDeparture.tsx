import { ArrowRight, Check, CircleGauge, PackageOpen, UsersRound } from "lucide-react";
import { useState } from "react";
import { stageLabels } from "../lib/labels";
import type { Project } from "../types";
import type { ExampleCase } from "../data/examples";
import { ProjectCar } from "./ProjectCar";

interface ProjectDepartureProps {
  project: Project;
  onChange: (project: Project) => void;
  examples: ExampleCase[];
  onLoadExample: (index: number) => void;
  onReady: () => void;
}

const sections = [
  { label: "项目是什么", icon: CircleGauge },
  { label: "投入与成果", icon: PackageOpen },
  { label: "真实行动", icon: UsersRound },
];

export function ProjectDeparture({ project, onChange, examples, onLoadExample, onReady }: ProjectDepartureProps) {
  const [section, setSection] = useState(0);
  const [showValidation, setShowValidation] = useState(false);

  function update<K extends keyof Project>(key: K, value: Project[K]) {
    onChange({ ...project, [key]: value });
    if (key === "name" || key === "targetUser" || key === "painPoint") setShowValidation(false);
  }

  function continueJourney() {
    if (section < sections.length - 1) {
      setSection(section + 1);
      return;
    }
    if (!project.name.trim() || !project.targetUser.trim() || !project.painPoint.trim()) {
      setShowValidation(true);
      setSection(0);
      return;
    }
    onReady();
  }

  return (
    <div className="departureScreen">
      <section className="departureIntro">
        <div>
          <span className="routeEyebrow">项目出发</span>
          <h1>把想法装上车，先看它现在到底开到了哪里。</h1>
          <p>系统不会预测成功率，只判断当前投入、行动和现实证据是否匹配。</p>
        </div>
        <ProjectCar project={project} />
      </section>

      <div className="departureTabs" role="tablist" aria-label="项目出发步骤">
        {sections.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={section === index ? "active" : ""}
              onClick={() => setSection(index)}
              type="button"
            >
              <span>{index < section ? <Check size={15} /> : String(index + 1).padStart(2, "0")}</span>
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="departureForm">
        {section === 0 && (
          <div className="departureFields">
            <label><span>项目名称</span><input value={project.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：AI 试衣助手" /></label>
            <label><span>一句话描述</span><textarea value={project.description} onChange={(event) => update("description", event.target.value)} placeholder="它为谁解决什么问题" /></label>
            <label><span>目标用户</span><input value={project.targetUser} onChange={(event) => update("targetUser", event.target.value)} placeholder="具体到能找到的人" /></label>
            <label><span>用户痛点</span><textarea value={project.painPoint} onChange={(event) => update("painPoint", event.target.value)} placeholder="最近一次发生在什么时候，代价是什么" /></label>
            <label><span>现有替代方案</span><input value={project.alternative} onChange={(event) => update("alternative", event.target.value)} placeholder="用户现在具体怎么解决" /></label>
            <label><span>最大不确定性</span><input value={project.biggestUncertainty} onChange={(event) => update("biggestUncertainty", event.target.value)} placeholder="本轮最需要证明的一件事" /></label>
          </div>
        )}

        {section === 1 && (
          <div className="departureFields">
            <label><span>当前阶段</span><select value={project.currentStage} onChange={(event) => update("currentStage", event.target.value as Project["currentStage"])}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>当前已有成果</span><textarea value={project.existingArtifact} onChange={(event) => update("existingArtifact", event.target.value)} placeholder="截图、表单、人工服务、演示版或最小版本" /></label>
            <label><span>已投入时间（天）</span><input type="number" min={0} value={project.timeInvestedDays} onChange={(event) => update("timeInvestedDays", Number(event.target.value))} /></label>
            <label><span>已投入金钱（元）</span><input type="number" min={0} value={project.moneyInvested} onChange={(event) => update("moneyInvested", Number(event.target.value))} /></label>
            <label><span>内部修改轮次</span><input type="number" min={0} value={project.iterationCount} onChange={(event) => update("iterationCount", Number(event.target.value))} /></label>
            <div className="choiceGrid">
              <label className="switchField"><input type="checkbox" checked={project.hasDemo} onChange={(event) => update("hasDemo", event.target.checked)} /><span>已有可展示成果</span></label>
              <label className="switchField"><input type="checkbox" checked={project.hasPublished} onChange={(event) => update("hasPublished", event.target.checked)} /><span>已经公开发布</span></label>
            </div>
          </div>
        )}

        {section === 2 && (
          <div className="departureFields">
            <label><span>计划获客方式</span><textarea value={project.acquisition} onChange={(event) => update("acquisition", event.target.value)} placeholder="具体社群、名单、内容题目或渠道" /></label>
            <label><span>计划变现方式</span><textarea value={project.monetization} onChange={(event) => update("monetization", event.target.value)} placeholder="谁为哪个结果付钱" /></label>
            <label><span>已主动触达用户数</span><input type="number" min={0} value={project.contactedUserCount} onChange={(event) => update("contactedUserCount", Number(event.target.value))} /></label>
            <label><span>距上次真实用户行动（天）</span><input type="number" min={0} value={project.daysSinceLastExternalAction} onChange={(event) => update("daysSinceLastExternalAction", Number(event.target.value))} /></label>
            <label className="switchField wide"><input type="checkbox" checked={project.hasQuoted} onChange={(event) => update("hasQuoted", event.target.checked)} /><span>已经向真实用户提出过明确报价或预订动作</span></label>
          </div>
        )}

        {showValidation && <p className="departureValidation">进入路线前至少填写项目名称、目标用户和用户痛点。</p>}
        <div className="departureActions">
          <span>第 {section + 1} 步，共 {sections.length} 步</span>
          <button className="primaryButton" onClick={continueJourney} type="button">
            {section === sections.length - 1 ? "查看项目路线" : "继续"}<ArrowRight size={17} />
          </button>
        </div>
      </section>

      <section className="demoGarage">
        <div><span className="routeEyebrow">演示车库</span><h2>快速载入四种不同节奏</h2></div>
        <div className="demoGarageGrid">
          {examples.map((example, index) => (
            <button key={example.project.id} onClick={() => onLoadExample(index)} type="button">
              <strong>{example.project.name}</strong><span>{stageLabels[example.project.currentStage]}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
