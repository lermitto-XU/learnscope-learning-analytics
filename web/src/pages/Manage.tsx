import { useEffect, useState, type FormEvent } from "react";
import {
  Settings2,
  Save,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../state";
import { api } from "../api";
import { PageTitle, Notice, Busy } from "../components";
import type { Knowledge } from "../types";

type ManageData = {
  users: { id: number; username: string; display_name: string; role: string }[];
  audit: { action: string; detail: string; created_at: number }[];
  events: number;
  model: { available: boolean };
};
export default function Manage() {
  const { graph, user, refresh, notify } = useData();
  const [target, setTarget] = useState(1);
  const [edit, setEdit] = useState<Knowledge>(graph.nodes[0]);
  const [source, setSource] = useState(1);
  const [destination, setDestination] = useState(18);
  const [type, setType] = useState("PREREQUISITE");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ManageData>();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [content, setContent] = useState("## 核心概念\n");
  const reload = () =>
    api<ManageData>("/management")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user.role !== "STUDENT") void reload();
  }, [user.role]);
  useEffect(() => {
    if (!creating)
      setEdit(graph.nodes.find((k) => k.id === target) || graph.nodes[0]);
  }, [target, graph, creating]);
  if (user.role === "STUDENT")
    return <Notice>该页面需要教师或管理员权限。</Notice>;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        title: edit.title,
        description: edit.description,
        category: edit.category,
        difficulty: edit.difficulty,
        minutes: edit.minutes,
      };
      if (creating) {
        const added = await api<Knowledge>("/knowledge", { ...body, content });
        setTarget(added.id);
        setCreating(false);
      } else
        await api(
          `/knowledge/${target}`,
          { ...body, version: edit.version },
          "PUT",
        );
      await refresh();
      await reload();
      notify("知识点已保存");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const relation = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/relations", { source, target: destination, type, weight: 1 });
      await refresh();
      await reload();
      notify("知识关系已保存");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await api(`/relations/${id}`, undefined, "DELETE");
      await refresh();
      await reload();
      notify("关系已删除");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE CURATION"
        title="让知识结构保持可靠"
        description="维护核心知识内容与关系，在写入时校验依赖一致性。"
        action={
          <span className="pill green">
            <ShieldCheck size={15} />
            服务端权限校验
          </span>
        }
      />
      {error && <Notice>{error}</Notice>}
      <div className="management-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>
              <Settings2 size={19} />
              {creating ? "创建知识点" : "编辑知识点"}
            </h2>
            <button
              className="text-button"
              onClick={() => {
                setCreating(!creating);
                if (!creating)
                  setEdit({
                    ...graph.nodes[0],
                    title: "",
                    description: "",
                    difficulty: 3,
                    minutes: 30,
                  });
              }}
            >
              {creating ? (
                "返回编辑"
              ) : (
                <>
                  <Plus size={15} />
                  新建知识点
                </>
              )}
            </button>
          </div>
          <form onSubmit={save}>
            {!creating && (
              <label>
                选择知识点
                <select
                  aria-label="选择编辑知识点"
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
            )}
            <label>
              标题
              <input
                value={edit.title}
                maxLength={100}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                required
              />
            </label>
            <label>
              领域
              <input
                value={edit.category}
                maxLength={64}
                onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                required
              />
            </label>
            <label>
              描述
              <textarea
                value={edit.description}
                maxLength={1000}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
                rows={3}
                required
              />
            </label>
            <div className="two-fields">
              <label>
                难度 1–10
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={edit.difficulty}
                  onChange={(e) =>
                    setEdit({ ...edit, difficulty: Number(e.target.value) })
                  }
                  required
                />
              </label>
              <label>
                参考时间（分钟）
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={edit.minutes}
                  onChange={(e) =>
                    setEdit({ ...edit, minutes: Number(e.target.value) })
                  }
                  required
                />
              </label>
            </div>
            {creating && (
              <label>
                课程内容
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  required
                  maxLength={20000}
                />
              </label>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? (
                <Busy text="保存中…" />
              ) : (
                <>
                  <Save size={16} />
                  保存知识点
                </>
              )}
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>
              <Plus size={19} />
              添加知识关系
            </h2>
          </div>
          <label>
            源知识点
            <select
              aria-label="源知识点"
              value={source}
              onChange={(e) => setSource(Number(e.target.value))}
            >
              {graph.nodes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            关系类型
            <select
              aria-label="关系类型"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="PREREQUISITE">先修 · 源先学，目标后学</option>
              <option value="RELATED">语义关联</option>
              <option value="PART_OF">组成 · 源是目标的组成部分</option>
            </select>
          </label>
          <label>
            目标知识点
            <select
              aria-label="目标知识点"
              value={destination}
              onChange={(e) => setDestination(Number(e.target.value))}
            >
              {graph.nodes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void relation()}
          >
            {busy ? (
              <Busy />
            ) : (
              <>
                <Plus size={16} />
                保存关系
              </>
            )}
          </button>
          <Notice>
            添加先修边之前，服务端检查是否形成环。图谱编辑在事务中串行校验，避免并发新增关系绕过检查。
          </Notice>
          <div className="system-summary">
            <div>
              <span>累计行为记录</span>
              <strong>{data?.events ?? "—"}</strong>
            </div>
            <div>
              <span>预测服务</span>
              <strong>
                {data?.model.available ? "模型已加载" : "规则回退可用"}
              </strong>
            </div>
            <div>
              <span>知识点总数</span>
              <strong>{graph.nodes.length}</strong>
            </div>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>当前关系</h2>
          <span className="muted">{graph.edges.length} 条</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>源知识点</th>
                <th>关系</th>
                <th>目标知识点</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {graph.edges.map((e) => (
                <tr key={e.id}>
                  <td>{graph.nodes.find((k) => k.id === e.source)?.title}</td>
                  <td>
                    <span className="tag">
                      {e.type === "PREREQUISITE"
                        ? "先修"
                        : e.type === "RELATED"
                          ? "关联"
                          : "组成"}
                    </span>
                  </td>
                  <td>{graph.nodes.find((k) => k.id === e.target)?.title}</td>
                  <td>
                    <button
                      className="icon-button danger"
                      disabled={busy}
                      onClick={() => void remove(e.id)}
                      aria-label={`删除${graph.nodes.find((k) => k.id === e.source)?.title}到${graph.nodes.find((k) => k.id === e.target)?.title}的关系`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Notice>
        新建知识点可参与图谱与路径分析。当前管理界面不提供题库编辑；新增节点若未配置题目，诊断接口会明确返回“暂未配置测验”。
      </Notice>
    </>
  );
}
