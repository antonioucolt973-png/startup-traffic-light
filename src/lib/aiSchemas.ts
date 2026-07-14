import { z } from "zod";

export const aiModeSchema = z.enum([
  "project_intake",
  "route_options",
  "survey_generation",
  "evidence_review",
  "task_decomposition",
  "assumption_breakdown",
  "plan_review",
  "red_team_followup",
  "task_personalization",
]);

export const gateIdSchema = z.enum(["user", "pain", "alternative", "acquisition", "payment", "delivery"]);

const shortText = z.string().trim().max(1200);

export const aiCoachRequestSchema = z.object({
  mode: aiModeSchema,
  idea: shortText.optional(),
  project: z.object({
    name: shortText,
    description: shortText,
    targetUser: shortText,
    painPoint: shortText,
    alternative: shortText,
    acquisition: shortText,
    monetization: shortText,
    currentStage: z.enum(["idea", "research", "demo", "mvp", "growth"]),
    existingArtifact: shortText,
    biggestUncertainty: shortText,
  }),
  evidence: z.object({
    interviewCount: z.number().min(0).max(100000),
    activeInterestCount: z.number().min(0).max(100000),
    trialCount: z.number().min(0).max(100000),
    paymentCount: z.number().min(0).max(100000),
    hasRetention: z.boolean(),
  }),
  gate: z.object({
    id: gateIdSchema,
    title: shortText,
    scene: shortText,
    currentEvidence: shortText,
  }).optional(),
  plan: z.object({
    audience: shortText,
    action: shortText,
    deadline: shortText,
    passCriteria: shortText,
    stopCriteria: shortText,
  }).optional(),
  previousQuestion: shortText.optional(),
  answer: shortText.optional(),
});

export const aiProjectDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  targetUser: z.string().trim().min(1).max(240),
  painPoint: z.string().trim().min(1).max(360),
  alternative: z.string().trim().max(300),
  acquisition: z.string().trim().max(300),
  monetization: z.string().trim().max(300),
  currentStage: z.enum(["idea", "research", "demo", "mvp", "growth"]),
  existingArtifact: z.string().trim().max(300),
  biggestUncertainty: z.string().trim().min(1).max(300),
});

export const aiCoachDataSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  questions: z.array(z.string().trim().min(1).max(300)).max(3),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(6),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
  revisedAction: z.string().trim().max(600).optional(),
  projectDraft: aiProjectDraftSchema.optional(),
  routeOptions: z.array(z.object({
    title: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(300),
    audience: z.string().trim().min(1).max(240),
    action: z.string().trim().min(1).max(500),
    deadline: z.string().trim().min(1).max(120),
    passCriteria: z.string().trim().min(1).max(240),
    stopCriteria: z.string().trim().min(1).max(240),
  })).max(3).optional(),
  surveyDraft: z.object({
    title: z.string().trim().min(1).max(120),
    introduction: z.string().trim().max(500),
    questions: z.array(z.object({
      id: z.string().trim().min(1).max(60),
      prompt: z.string().trim().min(1).max(300),
      type: z.enum(["single_choice", "multiple_choice", "short_text", "long_text", "scale"]),
      required: z.boolean(),
      options: z.array(z.string().trim().min(1).max(100)).max(8),
    })).min(3).max(8),
  }).optional(),
  taskDrafts: z.array(z.object({
    day: z.number().int().min(1).max(7),
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().min(1).max(500),
    passCriteria: z.string().trim().min(1).max(240),
    stopCriteria: z.string().trim().min(1).max(240),
  })).max(7).optional(),
});

export const aiCoachResponseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  mode: aiModeSchema,
  source: z.enum(["ai", "fallback"]),
  notice: z.string().max(300).optional(),
  data: aiCoachDataSchema,
});

export type AiMode = z.infer<typeof aiModeSchema>;
export type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;
export type AiCoachData = z.infer<typeof aiCoachDataSchema>;
export type AiCoachResponse = z.infer<typeof aiCoachResponseSchema>;
export type AiProjectDraft = z.infer<typeof aiProjectDraftSchema>;
