import {
  BadgeDollarSign,
  HeartPulse,
  Repeat2,
  Send,
  UserRound,
  Wrench,
} from "lucide-react";
import type { RoadtestCheck, RoadtestStage } from "../types";

interface RoadMapProps {
  checks: RoadtestCheck[];
  activeGate: RoadtestCheck["id"];
  onGateChange: (gate: RoadtestCheck["id"]) => void;
}

const stageMeta: Array<{ id: RoadtestStage; label: string; detail: string }> = [
  { id: "demand", label: "需求是否存在", detail: "谁、为什么、为何切换" },
  { id: "transaction", label: "能否获得交易", detail: "从哪里触达、为何付费" },
  { id: "delivery", label: "能否持续交付", detail: "最小范围如何兑现价值" },
];

const gateIcons = {
  user: UserRound,
  pain: HeartPulse,
  alternative: Repeat2,
  acquisition: Send,
  payment: BadgeDollarSign,
  delivery: Wrench,
};

export function RoadMap({ checks, activeGate, onGateChange }: RoadMapProps) {
  return (
    <section className="roadMap" aria-label="创业路线图">
      {stageMeta.map((stage, index) => {
        const gates = checks.filter((check) => check.stage === stage.id);
        return (
          <div className="roadStage" key={stage.id}>
            <div className="roadStageHead">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </div>
            </div>
            <div className="roadGateList">
              {gates.map((gate) => {
                const Icon = gateIcons[gate.id];
                return (
                  <button
                    className={`roadGate status${gate.status} ${activeGate === gate.id ? "active" : ""}`}
                    key={gate.id}
                    onClick={() => onGateChange(gate.id)}
                    type="button"
                  >
                    <Icon size={16} />
                    <span>{gate.title}</span>
                    <em>{gate.status}</em>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
