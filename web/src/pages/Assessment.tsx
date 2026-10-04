import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ClipboardCheck,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  Target,
} from "lucide-react";
import { useData } from "../state";
import { api, percent } from "../api";
import { PageTitle, Notice, Busy } from "../components";
import type { Assessment, QuizResult } from "../types";

export default function AssessmentPage() {
  const { graph, refresh, notify } = useData();
  const [params] = useSearchParams();
  const [target, setTarget] = useState(Number(params.get("knowledge")) || 15);
  const [assessment, setAssessment] = useState<Assessment>();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      setAssessment(
        await api<Assessment>("/assessments", { knowledgeId: target }),
      );
      setAnswers({});
      setResult(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!assessment) return;
    setBusy(true);
    setError("");
    try {
      const submitted = await api<QuizResult>("/assessments/submit", {
        assessmentId: assessment.id,
        answers: assessment.questions.map((_, i) => answers[i]),
      });
      setResult(submitted);
      await refresh();
      notify(
        submitted.historicalResult
          ? "已恢复历史测验结果，未产生新的学习记录。"
          : submitted.evidenceAdded
            ? `已保存作答，新增 ${submitted.evidenceAdded} 次计分证据。`
            : "练习已保存；同题 24 小时内重做不重复计分。",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const title = graph.nodes.find(
    (k) => k.id === (assessment?.knowledgeId || target),
  )?.title;
  return (
    <>
      <PageTitle
        eyebrow="DIAGNOSTIC ASSESSMENT"
        title="理解，经得起一次自检"
        description="通过短测验积累学习证据，让分析与路径跟上你的进步。"
      />
      <section className="panel assessment-selector">
        <div>
          <h2>
            <Target size={20} />
            选择诊断知识点
          </h2>
          <p>题目按当前估计能力与难度匹配，每次 3 题</p>
        </div>
        <select
          aria-label="选择诊断知识点"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          disabled={busy}
        >
          {graph.nodes.map((k) => (
            <option key={k.id} value={k.id}>
              {k.title}
            </option>
          ))}
        </select>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void start()}
        >
          {busy && !assessment ? (
            <Busy />
          ) : (
            <>
              <ClipboardCheck size={17} />
              {assessment ? "开始新测验" : "开始诊断"}
            </>
          )}
        </button>
      </section>
      {error && <Notice>{error}</Notice>}
      {!assessment && (
        <div className="assessment-intro">
          <div className="big-soft-icon">
            <ClipboardCheck size={40} />
          </div>
          <h2>先确认理解，再决定下一步</h2>
          <p>
            测验答案由服务端验证。完成之后，
            <br />
            可以看到解析、更新后的估计与下一步路径。
          </p>
          <div>
            <span>
              <Check size={15} />
              完整解析
            </span>
            <span>
              <Check size={15} />
              真实作答记录
            </span>
            <span>
              <Check size={15} />
              路径同步更新
            </span>
          </div>
        </div>
      )}
      {assessment && !result && (
        <section className="quiz">
          <div className="section-heading">
            <h2>{title} · 诊断测验</h2>
            <span className="pill blue">
              已答 {Object.keys(answers).length}/{assessment.questions.length}
            </span>
          </div>
          {assessment.questions.map((q, i) => (
            <fieldset className="panel quiz-question" key={q.id}>
              <legend>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {q.prompt}
              </legend>
              <div className="quiz-options">
                {q.options.map((text, choice) => (
                  <label
                    className={answers[i] === choice ? "selected" : ""}
                    key={choice}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      checked={answers[i] === choice}
                      onChange={() =>
                        setAnswers((old) => ({ ...old, [i]: choice }))
                      }
                      disabled={busy}
                    />
                    <span className="option-letter">
                      {String.fromCharCode(65 + choice)}
                    </span>
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="quiz-submit">
            <p>答案提交后会生成学习证据，重复提交不会重复记分。</p>
            <button
              className="button primary"
              disabled={
                busy ||
                Object.keys(answers).length < assessment.questions.length
              }
              onClick={() => void submit()}
            >
              {busy ? (
                <Busy text="提交中…" />
              ) : (
                <>
                  提交并查看分析
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </section>
      )}
      {result && assessment && (
        <>
          {result.historicalResult && (
            <Notice>
              这是升级前保存的历史结果，题目来源未追溯。下方证据量为当时计分情况，本次查看没有新增记录。
            </Notice>
          )}
          <section className="panel quiz-result-banner">
            <span className="big-soft-icon">
              <Check size={32} />
            </span>
            <div>
              <div className="eyebrow">ASSESSMENT COMPLETE</div>
              <h2>
                {result.evidenceAdded
                  ? "这次自检，成为新的学习证据"
                  : "练习已记录，继续巩固理解"}
              </h2>
              <p>
                {title} · 答对 {result.correct}/{result.total} 题
              </p>
            </div>
            <div>
              <strong>{percent(result.mastery.value)}</strong>
              <span>
                {result.historicalResult
                  ? "当时的估计掌握度"
                  : "更新后的估计掌握度"}
              </span>
            </div>
          </section>
          <div className="assessment-evidence" role="status">
            <div>
              <strong>{result.evidenceAdded}</strong>
              <span>
                {result.historicalResult ? "当时计分证据" : "新增计分证据"}
              </span>
            </div>
            <div>
              <strong>{result.repeatedAnswers}</strong>
              <span>同题重做，仅记练习</span>
            </div>
            <p>
              同一道题距上次计分满 24
              小时后可再次诊断。短时间重做不会抬高掌握度或让路径提前跳过知识点。
              {result.mastery.legacyAttempts > 0 &&
                ` 此估计包含 ${result.mastery.legacyAttempts} 次未追溯题目的历史计分。`}
            </p>
          </div>
          <div className="result-actions">
            <Link
              className="button primary"
              to={`/paths?target=${assessment.knowledgeId}`}
            >
              按最新证据重新规划
              <ArrowRight size={17} />
            </Link>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void start()}
            >
              <RotateCcw size={17} />
              再做一次诊断
            </button>
          </div>
          {result.feedback.map((f, i) => (
            <article className="panel answer-feedback" key={i}>
              <div className="feedback-title">
                <span className={f.correct ? "correct" : "incorrect"}>
                  {f.correct ? <Check size={18} /> : <X size={18} />}
                </span>
                <h3>
                  {i + 1}. {f.prompt}
                </h3>
                <span className={`pill ${f.correct ? "green" : "orange"}`}>
                  {f.correct ? "回答正确" : "可以再巩固"}
                </span>
              </div>
              <p>
                你的答案：{f.options[f.selected]}　
                {!f.correct && `正确答案：${f.options[f.answer]}`}
              </p>
              <div className="answer-explanation">
                <strong>理解这道题</strong>
                <p>{f.explanation}</p>
              </div>
            </article>
          ))}
        </>
      )}
      <Notice>
        当前题库为每个知识点配置 3
        道单选题，按能力与难度排序；不属于题目生成模型或完整的 CAT 测验。同题 24
        小时内只计分一次；间隔复测也不等于完全独立的测量证据。
      </Notice>
    </>
  );
}
