import { BarChart3, Check, ClipboardList, ExternalLink, LoaderCircle, QrCode, RefreshCw, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { getSurveyResponses, publishSurvey } from "../lib/cloud";
import { requestAiCoach } from "../lib/aiClient";
import type { Evidence, EvidenceRecord, GateId, Project, SurveyCampaign, SurveyDraft } from "../types";

interface SurveyWorkshopProps {
  project: Project;
  gateId: GateId;
  gateTitle: string;
  evidence: Evidence;
  userId?: string;
  campaigns: SurveyCampaign[];
  onSaveCampaign: (campaign: SurveyCampaign) => void;
  onAddEvidence: (record: EvidenceRecord) => void;
}

export function SurveyWorkshop({ project, gateId, gateTitle, evidence, userId, campaigns, onSaveCampaign, onAddEvidence }: SurveyWorkshopProps) {
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [loading, setLoading] = useState<"generate" | "publish" | "responses" | null>(null);
  const [message, setMessage] = useState("");
  const campaign = useMemo(() => campaigns.find((item) => item.gateId === gateId && item.status === "published"), [campaigns, gateId]);
  const publicUrl = campaign ? `${window.location.origin}/survey/${campaign.slug}` : "";

  async function generateSurvey() {
    setLoading("generate");
    const result = await requestAiCoach({
      mode: "survey_generation",
      project: projectPayload(project),
      evidence: evidencePayload(evidence),
      gate: { id: gateId, title: gateTitle, scene: `为${gateTitle}生成现实验证问卷`, currentEvidence: "问卷结果尚未形成" },
    });
    setDraft(result.data.surveyDraft ?? null);
    setMessage(result.data.summary);
    setLoading(null);
  }

  async function publish() {
    if (!draft) return;
    if (!userId) {
      setMessage("问卷预览已生成。登录后才能获得可对外提交的公开链接和二维码。");
      return;
    }
    setLoading("publish");
    try {
      const result = await publishSurvey(userId, project.id, gateId, draft);
      onSaveCampaign({ id: result.id, projectId: project.id, gateId, slug: result.slug, draft, status: "published", responseCount: 0, createdAt: result.created_at, publishedAt: result.created_at });
      setMessage("问卷已经发布，可以扫码或复制链接邀请目标用户填写。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败，请稍后重试。");
    }
    setLoading(null);
  }

  async function refreshResponses() {
    if (!campaign) return;
    setLoading("responses");
    try {
      const responses = await getSurveyResponses(campaign.id);
      onSaveCampaign({ ...campaign, responseCount: responses.length });
      if (responses.length === 0) {
        setMessage("暂时还没有答卷。先把二维码发给目标用户，而不是发给熟人求赞美。");
      } else {
        const optedIn = responses.filter((item) => item.consent_to_contact).length;
        const review = await requestAiCoach({
          mode: "evidence_review",
          project: projectPayload(project),
          evidence: evidencePayload(evidence),
          gate: { id: gateId, title: gateTitle, scene: "复核问卷结果", currentEvidence: `共${responses.length}份答卷，${optedIn}人同意后续联系` },
          answer: `系统自动采集${responses.length}份答卷，其中${optedIn}人明确同意后续联系。请只判断这批数据能支持什么，不要推断未发生的行为。`,
        });
        onAddEvidence({
          id: `survey-${campaign.id}-${Date.now()}`,
          projectId: project.id,
          type: optedIn > 0 ? "active_interest" : "interview",
          occurredAt: new Date().toISOString().slice(0, 10),
          actor: `${responses.length}位匿名问卷参与者`,
          behavior: review.data.summary,
          quantity: optedIn > 0 ? optedIn : responses.length,
          source: optedIn > 0 ? "user_behavior" : "user_feedback",
          note: `由系统答卷生成的AI证据候选；共${responses.length}份原始答卷。`,
          url: publicUrl,
          verifiable: true,
          reviewStatus: "pending",
          origin: "survey",
          rawRecordIds: responses.map((item) => item.id),
        });
        setMessage("已生成一条待确认的证据候选。请到证据背包核对后再决定是否计入。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "答卷读取失败。");
    }
    setLoading(null);
  }

  return (
    <section className="surveyWorkshop">
      <header><div><ClipboardList size={20} /><span><strong>AI行动工具：现实问卷</strong><small>共同设计、直接收集、自动形成证据候选</small></span></div><button type="button" onClick={generateSurvey} disabled={loading !== null}>{loading === "generate" ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{draft ? "重新生成" : "生成问卷"}</button></header>
      {draft && !campaign && <div className="surveyDraft"><div><label><span>问卷标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label><span>开场说明</span><textarea value={draft.introduction} onChange={(event) => setDraft({ ...draft, introduction: event.target.value })} /></label></div><ol>{draft.questions.map((question) => <li key={question.id}><span>{question.prompt}</span><small>{question.type === "single_choice" ? "单选" : question.type === "multiple_choice" ? "多选" : "文字回答"}{question.required ? " · 必答" : " · 选答"}</small></li>)}</ol><button className="surveyPublish" type="button" onClick={publish} disabled={loading !== null}>{loading === "publish" ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}{userId ? "发布链接和二维码" : "登录后发布"}</button></div>}
      {campaign && <div className="publishedSurvey"><div className="surveyQr"><QRCodeSVG value={publicUrl} size={132} bgColor="#ffffff" fgColor="#17221d" /><span><QrCode size={14} />扫码填写</span></div><div><span>已发布问卷</span><h3>{campaign.draft.title}</h3><a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}<ExternalLink size={14} /></a><p>当前收到 <strong>{campaign.responseCount}</strong> 份答卷</p><button type="button" onClick={refreshResponses} disabled={loading !== null}>{loading === "responses" ? <LoaderCircle className="spin" size={16} /> : <BarChart3 size={16} />}刷新并生成证据候选</button></div></div>}
      {message && <p className="surveyWorkshopMessage"><Check size={14} />{message}</p>}
    </section>
  );
}

function projectPayload(project: Project) {
  return { name: project.name, description: project.description, targetUser: project.targetUser, painPoint: project.painPoint, alternative: project.alternative, acquisition: project.acquisition, monetization: project.monetization, currentStage: project.currentStage, existingArtifact: project.existingArtifact, biggestUncertainty: project.biggestUncertainty };
}

function evidencePayload(evidence: Evidence) {
  return { interviewCount: evidence.interviewCount, activeInterestCount: evidence.messageCount + evidence.signupCount, trialCount: evidence.demoTrialCount, paymentCount: evidence.paymentSignalCount, hasRetention: evidence.retentionSignal };
}
