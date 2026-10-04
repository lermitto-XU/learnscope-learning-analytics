import { useEffect, useRef } from "react";
import { ArrowUpRight, LoaderCircle, Info, Network } from "lucide-react";
import { Link } from "react-router-dom";
import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import type { Knowledge, Mastery } from "./types";
import { percent } from "./api";

export function Chart({
  option,
  height = 260,
  label,
}: {
  option: EChartsOption;
  height?: number;
  label: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<EChartsType | null>(null);
  const current = useRef(option);
  current.current = option;
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void import("./chart-engine").then((echarts) => {
      if (cancelled || !element.current) return;
      const chart = echarts.init(element.current);
      instance.current = chart;
      chart.setOption(current.current);
      observer = new ResizeObserver(() => instance.current?.resize());
      observer.observe(element.current);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    instance.current?.setOption(option, true);
  }, [option]);
  return (
    <div
      ref={element}
      role="img"
      aria-label={label}
      style={{ height, width: "100%" }}
    />
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice">
      <Info size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <Network size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Busy({ text = "计算中…" }: { text?: string }) {
  return (
    <>
      <LoaderCircle size={16} className="spin" />
      {text}
    </>
  );
}
export function MasteryBar({ mastery }: { mastery: Mastery }) {
  return (
    <div className="mastery-bar">
      <div className="bar">
        <span
          style={{ width: percent(mastery.value), background: color(mastery) }}
        />
      </div>
      <span
        title={
          mastery.evidenceAttempts
            ? mastery.evidence
            : "15% 为模型初始先验，尚无诊断结果"
        }
      >
        {mastery.evidenceAttempts ? percent(mastery.value) : "待诊断"}
      </span>
    </div>
  );
}
export function color(m: Mastery) {
  return m.evidenceAttempts === 0
    ? "#a3adc0"
    : m.value >= 0.8 && m.evidenceAttempts >= 5
      ? "#26a78a"
      : m.value >= 0.45
        ? "#4d7cfe"
        : "#e6a547";
}
export function status(m: Mastery) {
  return m.evidenceAttempts === 0
    ? "待诊断"
    : m.value >= 0.8 && m.evidenceAttempts >= 5
      ? "较熟练"
      : m.value >= 0.45
        ? "学习中"
        : "需巩固";
}
export function KnowledgeCard({
  knowledge,
  mastery,
  reason,
}: {
  knowledge: Knowledge;
  mastery: Mastery;
  reason?: string;
}) {
  return (
    <Link to={`/knowledge/${knowledge.id}`} className="knowledge-card">
      <div className="card-top">
        <span className="tag">{knowledge.category}</span>
        <ArrowUpRight size={18} />
      </div>
      <h3>{knowledge.title}</h3>
      <p>{reason || knowledge.description}</p>
      <MasteryBar mastery={mastery} />
      <div className="card-foot">
        <span>难度 {knowledge.difficulty}/10</span>
        <span>约 {knowledge.minutes} 分钟</span>
      </div>
    </Link>
  );
}
