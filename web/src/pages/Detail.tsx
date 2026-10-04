import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  Save,
  Network,
  CircleCheck,
} from "lucide-react";
import { useData } from "../state";
import { api, percent } from "../api";
import { Notice, MasteryBar, Busy, Empty } from "../components";

export default function Detail() {
  const { id } = useParams();
  const { graph, refresh, notify } = useData();
  const k = graph.nodes.find((k) => k.id === Number(id));
  const m = graph.mastery[Number(id)];
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSeconds(0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus())
        setSeconds((s) => Math.min(1800, s + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [id]);
  const save = async () => {
    if (!k) return;
    setSaving(true);
    try {
      await api("/study", { knowledgeId: k.id, seconds });
      setSeconds(0);
      await refresh();
      notify("学习时间已记录。完成测验可更新掌握度估计。");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  if (!k || !m)
    return (
      <Empty title="找不到这个知识点" description="请从知识图谱中重新选择。" />
    );
  const parents = graph.edges
    .filter((e) => e.target === k.id && e.type === "PREREQUISITE")
    .map((e) => graph.nodes.find((n) => n.id === e.source)!);
  return (
    <>
      <Link to="/graph" className="back-link">
        <ArrowLeft size={16} />
        返回知识图谱
      </Link>
      <div className="detail-header">
        <div>
          <span className="tag">{k.category}</span>
          <h1>{k.title}</h1>
          <p>{k.description}</p>
          <div className="detail-meta">
            <span>难度 {k.difficulty}/10</span>
            <span>
              <Clock3 size={15} />
              参考 {k.minutes} 分钟
            </span>
            <span>{parents.length} 个先修知识点</span>
          </div>
        </div>
        <Link className="button primary" to={`/assessment?knowledge=${k.id}`}>
          <ClipboardCheck size={18} />
          检验我的理解
        </Link>
      </div>
      <div className="detail-layout">
        <article className="panel lesson-content">
          {k.content
            .split("\n")
            .map((line, i) =>
              line.startsWith("## ") ? (
                <h2 key={i}>{line.slice(3)}</h2>
              ) : line ? (
                <p key={i}>{line}</p>
              ) : null,
            )}
          <div className="lesson-action">
            <div>
              <Clock3 size={18} />
              <span>
                本次有效停留{" "}
                <strong>
                  {Math.floor(seconds / 60)} 分 {seconds % 60} 秒
                </strong>
              </span>
            </div>
            <button
              className="button secondary"
              disabled={seconds < 10 || saving}
              onClick={() => void save()}
            >
              {saving ? (
                <Busy text="保存中…" />
              ) : (
                <>
                  <Save size={16} />
                  保存学习记录
                </>
              )}
            </button>
          </div>
          <p className="field-help">
            只累计页面可见且获得焦点时的时间。至少 10
            秒可保存；离开本页前请主动保存，未保存的时间不进入分析。
          </p>
        </article>
        <aside>
          <section className="panel detail-evidence">
            <h2>我的学习证据</h2>
            <span className="muted">当前估计掌握度</span>
            <MasteryBar mastery={m} />
            <div className="key-values">
              <div>
                <span>累计作答</span>
                <strong>{m.attempts} 次</strong>
              </div>
              <div>
                <span>计分证据</span>
                <strong>
                  {m.evidenceAttempts} 次 · 答对 {m.evidenceCorrect} 次
                </strong>
              </div>
              <div>
                <span>累计学习</span>
                <strong>{Math.round(m.seconds / 60)} 分钟</strong>
              </div>
              <div>
                <span>距最近计分诊断</span>
                <strong>
                  {m.evidenceAttempts ? `${Math.round(m.daysSince)} 天` : "—"}
                </strong>
              </div>
            </div>
            <div className="evidence-label">
              <CircleCheck size={15} />
              {m.evidence}
            </div>
            <p className="field-help">
              同题距上次计分不足 24 小时的重做仅记练习。目前{" "}
              {m.attempts - m.evidenceAttempts} 次重做未重复计分。
            </p>
            {m.evidenceAttempts > 0 && (
              <p className="field-help">
                计分证据答对比例的近似 95% Wilson 区间：{percent(m.lower)}–
                {percent(m.upper)}
                。它描述测验比例的不确定性，不是掌握度的置信区间；重复题目会降低证据独立性。
              </p>
            )}
          </section>
          <section className="panel prerequisites">
            <h2>
              <Network size={18} />
              先修知识
            </h2>
            {parents.length ? (
              parents.map((p) => (
                <Link key={p.id} to={`/knowledge/${p.id}`}>
                  <span>{p.title}</span>
                  <ArrowRight size={15} />
                </Link>
              ))
            ) : (
              <p className="muted">这是基础知识点，没有额外先修要求。</p>
            )}
            <Link className="text-link" to={`/paths?target=${k.id}`}>
              查看完整学习路径
              <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <Notice>
        页面内容与题库为本项目编写的演示课程。知识掌握不能由阅读时间证明，测验也只是有限证据。
      </Notice>
    </>
  );
}
