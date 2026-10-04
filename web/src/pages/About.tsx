import { Link } from "react-router-dom";
import {
  Network,
  Route,
  ChartNoAxesCombined,
  ClipboardCheck,
  ArrowRight,
  Check,
  FlaskConical,
} from "lucide-react";
import { PageTitle, Notice } from "../components";

export default function About() {
  return (
    <>
      <PageTitle
        eyebrow="PROJECT NOTES"
        title="从论文复现，到可验证的学习系统"
        description="在线学习服务中知识分析预测系统设计与实现 · 核心功能复现与方法改进"
      />
      <section className="panel about-intro">
        <span className="big-soft-icon">
          <FlaskConical size={33} />
        </span>
        <div>
          <h2>知序 LearnScope</h2>
          <p>
            围绕知识结构、学习证据与下一步决策，建立一个可以实际运行、检查和复现的学习分析闭环。课程内容、题库与演示代码均为本项目重新实现。
          </p>
          <div className="tech-tags">
            {[
              "React + TypeScript",
              "Spring Boot + Java 21",
              "Python + scikit-learn",
              "MySQL / H2",
              "ECharts",
            ].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>四个模块，一条反馈闭环</h2>
      </div>
      <div className="about-flow">
        {[
          [Network, "知识图谱", "建模知识点和三类关系，提供依赖结构。"],
          [
            ChartNoAxesCombined,
            "掌握度分析",
            "根据真实作答更新估计，区分证据与先验。",
          ],
          [Route, "路径规划", "遵守先修约束，按当前状态与时间安排学习。"],
          [
            ClipboardCheck,
            "测验反馈",
            "服务端判分与持久化，让新证据返回分析。",
          ],
        ].map(([Icon, name, description], i) => {
          const Component = Icon as typeof Network;
          return (
            <article className="panel" key={i}>
              <Component size={23} />
              <span>0{i + 1}</span>
              <h3>{String(name)}</h3>
              <p>{String(description)}</p>
            </article>
          );
        })}
      </div>
      <section className="panel about-method">
        <h2>关键改进与取舍</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>论文中的方案</th>
                <th>本项目的实现</th>
                <th>为什么这样做</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DFS 路径生成与难度重排</td>
                <td>先修闭包、Kahn 拓扑排序、就绪集合优先级</td>
                <td>保持全部先修约束；明确不保证全局最短。</td>
              </tr>
              <tr>
                <td>掌握度预测的合成标签</td>
                <td>BKT 状态估计 + 下一次答对概率预测</td>
                <td>学习时间不等于真实掌握，答对标签更可观测。</td>
              </tr>
              <tr>
                <td>随机切分训练与测试</td>
                <td>学习者隔离、独立校准集、时间向后验证</td>
                <td>防止学习者重复和未来作答造成泄漏。</td>
              </tr>
              <tr>
                <td>JWT 存入 localStorage、开发模式鉴权</td>
                <td>HttpOnly 会话 Cookie、CSRF 校验、服务端角色约束</td>
                <td>后端验证用户与数据归属；不在本地存储访问令牌。</td>
              </tr>
              <tr>
                <td>宽泛置信度评分</td>
                <td>24 小时同题去重、计分证据 Wilson 区间、基模型分歧</td>
                <td>
                  分别解释证据不足与模型差异，不伪称已校准的掌握度置信区间。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div className="about-bottom">
        <section className="panel">
          <h2>复现范围</h2>
          <p>
            保留知识图谱、分析预测、路径规划、可视化和支持它们的诊断测验。教师可维护知识内容和关系，关系写入时拒绝循环依赖。
          </p>
          <p>
            按项目范围要求，未加入笔记、计划、成就等外围功能，便于作品集聚焦算法和数据闭环。
          </p>
          <Link className="text-link" to="/analysis">
            查看实测模型指标
            <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <h2>如何检查这个系统</h2>
          <ul className="check-list">
            <li>
              <Check size={16} />
              新建账号，观察无测验证据时的冷启动
            </li>
            <li>
              <Check size={16} />
              完成测验，观察掌握度和路径变化
            </li>
            <li>
              <Check size={16} />
              使用教师账号，尝试保存循环先修关系
            </li>
            <li>
              <Check size={16} />
              关闭预测服务，观察明确标记的规则回退
            </li>
          </ul>
        </section>
      </div>
      <Notice>
        参考来源：许圣昊《在线学习服务中知识分析预测系统设计与实现》（2025）。本项目没有原始源码、训练集或部署环境，属于依据论文的独立复现。演示评估不能替代真实数据验证，也不继承论文中的性能或准确率结论。
      </Notice>
    </>
  );
}
