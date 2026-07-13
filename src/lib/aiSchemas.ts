import { z } from "zod";

export const aiModeSchema = z.enum([
  "assumption_breakdown",
  "plan_review",
  "red_team_followup",
  "task_personalization",
]);

export const gateIdSchema = z.enum(["user", "pain", "alternative", "acquisition", "payment", "delivery"]);

const shortText = z.string().trim().max(1200);

export const aiCoachRequestSchema = z.object({
  mode: aiModeSchema,
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

export const aiCoachDataSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  questions: z.array(z.string().trim().min(1).max(300)).max(3),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(6),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
  revisedAction: z.string().trim().max(600).optional(),
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
