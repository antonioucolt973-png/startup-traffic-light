import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { getPublicSurvey, submitSurveyResponse } from "../lib/cloud";
import type { SurveyDraft } from "../types";

interface PublicSurvey {
  id: string;
  title: string;
  introduction: string;
  questions: SurveyDraft["questions"];
}

export function PublicSurveyPage({ slug }: { slug: string }) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "sending" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getPublicSurvey(slug).then((data) => {
      if (!data) throw new Error("问卷不存在或已关闭");
      setSurvey(data);
      setStatus("ready");
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : "问卷加载失败");
      setStatus("error");
    });
  }, [slug]);

  function setAnswer(questionId: string, value: string, multiple = false) {
    setAnswers((current) => {
      if (!multiple) return { ...current, [questionId]: value };
      const selected = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
      return { ...current, [questionId]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });
  }

  async function submit() {
    if (!survey) return;
    const missing = survey.questions.find((question) => question.required && (!answers[question.id] || answers[question.id].length === 0));
    if (missing) {
      setMessage(`请先回答：${missing.prompt}`);
      return;
    }
    setStatus("sending");
    try {
      await submitSurveyResponse(survey.id, answers, contact, consent);
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试");
      setStatus("ready");
    }
  }

  if (status === "loading") return <main className="publicSurveyState"><LoaderCircle className="spin" /><p>正在加载问卷</p></main>;
  if (status === "error") return <main className="publicSurveyState"><h1>暂时无法打开问卷</h1><p>{message}</p></main>;
  if (status === "done") return <main className="publicSurveyState success"><CheckCircle2 size={42} /><h1>提交成功</h1><p>感谢你提供真实经历。你的回答将被匿名汇总，AI不会改写原始内容。</p></main>;
  if (!survey) return null;

  return (
    <main className="publicSurveyPage">
      <header><div className="publicBrand"><i /><i /><i /><span>OPC创业红绿灯</span></div><h1>{survey.title}</h1><p>{survey.introduction}</p></header>
      <section className="publicQuestionList">
        {survey.questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend><span>{String(index + 1).padStart(2, "0")}</span>{question.prompt}{question.required && <em>必答</em>}</legend>
            {(question.type === "short_text" || question.type === "long_text") && (question.type === "long_text" ? <textarea value={String(answers[question.id] || "")} onChange={(event) => setAnswer(question.id, event.target.value)} /> : <input value={String(answers[question.id] || "")} onChange={(event) => setAnswer(question.id, event.target.value)} />)}
            {(question.type === "single_choice" || question.type === "multiple_choice") && <div className="publicOptions">{question.options.map((option) => <label key={option}><input type={question.type === "single_choice" ? "radio" : "checkbox"} name={question.id} checked={question.type === "single_choice" ? answers[question.id] === option : Array.isArray(answers[question.id]) && answers[question.id].includes(option)} onChange={() => setAnswer(question.id, option, question.type === "multiple_choice")} /><span>{option}</span></label>)}</div>}
            {question.type === "scale" && <input type="range" min="1" max="5" value={Number(answers[question.id] || 3)} onChange={(event) => setAnswer(question.id, event.target.value)} />}
          </fieldset>
        ))}
      </section>
      <section className="surveyContact"><label><span>愿意后续沟通？可选填联系方式</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="微信、邮箱或其他联系方式" /></label><label className="consentField"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我同意项目方仅为本次需求验证联系我</span></label></section>
      {message && <p className="surveyMessage">{message}</p>}
      <button className="surveySubmit" type="button" onClick={() => void submit()} disabled={status === "sending"}>{status === "sending" ? <LoaderCircle className="spin" /> : <Send size={17} />}提交真实反馈</button>
    </main>
  );
}
