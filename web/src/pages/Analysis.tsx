import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  FlaskConical,
  TrendingUp,
  Info,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useData } from "../state";
import { api, percent, download } from "../api";
import {
  PageTitle,
  Notice,
  Chart,
  MasteryBar,
  status,
  Busy,
  color,
} from "../components";
import type { Forecast, Metrics } from "../types";

const tabs = ["掌握度概览", "情景预测", "模型评估", "知识点对比"];
export default function Analysis() {
  const { graph, overview, notify } = useData();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(16);
  const [minutes, setMinutes] = useState(30);
  const [days, setDays] = useState(3);
  const [forecast, setForecast] = useState<Forecast>();
  const [scenario, setScenario] = useState({ target, minutes, days });
  const [forecastError, setForecastError] = useState("");
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>();
  const [metricError, setMetricError] = useState("");
  const [metricsRetry, setMetricsRetry] = useState(0);
  const [selected, setSelected] = useState([13, 14, 16]);
  const predict = async () => {
    setBusy(true);
    setForecastError("");
    try {
      setForecast(
        await api<Forecast>("/predictions", {
          knowledgeId: target,
          plannedMinutes: minutes,
          horizonDays: days,
        }),
      );
      setScenario({ target, minutes, days });
    } catch (e) {
      setForecastError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    if (tab === 2 && !metrics) {
      setMetricError("");
      void api<Metrics>("/models/metrics")
        .then((value) => {
          if (!cancelled) setMetrics(value);
        })
        .catch((e) => {
          if (!cancelled) setMetricError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, metrics, metricsRetry]);
  const scenarioChanged =
    !!forecast &&
    (scenario.target !== target ||
      scenario.minutes !== minutes ||
      scenario.days !== days);
  const exportRecords = async () => {
    try {
      download(
        "learnscope-learning-evidence.json",
        await api("/records/export"),
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const groups = ["较熟练", "学习中", "需巩固", "待诊断"];
  const groupColors = ["#26a78a", "#4d7cfe", "#e6a547", "#a3adc0"];
  return (
    <>
      <PageTitle
        eyebrow="LEARNING ANALYTICS & PREDICTION"
        title="用证据，理解你的学习"
        description="区分当前状态、未来情景和模型表现，让每一个数字都有来处。"
        action={
          <button
            className="button secondary"
            onClick={() => void exportRecords()}
          >
            <Download size={17} />
            导出我的学习证据
          </button>
        }
      />
      <div className="tabs" role="tablist">
        {tabs.map((t, i) => (
          <button
            role="tab"
            aria-selected={tab === i}
            key={t}
            onClick={() => setTab(i)}
            className={tab === i ? "active" : ""}
          >
            {t}
            {i === 1 && <span>LAB</span>}
          </button>
        ))}
      </div>
      {tab === 0 && (
        <>
          <div className="analysis-top">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>知识掌握度分布</h2>
                  <p>根据作答历史更新的 BKT 估计</p>
                </div>
              </div>
              <Chart
                height={235}
                label="知识点掌握度分布环形图"
                option={{
                  tooltip: { trigger: "item" },
                  color: groupColors,
                  series: [
                    {
                      type: "pie",
                      radius: ["56%", "78%"],
                      center: ["50%", "46%"],
                      itemStyle: {
                        borderColor: "white",
                        borderWidth: 5,
                        borderRadius: 7,
                      },
                      label: { show: false },
                      data: groups.map((name) => ({
                        name,
                        value: graph.nodes.filter(
                          (k) => status(graph.mastery[k.id]) === name,
                        ).length,
                      })),
                    },
                  ],
                  graphic: [
                    {
                      type: "text",
                      left: "center",
                      top: "35%",
                      style: {
                        text: String(graph.nodes.length),
                        fill: "#24314c",
                        font: "bold 32px sans-serif",
                      },
                    },
                    {
                      type: "text",
                      left: "center",
                      top: "53%",
                      style: {
                        text: "知识点",
                        fill: "#94a0b4",
                        font: "12px sans-serif",
                      },
                    },
                  ],
                }}
              />
              <div className="distribution-legend">
                {groups.map((g, i) => (
                  <div key={g}>
                    <i style={{ background: groupColors[i] }} />
                    {g}
                    <strong>
                      {
                        graph.nodes.filter(
                          (k) => status(graph.mastery[k.id]) === g,
                        ).length
                      }
                    </strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>学习投入与节奏</h2>
                  <p>近 14 天 · 已保存的学习时间</p>
                </div>
              </div>
              <Chart
                label="近14天学习时间柱状图"
                height={280}
                option={{
                  tooltip: { trigger: "axis" },
                  grid: { left: 40, right: 15, bottom: 30, top: 25 },
                  xAxis: {
                    type: "category",
                    data: overview.trend.map((t) =>
                      new Date(t.timestamp).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        timeZone: "Asia/Shanghai",
                      }),
                    ),
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { interval: 2, color: "#95a0b2" },
                  },
                  yAxis: {
                    type: "value",
                    name: "分钟",
                    nameTextStyle: { color: "#95a0b2" },
                    splitLine: { lineStyle: { color: "#f0f2f6" } },
                    axisLabel: { color: "#95a0b2" },
                  },
                  series: [
                    {
                      type: "bar",
                      barMaxWidth: 20,
                      data: overview.trend.map((t) => t.minutes),
                      itemStyle: {
                        color: "#86a5fe",
                        borderRadius: [5, 5, 0, 0],
                      },
                    },
                  ],
                }}
              />
            </section>
          </div>
          <section className="panel knowledge-table">
            <div className="panel-title">
              <div>
                <h2>每个知识点的学习证据</h2>
                <p>投入、测验与状态放在一起看</p>
              </div>
              <div className="search-input">
                <Search size={16} />
                <input
                  aria-label="筛选掌握度列表"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索知识点"
                />
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>知识点</th>
                    <th>估计掌握度</th>
                    <th>计分证据 / 作答</th>
                    <th>证据正确率</th>
                    <th>学习时长</th>
                    <th>状态</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {graph.nodes
                    .filter((k) => k.title.includes(query))
                    .map((k) => {
                      const m = graph.mastery[k.id];
                      return (
                        <tr key={k.id}>
                          <td>
                            <Link to={`/knowledge/${k.id}`}>
                              <strong>{k.title}</strong>
                            </Link>
                            <small>{k.category}</small>
                          </td>
                          <td>
                            <MasteryBar mastery={m} />
                          </td>
                          <td>
                            {m.evidenceAttempts} / {m.attempts} 次
                          </td>
                          <td>
                            {m.evidenceAttempts
                              ? percent(m.evidenceCorrect / m.evidenceAttempts)
                              : "—"}
                          </td>
                          <td>{Math.round(m.seconds / 60)} 分钟</td>
                          <td>
                            <span
                              className="status-dot"
                              style={{ color: color(m) }}
                            >
                              {status(m)}
                            </span>
                          </td>
                          <td>
                            <Link
                              className="text-link"
                              to={`/assessment?knowledge=${k.id}`}
                            >
                              诊断
                              <ArrowRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {!graph.nodes.some((k) => k.title.includes(query)) && (
                <div className="small-empty">没有匹配的知识点。</div>
              )}
            </div>
          </section>
          <Notice>
            未作答知识点采用 15%
            的模型先验，不代表真实掌握度。同一道题距上次计分不足 24
            小时的重做只保留练习记录；仅学习或停留不会被算作掌握证据。
          </Notice>
        </>
      )}
      {tab === 1 && (
        <>
          <div className="forecast-layout">
            <section className="panel forecast-settings">
              <div className="panel-title">
                <h2>
                  <SlidersHorizontal size={19} />
                  探索一个学习情景
                </h2>
              </div>
              <label>
                预测知识点
                <select
                  aria-label="预测知识点"
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
                计划额外学习时间 <strong>{minutes} 分钟</strong>
                <input
                  disabled={busy}
                  aria-label="计划额外学习时间"
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
              <label>
                距测验还有多久 <strong>{days} 天</strong>
                <input
                  disabled={busy}
                  aria-label="距测验还有多久"
                  type="range"
                  min="0"
                  max="30"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <button
                className="button primary wide"
                disabled={busy}
                onClick={() => void predict()}
              >
                {busy ? (
                  <Busy />
                ) : (
                  <>
                    <FlaskConical size={17} />
                    计算情景预测
                  </>
                )}
              </button>
              {forecastError && (
                <div role="alert">
                  <Notice>{forecastError}，请重试。</Notice>
                </div>
              )}
              <p className="field-help">
                调整参数不会修改你的学习记录。预测目标是下一次测验答对的概率，并非真实知识状态标签。
              </p>
            </section>
            <section className="panel forecast-result">
              {forecast ? (
                <>
                  {scenarioChanged && (
                    <div className="scenario-stale" role="status">
                      参数已调整，下方仍是上次计算结果。点击“计算情景预测”更新对比。
                    </div>
                  )}
                  <div className="panel-title">
                    <span className="tag">{forecast.knowledge.title}</span>
                    <span
                      className={`pill ${forecast.source === "rule-fallback" ? "orange" : "blue"}`}
                    >
                      {forecast.source === "rule-fallback"
                        ? "规则回退"
                        : "校准集成模型"}
                    </span>
                  </div>
                  <span className="result-label">该情景下的估计答对概率</span>
                  <div className="forecast-number">
                    {(forecast.probability * 100).toFixed(1)}%
                  </div>
                  <div
                    className="forecast-comparison"
                    aria-label="额外学习情景对比"
                  >
                    <div>
                      <span>不额外学习 · 同为 {scenario.days} 天后</span>
                      <strong>
                        {(forecast.baselineProbability * 100).toFixed(1)}%
                      </strong>
                      <div className="bar">
                        <span
                          style={{
                            width: percent(forecast.baselineProbability),
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <span>额外学习 {scenario.minutes} 分钟</span>
                      <strong>
                        {forecast.difference > 0 ? "+" : ""}
                        {(forecast.difference * 100).toFixed(1)}
                        <small> 个百分点</small>
                      </strong>
                      <div className="bar">
                        <span
                          style={{ width: percent(forecast.probability) }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="field-help">{forecast.comparisonNotice}</p>
                  <p className="forecast-context">
                    当前掌握度估计 {percent(forecast.current.value)} ·{" "}
                    {forecast.current.evidenceAttempts} 次计分证据 · 计划学习{" "}
                    {scenario.minutes} 分钟，{scenario.days} 天后测验
                  </p>
                  <div className="factor-list">
                    {forecast.factors.map((f) => (
                      <div key={f.label}>
                        <span>{f.label}</span>
                        <strong>{f.value}</strong>
                      </div>
                    ))}
                  </div>
                  {forecast.modelSpread.length > 0 && (
                    <>
                      <h3 className="small-heading">各基模型输出</h3>
                      {forecast.modelSpread.map((m) => (
                        <div className="model-probability" key={m.name}>
                          <span>{m.name}</span>
                          <div className="bar">
                            <span style={{ width: percent(m.probability) }} />
                          </div>
                          <strong>{percent(m.probability)}</strong>
                        </div>
                      ))}
                    </>
                  )}
                  <Notice>{forecast.notice}</Notice>
                </>
              ) : (
                <div className="forecast-placeholder">
                  <span className="big-soft-icon">
                    <TrendingUp size={40} />
                  </span>
                  <h2>如果换一种学习安排？</h2>
                  <p>
                    选择知识点、学习时间与间隔，
                    <br />
                    观察模型在这个情景下的输出。
                  </p>
                  <span>预测服务不可用时会明确显示规则回退</span>
                </div>
              )}
            </section>
          </div>
          <Notice>
            情景参数基于合成数据中的关联生成；增加学习时间不构成真实效果的因果保证。输入摘要与基模型输出用于理解结果，模型分歧不等于置信区间。
          </Notice>
        </>
      )}
      {tab === 2 && (
        <>
          {metricError && (
            <Notice>
              {metricError}{" "}
              <button
                className="text-link"
                onClick={() => setMetricsRetry((v) => v + 1)}
              >
                重新读取
              </button>
            </Notice>
          )}
          {!metrics && !metricError && (
            <div className="loading">
              <Busy text="读取模型评估…" />
            </div>
          )}
          {metrics && (
            <>
              <Notice>{metrics.notice}</Notice>
              {!metrics.available && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setMetrics(undefined);
                    setMetricsRetry((v) => v + 1);
                  }}
                >
                  重新连接模型服务
                </button>
              )}
              {metrics.available && metrics.models && metrics.split && (
                <>
                  <div className="experiment-stats">
                    {[
                      [
                        "训练",
                        metrics.split.trainLearners,
                        metrics.split.trainSamples,
                      ],
                      [
                        "校准",
                        metrics.split.calibrationLearners,
                        metrics.split.calibrationSamples,
                      ],
                      [
                        "测试",
                        metrics.split.testLearners,
                        metrics.split.testSamples,
                      ],
                    ].map(([label, learners, samples]) => (
                      <article className="panel" key={label}>
                        <span>{label}集</span>
                        <strong>
                          {Number(samples).toLocaleString()}
                          <small> 条样本</small>
                        </strong>
                        <p>{learners} 位合成学习者 · 集间学习者不重叠</p>
                      </article>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>独立学习者测试集表现</h2>
                        <p>目标：下一次测验是否答对 · 固定种子 2026</p>
                      </div>
                      <span className="pill blue">{metrics.version}</span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>模型</th>
                            <th>AUC ↑</th>
                            <th>Brier ↓</th>
                            <th>RMSE ↓</th>
                            <th>准确率</th>
                            <th>ECE ↓</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(metrics.models).map(([name, s]) => (
                            <tr
                              key={name}
                              className={
                                name === "Calibrated ensemble"
                                  ? "highlight-row"
                                  : ""
                              }
                            >
                              <td>
                                <strong>{name}</strong>
                              </td>
                              <td>{s.auc.toFixed(4)}</td>
                              <td>{s.brier.toFixed(4)}</td>
                              <td>{s.rmse.toFixed(4)}</td>
                              <td>{percent(s.accuracy)}</td>
                              <td>{s.ece.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <div className="analysis-top">
                    <section className="panel">
                      <div className="panel-title">
                        <div>
                          <h2>预测概率是否可靠？</h2>
                          <p>校准曲线越接近对角线，分组预测越接近观测频率</p>
                        </div>
                      </div>
                      <Chart
                        label="集成模型概率校准图"
                        option={{
                          tooltip: { trigger: "axis" },
                          grid: { top: 20, left: 45, right: 25, bottom: 38 },
                          xAxis: {
                            type: "value",
                            min: 0,
                            max: 1,
                            name: "预测概率",
                            nameLocation: "middle",
                            nameGap: 26,
                            splitLine: { lineStyle: { color: "#f0f2f6" } },
                          },
                          yAxis: {
                            type: "value",
                            min: 0,
                            max: 1,
                            name: "实际答对比例",
                            splitLine: { lineStyle: { color: "#f0f2f6" } },
                          },
                          series: [
                            {
                              type: "line",
                              data: [
                                [0, 0],
                                [1, 1],
                              ],
                              symbol: "none",
                              lineStyle: { color: "#a4afc2", type: "dashed" },
                            },
                            {
                              type: "line",
                              data: metrics.models[
                                "Calibrated ensemble"
                              ].calibration.map((b) => [
                                b.predicted,
                                b.observed,
                              ]),
                              symbolSize: 8,
                              lineStyle: { color: "#4d7cfe", width: 3 },
                              itemStyle: { color: "#4d7cfe" },
                            },
                          ],
                        }}
                      />
                    </section>
                    <section className="panel">
                      <div className="panel-title">
                        <div>
                          <h2>时间向后验证</h2>
                          <p>同一学习者后两次作答完全保留，不进入训练</p>
                        </div>
                      </div>
                      {metrics.temporal && (
                        <div className="temporal-metrics">
                          <div>
                            <span>AUC</span>
                            <strong>{metrics.temporal.auc}</strong>
                          </div>
                          <div>
                            <span>Brier</span>
                            <strong>{metrics.temporal.brier}</strong>
                          </div>
                          <div>
                            <span>测试样本</span>
                            <strong>{metrics.temporal.samples}</strong>
                          </div>
                        </div>
                      )}
                      <p className="method-copy">
                        所有特征都在该次答案出现之前形成。未来答案不能进入历史正确率、掌握度或累计次数。
                      </p>
                      <p className="method-copy">
                        逻辑回归是对照基线；集成模型不一定优于基线。页面保留全部实测结果，避免只展示最好的一项指标。
                      </p>
                      <Link className="text-link" to="/about">
                        查看方法与复现说明
                        <ArrowRight size={14} />
                      </Link>
                    </section>
                  </div>
                </>
              )}
              {!metrics.available && (
                <div className="panel small-empty">
                  可继续使用知识分析与路径规划，预测会明确回退到规则方法。
                </div>
              )}
            </>
          )}
        </>
      )}
      {tab === 3 && (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>选择要比较的知识点</h2>
                <p>最多 5 个，观察知识特征与学习证据的差异</p>
              </div>
              <span className="pill blue">已选 {selected.length}/5</span>
            </div>
            <div className="compare-options">
              {graph.nodes.map((k) => (
                <label
                  key={k.id}
                  className={selected.includes(k.id) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(k.id)}
                    disabled={!selected.includes(k.id) && selected.length >= 5}
                    onChange={() =>
                      setSelected(
                        selected.includes(k.id)
                          ? selected.filter((id) => id !== k.id)
                          : [...selected, k.id],
                      )
                    }
                  />
                  {k.title}
                </label>
              ))}
            </div>
          </section>
          {selected.length > 0 && (
            <>
              <section className="panel">
                <Chart
                  label="选中知识点的多维度对比雷达图"
                  height={350}
                  option={{
                    color: [
                      "#4d7cfe",
                      "#26a78a",
                      "#e6a547",
                      "#a377dc",
                      "#ef7895",
                    ],
                    tooltip: {},
                    legend: {
                      bottom: 0,
                      data: selected.map(
                        (id) => graph.nodes.find((k) => k.id === id)!.title,
                      ),
                    },
                    radar: {
                      radius: "65%",
                      indicator: [
                        "掌握度估计",
                        "难度",
                        "重要性",
                        "前置基础",
                        "测验证据量",
                      ].map((name) => ({ name, max: 1 })),
                      axisName: { color: "#73809a" },
                      splitArea: {
                        areaStyle: { color: ["#fafbfe", "#f3f6fd"] },
                      },
                    },
                    series: [
                      {
                        type: "radar",
                        data: selected.map((id) => {
                          const k = graph.nodes.find((k) => k.id === id)!;
                          const parents = graph.edges.filter(
                            (e) => e.target === id && e.type === "PREREQUISITE",
                          );
                          return {
                            name: k.title,
                            value: [
                              graph.mastery[id].value,
                              k.difficulty / 10,
                              k.importance,
                              parents.length
                                ? parents.reduce(
                                    (sum, e) =>
                                      sum + graph.mastery[e.source].value,
                                    0,
                                  ) / parents.length
                                : 1,
                              Math.min(
                                1,
                                graph.mastery[id].evidenceAttempts / 20,
                              ),
                            ],
                            areaStyle: { opacity: 0.06 },
                          };
                        }),
                      },
                    ],
                  }}
                />
              </section>
              <Notice>
                雷达图将各项归一化到 0–1。难度越高代表任务越复杂；“证据量”以 20
                次计分证据为显示上限，并不表示测验质量或统计独立性。
              </Notice>
            </>
          )}
          {!selected.length && (
            <Notice>至少选择一个知识点即可查看对比。</Notice>
          )}
        </>
      )}
    </>
  );
}
