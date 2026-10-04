# 核心接口

浏览器通过同源 `/api` 请求业务服务。登录响应返回用户摘要与 CSRF 令牌，并设置 HttpOnly 会话 Cookie；之后写请求携带 `X-CSRF-Token`。不使用 localStorage 保存会话令牌。

| 方法与路径 | 输入或用途 | 权限 |
| --- | --- | --- |
| `GET /api/health` | 服务状态与演示模式开关 | 公开 |
| `POST /api/auth/login` | `username`、`password` | 公开，JSON |
| `POST /api/auth/register` | `username`、`displayName`、`password` | 公开，仅注册学习者 |
| `GET /api/auth/me` | 用户和 CSRF 令牌 | 当前会话 |
| `POST /api/auth/logout` | 清除当前会话 | 当前会话与 CSRF |
| `GET /api/graph` | 节点、边、当前用户掌握度 | 登录用户 |
| `GET /api/overview` | 统计、趋势与学习推荐 | 当前用户 |
| `GET /api/knowledge/{id}` | 课程详情与个人证据 | 当前用户 |
| `POST /api/study` | `knowledgeId`、`seconds`（10–1800） | 当前用户 |
| `POST /api/paths` | `targetId`、`budgetMinutes`（10–480）、`threshold`（0.6–0.95） | 当前用户 |
| `POST /api/predictions` | `knowledgeId`、`plannedMinutes`（0–180）、`horizonDays`（0–30） | 当前用户 |
| `GET /api/models/metrics` | 预测服务提供的模型实测报告 | 登录用户 |
| `POST /api/assessments` | `knowledgeId`，创建 1 小时有效的测验 | 当前用户 |
| `POST /api/assessments/submit` | `assessmentId`、按题序的 `answers` 选项索引 | 测验所有者；幂等 |
| `GET /api/records` | 个人学习记录 | 当前用户 |
| `GET /api/records/export` | 个人记录与掌握度 JSON | 当前用户 |
| `POST /api/knowledge` | 标题、领域、描述、难度、时间、正文 | 教师或管理员 |
| `PUT /api/knowledge/{id}` | 标题、领域、描述、难度、时间、`version` | 教师或管理员；乐观锁 |
| `POST /api/relations` | `source`、`target`、`type`、`weight` | 教师或管理员；循环检查 |
| `DELETE /api/relations/{id}` | 删除指定关系 | 教师或管理员 |
| `GET /api/management` | 内容统计与编辑审计摘要 | 教师或管理员 |

错误体为 `{"message":"说明"}`。常见状态为 400 输入不合法、401 会话无效、403 权限或 CSRF 失败、404 对象不存在或不属于当前用户、409 重复或版本冲突、410 测验过期、422 依赖图成环或题库不足、429 登录失败次数超限。

预测调用只接受知识点与情景参数，其他特征由服务端从当前会话数据中生成，避免伪造其他用户的学习状态。

`Mastery` 中 `attempts/correct` 是全部作答与答对次数；`evidenceAttempts/evidenceCorrect` 是参与 BKT 的计分次数；`legacyAttempts` 是缺少可追溯题号的历史计分数。`daysSince` 从最后计分作答计算，阅读和同题 24 小时内重做不会重置。`lower/upper` 为计分证据正确比例的 Wilson 区间。

提交测验还返回 `evidenceAdded` 与 `repeatedAnswers`，分别说明此次新增计分量和仅记录练习的重复量。同一 assessment ID 仍幂等返回原结果；不同 assessment ID 也按题号与 24 小时间隔去重计分。

升级前已完成测验的缓存响应会补齐新字段，设置 `historicalResult=true`，证据数量按旧快照解释。查看历史结果不会重算旧掌握度、插入事件或改写原缓存。

情景预测新增 `baselineProbability`（同一测验间隔、额外学习 0 分钟）、`difference`（情景概率减基准概率）、`baselineSource` 与 `comparisonNotice`。差值以 0–1 表示，界面乘 100 后显示百分点。两种情景来自同一模型或统一规则回退；差值可为负，不解释为因果效果。

内部 Python 服务提供 `/health`、`/metrics`、`/predict` 和 `/predict/batch`；容器环境除健康接口外使用 `X-Predictor-Key`。该服务没有公网端口映射、模型上传或在线训练入口。
