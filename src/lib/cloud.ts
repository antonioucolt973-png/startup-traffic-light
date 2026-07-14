import { createClient, type User } from "@supabase/supabase-js";
import type { GateId, ProjectWorkspace, SurveyDraft } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = cloudEnabled ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

export interface CloudSession {
  user: User | null;
  enabled: boolean;
}

export async function getCloudSession(): Promise<CloudSession> {
  if (!supabase) return { user: null, enabled: false };
  const { data } = await supabase.auth.getSession();
  return { user: data.session?.user ?? null, enabled: true };
}

export function subscribeToCloudSession(listener: (session: CloudSession) => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener({ user: session?.user ?? null, enabled: true });
  });
  return () => data.subscription.unsubscribe();
}

export async function requestEmailSignIn(email: string) {
  if (!supabase) throw new Error("云端服务尚未配置");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutCloud() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadCloudWorkspace(userId: string): Promise<ProjectWorkspace | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("project_workspaces")
    .select("workspace")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.workspace as ProjectWorkspace | undefined) ?? null;
}

export async function saveCloudWorkspace(userId: string, workspace: ProjectWorkspace) {
  if (!supabase) return;
  const { error } = await supabase.from("project_workspaces").upsert({
    id: workspace.project.id,
    user_id: userId,
    project_name: workspace.project.name || "未命名项目",
    workspace,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function publishSurvey(userId: string, projectId: string, gateId: GateId, draft: SurveyDraft) {
  if (!supabase) throw new Error("云端服务尚未配置");
  const slug = `${projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "opc"}-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from("surveys").insert({
    user_id: userId,
    project_id: projectId,
    gate_id: gateId,
    slug,
    title: draft.title,
    introduction: draft.introduction,
    questions: draft.questions,
    status: "published",
    updated_at: new Date().toISOString(),
  }).select("id,slug,created_at").single();
  if (error) throw error;
  return data as { id: string; slug: string; created_at: string };
}

export async function getPublicSurvey(slug: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("surveys")
    .select("id,title,introduction,questions,status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; title: string; introduction: string; questions: SurveyDraft["questions"]; status: "published" } | null;
}

export async function submitSurveyResponse(surveyId: string, answers: Record<string, string | string[]>, contact: string, consentToContact: boolean) {
  if (!supabase) throw new Error("云端服务尚未配置");
  const { error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    answers,
    contact: consentToContact && contact.trim() ? contact.trim() : null,
    consent_to_contact: consentToContact,
  });
  if (error) throw error;
}

export async function getSurveyResponses(surveyId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("survey_responses")
    .select("id,answers,consent_to_contact,submitted_at")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data as Array<{ id: string; answers: Record<string, string | string[]>; consent_to_contact: boolean; submitted_at: string }>;
}
