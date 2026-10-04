import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "web", "package.json"));
const { chromium } = require(process.env.LEARNSCOPE_PLAYWRIGHT || "playwright");
const base = process.env.LEARNSCOPE_URL || "http://127.0.0.1:5173";
const output = path.join(root, "docs", "screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || "msedge",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1060 },
  locale: "zh-CN",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = [];
const shot = async (name) => {
  await page.locator("main h1").waitFor();
  await page.locator(".toast").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () =>
      window.innerWidth > 700 ||
      document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
  );
  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
};
try {
  await page.goto(base);
  await page.getByRole("button", { name: "体验学习者" }).click();
  await page.getByRole("heading", { name: /你好，/ }).waitFor();
  await page.locator("canvas").first().waitFor();
  await shot("01-dashboard");
  report.push("Demo login and data-driven dashboard");

  await page.getByRole("link", { name: "知识图谱", exact: true }).click();
  await page.getByRole("button", { name: /Dijkstra 最短路径，/ }).click();
  await page.getByRole("link", { name: "学习这个知识点" }).waitFor();
  await shot("02-knowledge-graph");
  await page.getByRole("button", { name: "放大", exact: true }).click();
  assert.ok(
    (await page.locator(".graph-controls").innerText()).includes("115%"),
  );
  await page.getByLabel("搜索知识点", { exact: true }).fill("不存在的概念");
  await page.getByRole("heading", { name: "没有匹配的知识点" }).waitFor();
  await page.getByLabel("搜索知识点", { exact: true }).fill("");
  report.push("Graph node selection, zoom and empty search state");

  await page.getByRole("link", { name: "路径规划", exact: true }).click();
  await page.getByRole("heading", { name: "你的学习路线已就绪" }).waitFor();
  const scheduled = await page
    .locator(".path-step")
    .evaluateAll((elements) =>
      elements.map((e) => !e.classList.contains("deferred")),
    );
  let closed = false;
  for (const value of scheduled) {
    if (!value) closed = true;
    else assert.equal(closed, false);
  }
  await shot("03-learning-path");
  report.push("Path planning and budget prefix invariant");

  await page.getByRole("link", { name: /分析与预测/ }).click();
  await page.getByRole("tab", { name: /情景预测/ }).click();
  await page.getByRole("button", { name: "计算情景预测" }).click();
  await page.locator(".forecast-number").waitFor();
  assert.ok(
    (await page.locator(".forecast-result").innerText()).includes(
      "校准集成模型",
    ),
  );
  await shot("04-prediction");
  await page.getByLabel("计划额外学习时间", { exact: true }).focus();
  await page.getByLabel("计划额外学习时间", { exact: true }).press("Home");
  await page.getByText(/参数已调整，下方仍是上次计算结果/).waitFor();
  const zeroForecastResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/predictions") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "计算情景预测" }).click();
  const zeroForecast = await (await zeroForecastResponse).json();
  assert.equal(zeroForecast.difference, 0);
  assert.equal(zeroForecast.probability, zeroForecast.baselineProbability);
  await page.waitForFunction(() => !document.querySelector(".scenario-stale"));
  await page.route("**/api/models/metrics", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "测试临时服务故障" }),
    }),
  );
  await page.getByRole("tab", { name: "模型评估" }).click();
  await page.getByRole("button", { name: "重新读取" }).waitFor();
  await page.unroute("**/api/models/metrics");
  await page.getByRole("button", { name: "重新读取" }).click();
  await page.getByText("Calibrated ensemble", { exact: true }).waitFor();
  await page.locator("canvas").first().waitFor();
  await shot("05-model-evaluation");
  report.push("Live Python forecast and reproducible model evaluation");
  report.push(
    "Zero-minute forecast comparison, stale-parameter notice and model-report retry",
  );

  await page.getByRole("button", { name: /林同学/ }).click();
  await page.getByRole("button", { name: "还没有账号？创建账号" }).click();
  await page
    .getByLabel("用户名", { exact: true })
    .fill(`e2e_${Date.now().toString(36)}`);
  await page.getByLabel("显示名称", { exact: true }).fill("新同学");
  await page.getByLabel("密码", { exact: true }).fill("LearnScopeE2E2026!");
  await page.getByRole("button", { name: "注册并进入", exact: true }).click();
  await page.getByRole("heading", { name: /你好，新同学/ }).waitFor();
  const coldGraph = await (
    await context.request.get(`${base}/api/graph`)
  ).json();
  assert.ok(
    Object.values(coldGraph.mastery).every(
      (m) => m.attempts === 0 && m.evidenceAttempts === 0,
    ),
  );
  report.push("New learner registration and empty diagnostic evidence");
  await page.getByRole("link", { name: "诊断测验", exact: true }).click();
  await page.getByLabel("选择诊断知识点", { exact: true }).selectOption("15");
  await page.getByRole("button", { name: "开始诊断", exact: true }).click();
  await page.locator(".quiz-question").first().waitFor();
  assert.equal(await page.locator(".quiz-question").count(), 3);
  for (const question of await page.locator(".quiz-question").all())
    await question.getByRole("radio").first().check();
  const firstSubmitResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/assessments/submit"),
  );
  await page.getByRole("button", { name: "提交并查看分析" }).click();
  const firstResult = await (await firstSubmitResponse).json();
  assert.equal(firstResult.evidenceAdded, 3);
  assert.equal(firstResult.mastery.attempts, 3);
  await page.locator(".quiz-result-banner").waitFor();
  assert.ok(
    (await page.locator(".quiz-result-banner").innerText()).includes(
      "答对 3/3",
    ),
  );
  await shot("06-assessment-feedback");
  await page.getByRole("button", { name: "再做一次诊断", exact: true }).click();
  await page.locator(".quiz-question").first().waitFor();
  for (const question of await page.locator(".quiz-question").all())
    await question.getByRole("radio").first().check();
  const repeatedResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/assessments/submit"),
  );
  await page.getByRole("button", { name: "提交并查看分析" }).click();
  const repeated = await (await repeatedResponse).json();
  assert.equal(repeated.evidenceAdded, 0);
  assert.equal(repeated.repeatedAnswers, 3);
  assert.equal(
    repeated.mastery.evidenceAttempts,
    firstResult.mastery.evidenceAttempts,
  );
  assert.equal(repeated.mastery.attempts, firstResult.mastery.attempts + 3);
  assert.ok(
    Math.abs(repeated.mastery.value - firstResult.mastery.value) <= 0.0001,
  );
  await page
    .getByRole("heading", { name: "练习已记录，继续巩固理解" })
    .waitFor();
  await shot("09-repeated-practice");
  report.push(
    "Repeated quiz keeps practice history without adding mastery evidence",
  );
  await page.getByRole("link", { name: "按最新证据重新规划" }).click();
  await page.getByRole("heading", { name: "你的学习路线已就绪" }).waitFor();
  report.push(
    "Assessment grading, explanations and feedback into path planning",
  );

  await page.getByRole("button", { name: /新同学/ }).click();
  await page.getByRole("button", { name: "体验教师" }).click();
  await page.getByRole("link", { name: "知识库管理", exact: true }).click();
  await page.getByLabel("源知识点", { exact: true }).selectOption("16");
  await page.getByLabel("目标知识点", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "保存关系", exact: true }).click();
  await page.getByText("该关系会产生循环依赖，已拒绝保存").waitFor();
  report.push("Teacher graph editor rejects cyclic prerequisites");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("link", { name: "学习总览", exact: true }).click();
  await page.getByRole("heading", { name: /你好，/ }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await shot("07-mobile-dashboard");
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("link", { name: "知识图谱", exact: true }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await shot("08-mobile-graph");
  report.push(
    "390px responsive dashboard and graph without horizontal overflow",
  );
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("link", { name: /分析与预测/ }).click();
  await page.getByRole("tab", { name: /情景预测/ }).click();
  await page.getByRole("button", { name: "计算情景预测" }).click();
  await page.locator(".forecast-comparison").waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await shot("10-mobile-prediction");
  report.push("390px forecast baseline comparison without horizontal overflow");
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(root, ".local", "browser-report.json"),
    JSON.stringify({ passed: report, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: report, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
