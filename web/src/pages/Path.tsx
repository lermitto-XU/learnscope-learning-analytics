import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  Route,
  Target,
  RotateCcw,
} from "lucide-react";
import { useData } from "../state";
import { api, percent } from "../api";
import { PageTitle, Notice, Busy, Empty } from "../components";
import type { Plan } from "../types";

export default function PathPage() {
  const { graph } = useData();
  const [params] = useSearchParams();
  const [target, setTarget] = useState(Number(params.get("target")) || 16);
  const [budget, setBudget] = useState(90);
  const [threshold, setThreshold] = useState(0.8);
  const [plan, setPlan] = useState<Plan>();
  const [applied, setApplied] = useState({ target, budget, threshold });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settingsChanged =
    !!plan &&
    (target !== applied.target ||
      budget !== applied.budget ||
      threshold !== applied.threshold);
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      setPlan(
        await api<Plan>("/paths", {
          targetId: target,
          budgetMinutes: budget,
          threshold,
        }),
      );
      setApplied({ target, budget, threshold });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void generate();
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="PERSONALIZED LEARNING PATH"
        title="让目标，成为一条清晰的路"
        description="从你的学习证据出发，沿着先修关系逐步进阶。"
      />
      <div className="path-layout">
        <aside className="panel path-settings">
          <div className="panel-title">
            <h2>
              <Target size={19} />
              设定学习目标
            </h2>
          </div>
          <label>
            我想掌握
            <select
              aria-label="学习目标知识点"
              disabled={busy}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            >
              {graph.nodes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            本次可用时间 <strong>{budget} 分钟</strong>
            <input
              type="range"
              disabled={busy}
              min="10"
              max="240"
              step="10"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>10 分钟</span>
              <span>4 小时</span>
            </div>
          </label>
          <label>
            跳过较熟练知识的阈值
            <select
              disabled={busy}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            >
              <option value="0.8">80% · 推荐</option>
              <option value="0.9">90% · 更谨慎</option>
              <option value="0.7">70% · 更宽松</option>
            </select>
          </label>
          <p className="field-help">
            至少 5
            次计分证据，且估计掌握度达到阈值时才跳过。同题短时间重做与学习时长不会直接提高掌握度。
          </p>
          <button
            className="button primary wide"
            disabled={busy}
            onClick={() => void generate()}
          >
            {busy ? (
              <Busy />
            ) : (
              <>
                <Route size={17} />
                生成学习路径
              </>
            )}
          </button>
          <div className="method-card">
            <span>这条路径如何生成？</span>
            <p>
              先收集目标的全部先修知识，再按依赖顺序安排；仅在可学习的节点中优先选择较低难度。
            </p>
          </div>
        </aside>
        <section className="path-results">
          {settingsChanged && (
            <div className="scenario-stale" role="status">
              目标或参数已调整，下方保留上次路线。重新生成后生效。
            </div>
          )}
          {error && <Notice>{error}</Notice>}
          {plan && (
            <>
              <div className="path-summary panel">
                <span className="soft-icon">
                  <Route size={24} />
                </span>
                <div>
                  <h2>你的学习路线已就绪</h2>
                  <p>
                    {plan.steps.length} 个待学知识点 · 跳过{" "}
                    {plan.skipped.length} 个已有证据支持的节点
                  </p>
                </div>
                <div className="path-time">
                  <strong>
                    {plan.totalMinutes}
                    <small> 分钟</small>
                  </strong>
                  <span>完整路径估计时间</span>
                </div>
              </div>
              {plan.warnings.map((w) => (
                <Notice key={w}>{w}</Notice>
              ))}
              <div className="path-section-label">
                <span>LEARNING SEQUENCE</span>
                <span>
                  本次安排 {plan.scheduledMinutes} / {applied.budget} 分钟
                </span>
              </div>
              {plan.steps.length ? (
                <div className="path-timeline">
                  {plan.steps.map((step, i) => (
                    <article
                      key={step.knowledge.id}
                      className={`path-step ${step.inBudget ? "" : "deferred"}`}
                    >
                      <div className="step-number">{i + 1}</div>
                      <div className="step-body">
                        <div className="step-top">
                          <span className="tag">{step.knowledge.category}</span>
                          <span
                            className={`pill ${step.inBudget ? "blue" : "gray"}`}
                          >
                            {step.inBudget ? "本次学习" : "后续安排"}
                          </span>
                        </div>
                        <h3>{step.knowledge.title}</h3>
                        <p>{step.reason}</p>
                        <div className="step-meta">
                          <span>
                            <Clock3 size={14} />约 {step.estimatedMinutes} 分钟
                          </span>
                          <span>难度 {step.knowledge.difficulty}/10</span>
                          <span>估计掌握度 {percent(step.mastery)}</span>
                        </div>
                      </div>
                      <Link
                        className="step-action"
                        to={`/knowledge/${step.knowledge.id}`}
                        aria-label={`学习${step.knowledge.title}`}
                      >
                        <ArrowRight size={20} />
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="panel">
                  <Empty
                    title="这个目标已有充分的初步证据"
                    description="可以完成一次巩固测验，或选择更深入的目标。"
                  />
                  <Link
                    className="button primary"
                    to={`/assessment?knowledge=${target}`}
                  >
                    <Check size={17} />
                    检验当前理解
                  </Link>
                </div>
              )}
              <div className="path-bottom">
                <span>
                  <Check size={16} />
                  先修关系始终保留
                </span>
                <button
                  className="text-button"
                  onClick={() => void generate()}
                  disabled={busy}
                >
                  <RotateCcw size={15} />
                  按最新记录重新规划
                </button>
              </div>
            </>
          )}
          {!plan && !busy && !error && (
            <Empty
              title="选择一个想掌握的目标"
              description="系统会结合先修关系与学习证据，为你生成路径。"
            />
          )}
        </section>
      </div>
      <Notice>
        路径提供满足依赖约束的学习顺序，不声称全局最短或最优。预计时长为基于课程参考时间与当前估计的启发式值。
      </Notice>
    </>
  );
}
