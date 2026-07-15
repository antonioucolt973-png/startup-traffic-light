export type Light = "red" | "yellow" | "green" | "blue";

export type ProjectStage = "idea" | "research" | "demo" | "mvp" | "growth";

export interface Project {
  id: string;
  name: string;
  description: string;
  targetUser: string;
  painPoint: string;
  alternative: string;
  acquisition: string;
  monetization: string;
  currentStage: ProjectStage;
  timeInvestedDays: number;
  moneyInvested: number;
  daysSinceLastExternalAction: number;
  biggestUncertainty: string;
  existingArtifact: string;
  hasDemo: boolean;
  hasPublished: boolean;
  iterationCount: number;
  contactedUserCount: number;
  hasQuoted: boolean;
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

export type EvidenceType =
  | "research"
  | "interview"
  | "problem_story"
  | "test_post"
  | "active_interest"
  | "signup"
  | "trial"
  | "quote"
  | "payment"
  | "repeat"
  | "referral";

export type EvidenceSource =
  | "ai_inference"
  | "founder_assumption"
  | "web_research"
  | "founder_report"
  | "user_feedback"
  | "user_behavior"
  | "payment_or_retention";

export interface EvidenceRecord {
  id: string;
  projectId: string;
  cycleId?: string;
  type: EvidenceType;
  occurredAt: string;
  actor: string;
  behavior: string;
  quantity: number;
  source: EvidenceSource;
  note: string;
  url: string;
  verifiable: boolean;
  reviewStatus: "pending" | "confirmed" | "rejected";
  origin: "manual" | "survey" | "task" | "legacy";
  rawRecordIds: string[];
}

export interface SurveyQuestion {
  id: string;
  prompt: string;
  type: "single_choice" | "multiple_choice" | "short_text" | "long_text" | "scale";
  required: boolean;
  options: string[];
}

export interface SurveyDraft {
  title: string;
  introduction: string;
  questions: SurveyQuestion[];
}

export interface SurveyCampaign {
  id: string;
  projectId: string;
  cycleId?: string;
  gateId: GateId;
  slug: string;
  draft: SurveyDraft;
  status: "draft" | "published" | "closed";
  responseCount: number;
  createdAt: string;
  publishedAt?: string;
}

export interface CalibrationSnapshot {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  stage: string;
  light: Light;
  lightLabel: string;
  evidenceScore: number;
  evidenceLevel: number;
  projectStructureScore: number;
  currentFocus: string;
}

export interface Assumption {
  title: string;
  summary: string;
  risk: "低" | "中" | "高";
}

export type RoadtestStatus = "未检查" | "已通过" | "可路测" | "计划太虚" | "先停手" | "立即行动";

export type RoadtestStage = "demand" | "transaction" | "delivery";

export interface RoadtestPlan {
  user: string;
  pain: string;
  alternative: string;
  acquisition: string;
  payment: string;
  delivery: string;
}

export type GateId = keyof RoadtestPlan;

export interface GateActionPlan {
  audience: string;
  action: string;
  deadline: string;
  passCriteria: string;
  stopCriteria: string;
}

export type GatePlans = Record<GateId, GateActionPlan>;

export interface RoadtestCheck {
  id: GateId;
  stage: RoadtestStage;
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

export interface RedTeamTurn {
  id: string;
  projectId: string;
  cycleId?: string;
  gateId: GateId;
  round: 1 | 2;
  question: string;
  answer: string;
  feedback: string;
  nextQuestion?: string;
  source: "ai" | "fallback";
  createdAt: string;
}

export interface ValidationTask {
  id: string;
  projectId: string;
  cycleId?: string;
  day: number;
  title: string;
  detail: string;
  passCriteria: string;
  stopCriteria: string;
  status: "pending" | "completed" | "failed";
  result: string;
  evidenceIds: string[];
}

export interface CalibrationRound {
  id: string;
  projectId: string;
  cycleId?: string;
  projectName: string;
  createdAt: string;
  stage: ProjectStage;
  light: Light;
  lightLabel: string;
  evidenceScore: number;
  evidenceLevel: number;
  projectStructureScore: number;
  planScore: number;
  lightReason: string;
  changeSummary: string;
  currentFocus: string;
  nextReviewTrigger: string;
  reviewAt: string;
  gateStatuses: Record<GateId, RoadtestStatus>;
  investmentLimit: {
    days: number;
    money: number;
  };
  evidenceRecordIds: string[];
}

export interface CalibrationDiff {
  lightChanged: boolean;
  evidenceDelta: number;
  investmentDaysDelta: number;
  investmentMoneyDelta: number;
  changedGates: Array<{
    id: GateId;
    before: RoadtestStatus;
    after: RoadtestStatus;
  }>;
  newEvidenceCount: number;
}

export type CycleOutcome = "advance" | "hold" | "return";

export interface JourneyCycle {
  id: string;
  projectId: string;
  cycleNumber: number;
  status: "active" | "completed";
  startedAt: string;
  completedAt?: string;
  stageAtStart: ProjectStage;
  stageAtEnd?: ProjectStage;
  primaryGoal: string;
  focusGate: GateId;
  lightBefore: Light;
  lightAfter?: Light;
  evidenceScoreBefore: number;
  evidenceScoreAfter?: number;
  evidenceIdsAtStart: string[];
  evidenceIdsAdded: string[];
  planSnapshot: GatePlans;
  taskSnapshot: ValidationTask[];
  redTeamSnapshot: RedTeamTurn[];
  risksBefore: string[];
  risksAfter: string[];
  aiReview: string;
  recommendation: CycleOutcome;
  outcome?: CycleOutcome;
}

export interface ProjectWorkspace {
  schemaVersion: 5;
  project: Project;
  initialProject: Project | null;
  activeCycleId: string;
  cycles: JourneyCycle[];
  evidenceRecords: EvidenceRecord[];
  plans: GatePlans;
  redTeamTurns: RedTeamTurn[];
  tasks: ValidationTask[];
  rounds: CalibrationRound[];
  surveys: SurveyCampaign[];
}

export interface DecisionReport {
  light: Light;
  lightLabel: string;
  lightReason: string;
  projectStructureScore: number;
  evidenceScore: number;
  evidenceLevel: number;
  planScore: number;
  planCredibility: "高" | "中" | "低";
  assumptions: Assumption[];
  roadtestChecks: RoadtestCheck[];
  redTeamQuestions: RedTeamQuestion[];
  mainRisks: string[];
  missingEvidence: string[];
  currentFocus: string;
  nextReviewTrigger: string;
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
