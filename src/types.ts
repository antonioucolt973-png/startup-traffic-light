export type Light = "red" | "yellow" | "green" | "blue";

export interface Project {
  id: string;
  name: string;
  description: string;
  targetUser: string;
  painPoint: string;
  alternative: string;
  acquisition: string;
  monetization: string;
  currentStage: string;
  timeInvestedDays: number;
  moneyInvested: number;
  biggestUncertainty: string;
}

export interface Evidence {
  competitorResearch: boolean;
  interviewCount: number;
  testPostCount: number;
  messageCount: number;
  signupCount: number;
  demoTrialCount: number;
  paymentSignalCount: number;
  retentionSignal: boolean;
}

export interface Assumption {
  title: string;
  summary: string;
  risk: "低" | "中" | "高";
}

export type RoadtestStatus = "已通过" | "可路测" | "计划太虚" | "先停手";

export interface RoadtestPlan {
  user: string;
  pain: string;
  alternative: string;
  acquisition: string;
  payment: string;
  delivery: string;
}

export interface RoadtestCheck {
  id: keyof RoadtestPlan;
  title: string;
  scene: string;
  evidence: string;
  plan: string;
  status: RoadtestStatus;
  feedback: string;
  redTeamPrompt: string;
}

export interface RedTeamQuestion {
  role: string;
  question: string;
  severity: "低风险" | "中风险" | "高风险";
}

export interface DecisionReport {
  light: Light;
  lightLabel: string;
  lightReason: string;
  feasibilityScore: number;
  evidenceScore: number;
  evidenceLevel: number;
  planScore: number;
  planCredibility: "高" | "中" | "低";
  assumptions: Assumption[];
  roadtestChecks: RoadtestCheck[];
  redTeamQuestions: RedTeamQuestion[];
  mainRisks: string[];
  missingEvidence: string[];
  deliveryPath: string;
  investmentLimit: {
    days: number;
    money: number;
    bans: string[];
  };
  nextActions: string[];
  sevenDayTasks: string[];
  stopConditions: string[];
  markdown: string;
}
