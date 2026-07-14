import type { CSSProperties, ComponentType } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Flag,
  HeartPulse,
  Repeat2,
  Send,
  UserRound,
  Wrench,
} from "lucide-react";
import { motion } from "motion/react";
import type { DecisionReport, GateId, Project, RoadtestStage } from "../types";
import { ProjectVehicle } from "./ProjectVehicle";

interface JourneyMapScreenProps {
  project: Project;
  report: DecisionReport;
  activeGate: GateId;
  onGateChange: (gate: GateId) => void;
  onEnterGate: () => void;
}

interface RoutePoint {
  id: GateId;
  x: number;
  y: number;
  icon: ComponentType<{ size?: number }>;
}

const routePoints: RoutePoint[] = [
  { id: "user", x: 8, y: 68, icon: UserRound },
  { id: "pain", x: 24, y: 39, icon: HeartPulse },
  { id: "alternative", x: 40, y: 65, icon: Repeat2 },
  { id: "acquisition", x: 57, y: 33, icon: Send },
  { id: "payment", x: 74, y: 58, icon: BadgeDollarSign },
  { id: "delivery", x: 91, y: 27, icon: Wrench },
];

const stageMeta: Array<{ id: RoadtestStage; label: string; detail: string }> = [
  { id: "demand", label: "需求路段", detail: "先确认谁真的有问题" },
  { id: "transaction", label: "交易路段", detail: "再验证触达与付费" },
  { id: "delivery", label: "交付路段", detail: "最后确认一人能兑现" },
];

export function JourneyMapScreen({ project, report, activeGate, onGateChange, onEnterGate }: JourneyMapScreenProps) {
  const compactMap = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
  const displayPoints = compactMap
    ? routePoints.map((point, index) => ({ ...point, x: 18, y: 17 + index * 13.5 }))
    : routePoints;
  const active = report.roadtestChecks.find((gate) => gate.id === activeGate) ?? report.roadtestChecks[0];
  const activePoint = displayPoints.find((point) => point.id === activeGate) ?? displayPoints[0];
  const passedCount = report.roadtestChecks.filter((gate) => gate.status === "已通过").length;

  return (
    <div className="mapScreen expeditionScreen">
      <header className="mapHeader expeditionHeader">
        <div>
          <span className="routeEyebrow">创业旅行地图</span>
          <h1>项目车已经上路，下一站由证据决定。</h1>
          <p>点击地图上的路口，项目车会驶过去查看现实阻力。计划只能获得路测资格，真实行为才会点亮下一段道路。</p>
        </div>
        <div className="mapProgressSummary">
          <span>当前旅程</span>
          <strong>{passedCount}<small>/6 路口通过</small></strong>
          <div><i style={{ width: `${(passedCount / 6) * 100}%` }} /></div>
          <p>{project.name || "未命名项目"}</p>
        </div>
      </header>

      <section className="expeditionMap" aria-label="创业验证旅行地图">
        <div className="mapRegionLabels" aria-hidden="true">
          {stageMeta.map((stage) => <div key={stage.id}><strong>{stage.label}</strong><span>{stage.detail}</span></div>)}
        </div>

        <svg className="mapArtwork" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
          <path className="mapHill far" d="M0 180 C130 95 245 150 340 110 C455 62 560 130 650 92 C760 44 865 104 962 72 C1060 40 1140 65 1200 36 L1200 560 L0 560 Z" />
          <path className="mapHill near" d="M0 305 C120 245 230 295 330 250 C450 198 555 286 660 230 C780 168 900 262 1010 214 C1080 184 1140 188 1200 168 L1200 560 L0 560 Z" />
          <g className="mapBuildings">
            <path d="M122 242 h72 v96 h-72z M140 218 h38 v24 h-38z" />
            <path d="M640 150 h86 v116 h-86z M662 126 h42 v24 h-42z" />
            <path d="M1000 92 h92 v128 h-92z M1020 68 h52 v24 h-52z" />
          </g>
          <g className="mapTrees">
            <circle cx="58" cy="300" r="24" /><circle cx="318" cy="174" r="20" /><circle cx="520" cy="300" r="25" />
            <circle cx="820" cy="168" r="22" /><circle cx="940" cy="372" r="26" /><circle cx="1140" cy="262" r="22" />
          </g>
          <path className="mapRoadBorder" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
          <path className="mapRoad" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
          <path className="mapRoadDash" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
        </svg>

        <motion.div
          className="mapVehicleMarker"
          animate={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
          transition={{ type: "spring", stiffness: 72, damping: 17, mass: 0.9 }}
        >
          <ProjectVehicle size="small" label={project.name || "项目车"} />
        </motion.div>

        {displayPoints.map((point, index) => {
          const gate = report.roadtestChecks.find((item) => item.id === point.id)!;
          const Icon = point.icon;
          const style = { "--map-x": `${point.x}%`, "--map-y": `${point.y}%` } as CSSProperties;
          return (
            <button
              type="button"
              key={point.id}
              style={style}
              className={`mapStop status${gate.status} ${activeGate === point.id ? "active" : ""}`}
              onClick={() => onGateChange(point.id)}
              aria-label={`${gate.title}，${gate.status}`}
            >
              <span className="mapStopNumber">{String(index + 1).padStart(2, "0")}</span>
              <span className="mapStopIcon"><Icon size={20} /></span>
              <span className="mapStopCopy"><strong>{gate.title}</strong><small>{gate.status}</small></span>
            </button>
          );
        })}

        <div className="mapFinish" aria-hidden="true"><Flag size={22} /><span>持续交付</span></div>
      </section>

      <section className={`mapGateFocus expeditionGateFocus status${active.status}`}>
        <div><span>正在查看</span><strong>{active.title}</strong><p>{active.scene}</p></div>
        <div><span>当前路况</span><strong>{active.status}</strong><p>{active.feedback}</p></div>
        <button className="primaryButton" onClick={onEnterGate} type="button">驶入这个路口<ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
