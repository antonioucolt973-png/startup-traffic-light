import { ArrowRight, CarFront, Flag, MapPinned } from "lucide-react";
import { motion } from "motion/react";
import type { DecisionReport, GateId, Project, RoadtestStage } from "../types";
import { ProjectCar } from "./ProjectCar";

interface JourneyMapScreenProps {
  project: Project;
  report: DecisionReport;
  activeGate: GateId;
  onGateChange: (gate: GateId) => void;
  onEnterGate: () => void;
}

const stages: Array<{ id: RoadtestStage; number: string; title: string; detail: string }> = [
  { id: "demand", number: "01", title: "需求是否存在", detail: "先确认谁有问题、问题是否真实、为何需要改变。" },
  { id: "transaction", number: "02", title: "能否发生交易", detail: "确认用户从哪里来，以及是否愿意付出时间或金钱。" },
  { id: "delivery", number: "03", title: "能否持续交付", detail: "只承诺一人可以完成的最小价值。" },
];

export function JourneyMapScreen({ project, report, activeGate, onGateChange, onEnterGate }: JourneyMapScreenProps) {
  const active = report.roadtestChecks.find((gate) => gate.id === activeGate) ?? report.roadtestChecks[0];
  const firstBlocked = report.roadtestChecks.findIndex((gate) => gate.status !== "已通过");
  const carIndex = Math.max(0, firstBlocked === -1 ? report.roadtestChecks.length - 1 : firstBlocked);

  return (
    <div className="mapScreen">
      <div className="mapHeader">
        <div><span className="routeEyebrow">路线总览</span><h1>项目不是做题，而是在现实里逐个过路口。</h1><p>六个路口覆盖需求、交易和交付。拿出证据才能通过，具体计划只能获得路测资格。</p></div>
        <ProjectCar project={project} compact />
      </div>

      <section className="journeyRoad" aria-label="创业路线地图">
        <div className="roadTrack" aria-hidden="true"><span /></div>
        {stages.map((stage) => {
          const gates = report.roadtestChecks.filter((gate) => gate.stage === stage.id);
          return (
            <article className="journeyStage" key={stage.id}>
              <div className="journeyStageIntro"><span>{stage.number}</span><div><strong>{stage.title}</strong><p>{stage.detail}</p></div></div>
              <div className="journeyGates">
                {gates.map((gate) => {
                  const globalIndex = report.roadtestChecks.findIndex((item) => item.id === gate.id);
                  return (
                    <button
                      type="button"
                      key={gate.id}
                      className={`journeyGate status${gate.status} ${activeGate === gate.id ? "active" : ""}`}
                      onClick={() => onGateChange(gate.id)}
                    >
                      {carIndex === globalIndex && <motion.span layoutId="project-car-marker" className="carMarker"><CarFront size={16} /></motion.span>}
                      <MapPinned size={19} />
                      <span><strong>{gate.title}</strong><small>{gate.status}</small></span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
        <Flag className="finishFlag" size={24} aria-hidden="true" />
      </section>

      <section className={`mapGateFocus status${active.status}`}>
        <div><span>当前选中路口</span><strong>{active.title}</strong><p>{active.scene}</p></div>
        <div><span>当前路况</span><strong>{active.status}</strong><p>{active.feedback}</p></div>
        <button className="primaryButton" onClick={onEnterGate} type="button">处理这个路口<ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
