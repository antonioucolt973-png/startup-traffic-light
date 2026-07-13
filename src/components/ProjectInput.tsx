import type { Assumption, Project } from "../types";
import { stageLabels } from "../lib/labels";

interface ProjectInputProps {
  project: Project;
  onChange: (project: Project) => void;
  assumptions: Assumption[];
  missingFields: string[];
}

const textFields: Array<{ key: keyof Project; label: string; placeholder: string; multiline?: boolean }> = [
  { key: "name", label: "项目名", placeholder: "例如：AI 试衣助手" },
  { key: "description", label: "一句话描述", placeholder: "用一句话说明它帮谁解决什么问题", multiline: true },
  { key: "targetUser", label: "目标用户", placeholder: "越具体越好，不要写泛泛的人群" },
  { key: "painPoint", label: "用户痛点", placeholder: "用户现在为什么痛、频率如何、代价是什么", multiline: true },
  { key: "alternative", label: "现有替代方案", placeholder: "用户不用你时，具体用什么解决" },
  { key: "acquisition", label: "获客方式", placeholder: "第一批用户从哪里来，具体到渠道/社群/内容" },
  { key: "monetization", label: "变现方式", placeholder: "谁付钱、为什么付、按什么方式付" },
  { key: "biggestUncertainty", label: "最大不确定性", placeholder: "当前最需要验证的一件事", multiline: true },
];

export function ProjectInput({ project, onChange, assumptions, missingFields }: ProjectInputProps) {
  function update<K extends keyof Project>(key: K, value: Project[K]) {
    onChange({ ...project, [key]: value });
  }

  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">项目上路</p>
          <h3>先把项目开上路，后面每个路口只看证据和行动</h3>
        </div>
        <p>这里不判断“能不能成功”，只收集后续判定所需的关键事实。</p>
      </div>

      <div className="formGrid">
        {textFields.map((field) => (
          <label key={field.key} className={field.multiline ? "field wide" : "field"}>
            <span>{field.label}</span>
            {field.multiline ? (
              <textarea
                value={String(project[field.key])}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value as Project[typeof field.key])}
              />
            ) : (
              <input
                value={String(project[field.key])}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value as Project[typeof field.key])}
              />
            )}
          </label>
        ))}

        <label className="field">
          <span>当前阶段</span>
          <select value={project.currentStage} onChange={(event) => update("currentStage", event.target.value)}>
            <option value="idea">{stageLabels.idea}</option>
            <option value="research">{stageLabels.research}</option>
            <option value="demo">{stageLabels.demo}</option>
            <option value="mvp">{stageLabels.mvp}</option>
            <option value="growth">{stageLabels.growth}</option>
          </select>
        </label>

        <label className="field">
          <span>已投入时间（天）</span>
          <input
            type="number"
            min={0}
            value={project.timeInvestedDays}
            onChange={(event) => update("timeInvestedDays", Number(event.target.value))}
          />
        </label>

        <label className="field">
          <span>已投入金钱（元）</span>
          <input
            type="number"
            min={0}
            value={project.moneyInvested}
            onChange={(event) => update("moneyInvested", Number(event.target.value))}
          />
        </label>

        <label className="field">
          <span>距上次真实用户行动（天）</span>
          <input
            type="number"
            min={0}
            value={project.daysSinceLastExternalAction}
            onChange={(event) => update("daysSinceLastExternalAction", Number(event.target.value))}
          />
        </label>
      </div>

      {missingFields.length > 0 && (
        <div className="inputValidation" role="alert">
          请先补充：{missingFields.join("、")}。这三项是进入现实路测的最低前提。
        </div>
      )}

      <section className="assumptionSection">
        <div className="sectionIntro">
          <div>
            <p className="microLabel">关键假设拆解</p>
            <h4>这些不是结论，而是之后要用证据验证的前提。</h4>
          </div>
          <span>输入越完整，路测问题越准确；不会因此直接获得更高灯号。</span>
        </div>
        <div className="assumptionGrid">
          {assumptions.map((assumption) => (
            <article key={assumption.title} className={`assumptionCard risk${assumption.risk}`}>
              <div>
                <strong>{assumption.title}</strong>
                <span>{assumption.risk}风险</span>
              </div>
              <p>{assumption.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
