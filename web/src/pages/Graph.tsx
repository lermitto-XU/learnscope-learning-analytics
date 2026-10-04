import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  ArrowRight,
  Maximize2,
  X,
} from "lucide-react";
import { useData } from "../state";
import {
  PageTitle,
  Notice,
  MasteryBar,
  color,
  status,
  Empty,
} from "../components";
import type { Knowledge } from "../types";

export default function GraphPage() {
  const { graph } = useData();
  const [category, setCategory] = useState("全部领域");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Knowledge>();
  const [types, setTypes] = useState(["PREREQUISITE", "RELATED", "PART_OF"]);
  const [mode, setMode] = useState("mastery");
  const [positions, setPositions] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | {
        id?: number;
        x: number;
        y: number;
        oldX: number;
        oldY: number;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const nodes = graph.nodes.filter(
    (k) =>
      (category === "全部领域" || k.category === category) &&
      (!query ||
        `${k.title} ${k.description}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const ids = new Set(nodes.map((k) => k.id));
  const edges = graph.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && types.includes(e.type),
  );
  const pos = (id: number) =>
    positions[id] || graph.nodes.find((k) => k.id === id)!;
  const point = (event: PointerEvent, local: boolean) => {
    const p = svg.current!.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    return p.matrixTransform(
      (local ? world.current : svg.current)!.getScreenCTM()!.inverse(),
    );
  };
  const start = (event: PointerEvent, id?: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    svg.current!.setPointerCapture(event.pointerId);
    const p = point(event, id !== undefined);
    const old = id === undefined ? offset : pos(id);
    drag.current = {
      id,
      x: p.x,
      y: p.y,
      oldX: old.x,
      oldY: old.y,
      moved: false,
    };
    if (id !== undefined) setSelected(graph.nodes.find((k) => k.id === id));
  };
  const move = (event: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(event, d.id !== undefined);
    const dx = p.x - d.x,
      dy = p.y - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.id !== undefined)
      setPositions((old) => ({
        ...old,
        [d.id!]: { x: d.oldX + dx, y: d.oldY + dy },
      }));
    else setOffset({ x: d.oldX + dx, y: d.oldY + dy });
  };
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE NETWORK"
        title="把知识，连成一张网"
        description="探索概念之间的先修、关联与组成关系，找到自己的位置。"
        action={
          <Link className="button primary" to="/paths">
            规划学习路径
            <ArrowRight size={17} />
          </Link>
        }
      />
      <div className="graph-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="搜索知识点"
            placeholder="搜索知识点…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="筛选知识领域"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["全部领域", ...new Set(graph.nodes.map((k) => k.category))].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
        <select
          aria-label="图谱颜色依据"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="mastery">按掌握度着色</option>
          <option value="difficulty">按难度着色</option>
        </select>
        <div className="graph-relation-toggles">
          {[
            ["PREREQUISITE", "先修"],
            ["RELATED", "关联"],
            ["PART_OF", "组成"],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={types.includes(value)}
                onChange={() =>
                  setTypes(
                    types.includes(value)
                      ? types.filter((t) => t !== value)
                      : [...types, value],
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="graph-layout">
        <div className="graph-canvas panel" ref={box}>
          <div className="graph-canvas-top">
            <span>
              <i />
              {nodes.length} 个知识点 · {edges.length} 条关系
            </span>
            <button
              className="icon-button"
              aria-label="全屏图谱"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void box.current?.requestFullscreen();
              }}
            >
              <Maximize2 size={17} />
            </button>
          </div>
          {!nodes.length ? (
            <Empty
              title="没有匹配的知识点"
              description="试试调整关键词或领域筛选。"
            />
          ) : (
            <svg
              ref={svg}
              className="network-svg"
              viewBox="0 0 1190 680"
              onPointerDown={(e) => start(e)}
              onPointerMove={move}
              onPointerUp={() => {
                drag.current = undefined;
              }}
              onPointerCancel={() => {
                drag.current = undefined;
              }}
              onWheel={(e) =>
                setScale((s) =>
                  Math.max(
                    0.45,
                    Math.min(2.5, s + (e.deltaY < 0 ? 0.08 : -0.08)),
                  ),
                )
              }
              aria-label="交互知识图谱，可拖动节点与画布"
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8b8d2" />
                </marker>
              </defs>
              <g
                ref={world}
                transform={`translate(${offset.x},${offset.y}) scale(${scale})`}
              >
                {edges.map((edge) => {
                  const a = pos(edge.source),
                    b = pos(edge.target),
                    angle = Math.atan2(b.y - a.y, b.x - a.x);
                  const focused =
                    selected &&
                    (edge.source === selected.id ||
                      edge.target === selected.id);
                  return (
                    <line
                      key={edge.id}
                      x1={a.x + Math.cos(angle) * 26}
                      y1={a.y + Math.sin(angle) * 26}
                      x2={b.x - Math.cos(angle) * 30}
                      y2={b.y - Math.sin(angle) * 30}
                      stroke={
                        focused
                          ? "#4d7cfe"
                          : edge.type === "RELATED"
                            ? "#c1a7df"
                            : "#bdcce0"
                      }
                      strokeWidth={focused ? 2.5 : 1.5}
                      strokeDasharray={
                        edge.type === "RELATED"
                          ? "6 5"
                          : edge.type === "PART_OF"
                            ? "2 5"
                            : undefined
                      }
                      markerEnd={
                        edge.type === "PREREQUISITE" ? "url(#arrow)" : undefined
                      }
                    />
                  );
                })}
                {nodes.map((k) => {
                  const p = pos(k.id);
                  const m = graph.mastery[k.id];
                  const fill =
                    mode === "mastery"
                      ? color(m)
                      : `hsl(${220 - k.difficulty * 14}, 65%, 59%)`;
                  return (
                    <g
                      key={k.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${k.title}，${status(m)}，点击查看详情`}
                      transform={`translate(${p.x},${p.y})`}
                      className="graph-node"
                      onPointerDown={(e) => start(e, k.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(k);
                        }
                      }}
                    >
                      <title>
                        {k.title} · 难度 {k.difficulty}/10 · {m.evidence}
                      </title>
                      {selected?.id === k.id && (
                        <circle
                          r="36"
                          fill="#4d7cfe12"
                          stroke="#4d7cfe"
                          strokeWidth="1"
                        />
                      )}
                      <circle
                        r="25"
                        fill={fill}
                        stroke="white"
                        strokeWidth="4"
                      />
                      <text
                        y="5"
                        fill="white"
                        textAnchor="middle"
                        fontSize="14"
                      >
                        {k.id.toString().padStart(2, "0")}
                      </text>
                      <text
                        y="49"
                        textAnchor="middle"
                        fill="#43516c"
                        fontSize="13"
                        fontWeight="500"
                      >
                        {k.title}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
          <div className="graph-controls">
            <button
              className="icon-button"
              aria-label="放大"
              onClick={() => setScale(Math.min(2.5, scale + 0.15))}
            >
              <ZoomIn size={18} />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              className="icon-button"
              aria-label="缩小"
              onClick={() => setScale(Math.max(0.45, scale - 0.15))}
            >
              <ZoomOut size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="重置视图"
              onClick={() => {
                setScale(1);
                setOffset({ x: 0, y: 0 });
                setPositions({});
              }}
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <div className="graph-hint">
            <Move size={14} />
            拖动画布与节点 · 滚轮缩放 · 点击探索
          </div>
        </div>
        <aside className="panel graph-inspector">
          {selected ? (
            <>
              <div className="panel-title">
                <span className="tag">{selected.category}</span>
                <button
                  className="icon-button"
                  onClick={() => setSelected(undefined)}
                  aria-label="关闭知识点详情"
                >
                  <X size={17} />
                </button>
              </div>
              <span className="inspector-id">
                KNOWLEDGE {selected.id.toString().padStart(2, "0")}
              </span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <div className="inspector-mastery">
                <span>当前估计掌握度</span>
                <MasteryBar mastery={graph.mastery[selected.id]} />
                <small>
                  {graph.mastery[selected.id].evidence} ·{" "}
                  {graph.mastery[selected.id].evidenceAttempts} 次计分 /{" "}
                  {graph.mastery[selected.id].attempts} 次作答
                </small>
              </div>
              <div className="key-values">
                <div>
                  <span>知识难度</span>
                  <strong>{selected.difficulty}/10</strong>
                </div>
                <div>
                  <span>参考学习时间</span>
                  <strong>{selected.minutes} 分钟</strong>
                </div>
                <div>
                  <span>先修知识点</span>
                  <strong>
                    {
                      graph.edges.filter(
                        (e) =>
                          e.target === selected.id && e.type === "PREREQUISITE",
                      ).length
                    }{" "}
                    个
                  </strong>
                </div>
              </div>
              <Link
                className="button primary wide"
                to={`/knowledge/${selected.id}`}
              >
                学习这个知识点
                <ArrowRight size={16} />
              </Link>
              <Link
                className="button secondary wide"
                to={`/paths?target=${selected.id}`}
              >
                以此为目标规划路径
              </Link>
            </>
          ) : (
            <>
              <div className="inspector-empty-icon">
                <NetworkIcon />
              </div>
              <h2>知识，不再孤立</h2>
              <p>选择图谱中的任意节点，查看掌握度、先修关系与学习内容。</p>
              <div className="graph-legend">
                {[
                  ["#26a78a", "较熟练 · ≥80%"],
                  ["#4d7cfe", "学习中 · 45–80%"],
                  ["#e6a547", "需巩固 · <45%"],
                  ["#a3adc0", "待诊断 · 无测验证据"],
                ].map(([c, t]) => (
                  <div key={c}>
                    <i style={{ background: c }} />
                    {t}
                  </div>
                ))}
              </div>
              <small>
                实线箭头表示先修方向；虚线表示语义关联；点线表示组成关系。
              </small>
            </>
          )}
        </aside>
      </div>
      <Notice>
        图谱筛选只影响显示，路径规划始终使用完整先修关系。掌握度颜色反映估计状态，不能替代测验诊断。
      </Notice>
    </>
  );
}
function NetworkIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <path
        d="m8 10 25 8-16 16-9-24"
        stroke="#6b8ee9"
        fill="none"
        strokeWidth="2"
      />
      <circle cx="8" cy="10" r="4" fill="#6b8ee9" />
      <circle cx="33" cy="18" r="4" fill="#6b8ee9" />
      <circle cx="17" cy="34" r="4" fill="#6b8ee9" />
    </svg>
  );
}
