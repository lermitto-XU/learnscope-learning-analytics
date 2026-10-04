import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Network,
  Target,
  Clock3,
  CircleCheck,
  ChartNoAxesCombined,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import { useData } from "../state";
import { Chart, KnowledgeCard, Notice } from "../components";
import { date, percent } from "../api";

export default function Dashboard() {
  const { overview, graph, user } = useData();
  const s = overview.stats;
  const weak = graph.nodes
    .filter(
      (k) =>
        graph.mastery[k.id].evidenceAttempts > 0 &&
        graph.mastery[k.id].value < 0.8,
    )
    .sort((a, b) => graph.mastery[a.id].value - graph.mastery[b.id].value)
    .slice(0, 3);
  const option = {
    tooltip: {
      trigger: "axis" as const,
      valueFormatter: (value: unknown) => `${value}%`,
    },
    grid: { top: 26, right: 20, bottom: 24, left: 40 },
    xAxis: {
      type: "category" as const,
      data: overview.trend.map((t) => date(t.timestamp)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#95a0b2", interval: 2 },
    },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      axisLabel: { formatter: "{value}%", color: "#95a0b2" },
      splitLine: { lineStyle: { color: "#f0f2f6" } },
    },
    series: [
      {
        type: "line" as const,
        smooth: true,
        data: overview.trend.map((t) => Math.round(t.mastery * 100)),
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 3, color: "#4d7cfe" },
        itemStyle: { color: "#4d7cfe" },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#4d7cfe35" },
              { offset: 1, color: "#4d7cfe00" },
            ],
          },
        },
      },
    ],
  };
  return (
    <>
      <div className="dashboard-greeting">
        <div>
          <div className="eyebrow">YOUR LEARNING, IN FOCUS</div>
          <h1>
            你好，{user.displayName} <span className="greeting-dot">✦</span>
          </h1>
          <p>从知识的联系中，找到适合你的下一步。</p>
        </div>
        <Link className="button secondary" to="/assessment">
          <ClipboardCheck size={17} />
          开始诊断测验
        </Link>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            基于知识图谱的学习分析
          </span>
          <h2>每一步，都有知识的依据。</h2>
          <p>
            了解当前的掌握情况，梳理知识之间的依赖，
            <br />
            为你的下一个目标规划清晰的学习路径。
          </p>
          <div>
            <Link to="/paths" className="button primary">
              规划我的学习路径 <ArrowRight size={17} />
            </Link>
            <Link to="/graph" className="hero-link">
              探索知识图谱 <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <svg viewBox="0 0 430 235">
            <defs>
              <pattern
                id="dots"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="#b3c7ec" />
              </pattern>
            </defs>
            <rect width="430" height="235" fill="url(#dots)" opacity=".45" />
            <g fill="none" stroke="#bacbf4" strokeWidth="2">
              <path d="M55 115 145 45 240 112 363 53M55 115 152 202 240 112 359 194M145 45 152 202M240 112 363 53" />
            </g>
            {[
              [55, 115, "基础"],
              [145, 45, "结构"],
              [152, 202, "反馈"],
              [240, 112, "知识"],
              [363, 53, "进阶"],
              [359, 194, "目标"],
            ].map(([x, y, name], i) => (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={i === 3 ? 33 : 25}
                  fill={i === 3 ? "#4d7cfe" : "white"}
                  stroke={i === 3 ? "#4d7cfe" : "#d7e2f5"}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={Number(y) + 5}
                  textAnchor="middle"
                  fontSize="13"
                  fill={i === 3 ? "white" : "#5a7299"}
                >
                  {name}
                </text>
              </g>
            ))}
          </svg>
          <span className="visual-caption">
            <Network size={14} />
            让分散的知识，连成可理解的结构
          </span>
        </div>
      </section>
      <div className="stat-grid">
        {[
          {
            label: "平均估计掌握度",
            value: percent(s.average),
            foot: "基于测验证据的 BKT 估计",
            icon: ChartNoAxesCombined,
            color: "blue",
          },
          {
            label: "较熟练知识点",
            value: `${s.mastered}`,
            unit: `/ ${s.totalKnowledge}`,
            foot: "估计 ≥80%，且至少 5 次计分证据",
            icon: CircleCheck,
            color: "green",
          },
          {
            label: "累计学习时间",
            value: (s.studySeconds / 3600).toFixed(1),
            unit: "小时",
            foot: "记录投入，帮助回顾学习节奏",
            icon: Clock3,
            color: "purple",
          },
          {
            label: "证据正确率",
            value: s.evidenceAttempts ? percent(s.evidenceAccuracy) : "—",
            foot: `${s.evidenceAttempts} 次计分 / ${s.attempts} 次作答`,
            icon: Target,
            color: "orange",
          },
        ].map((item) => (
          <article className="stat-card" key={item.label}>
            <div>
              <span>{item.label}</span>
              <span className={`stat-icon ${item.color}`}>
                <item.icon size={19} />
              </span>
            </div>
            <strong>
              {item.value}
              <small>{item.unit}</small>
            </strong>
            <p>{item.foot}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>理解，正在逐步累积</h2>
              <p>近 14 天 · 全课程平均估计掌握度</p>
            </div>
            <span className="chart-legend">
              <i />
              掌握度估计
            </span>
          </div>
          <Chart
            option={option}
            label="近14天平均估计掌握度折线图"
            height={255}
          />
        </section>
        <section className="panel focus-panel">
          <div className="panel-title">
            <div>
              <h2>值得再巩固一下</h2>
              <p>用一次测验，更新你的学习证据</p>
            </div>
            <span className="soft-icon">
              <Target size={19} />
            </span>
          </div>
          {weak.length ? (
            weak.map((k) => (
              <Link
                to={`/assessment?knowledge=${k.id}`}
                key={k.id}
                className="focus-row"
              >
                <span className="focus-node">
                  <Network size={17} />
                </span>
                <div>
                  <strong>{k.title}</strong>
                  <small>{graph.mastery[k.id].evidence}</small>
                </div>
                <span>{percent(graph.mastery[k.id].value)}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <div className="small-empty">
              尚未找到薄弱点。先完成一次诊断测验。
            </div>
          )}
          <Link to="/analysis" className="text-link">
            查看完整掌握度分析 <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="recommendations">
        <div className="section-heading">
          <div>
            <h2>
              <Sparkles size={20} />
              接下来，学什么？
            </h2>
            <p>优先推荐先修条件已满足的知识点</p>
          </div>
          <Link to="/graph" className="text-link">
            全部知识点 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="knowledge-grid">
          {overview.recommendations.map((r) => (
            <KnowledgeCard key={r.knowledge.id} {...r} />
          ))}
        </div>
        {!overview.recommendations.length && (
          <Notice>
            当前知识点均已具备初步证据。可在图谱中选择新目标，或通过测验检查记忆保持情况。
          </Notice>
        )}
      </section>
      <Notice>
        演示账号的初始记录与预测训练数据为合成数据。掌握度是估计值；完成真实测验后，分析和路径会随你的作答更新。
      </Notice>
    </>
  );
}
