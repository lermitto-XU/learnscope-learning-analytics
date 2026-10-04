package io.learnscope;

import static io.learnscope.Domain.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LearningService {
  private final Store store;
  private final MasteryService mastery;
  private final ObjectMapper json;

  public LearningService(Store store, MasteryService mastery, ObjectMapper json) {
    this.store = store;
    this.mastery = mastery;
    this.json = json;
  }

  public Map<String, Object> overview(long userId) {
    var states = mastery.all(userId);
    var events = store.events(userId);
    long seconds = events.stream().mapToLong(e -> ((Number) e.get("seconds")).longValue()).sum();
    int total = events.stream().mapToInt(e -> ((Number) e.get("total")).intValue()).sum();
    int correct = events.stream().mapToInt(e -> ((Number) e.get("correct")).intValue()).sum();
    int evidenceTotal = states.values().stream().mapToInt(Mastery::evidenceAttempts).sum();
    int evidenceCorrect = states.values().stream().mapToInt(Mastery::evidenceCorrect).sum();
    var nodes = store.knowledge();
    var relations = store.relations();
    List<Map<String, Object>> recommendations = new ArrayList<>();
    for (var k : nodes) {
      var m = states.get(k.id());
      if (m.value() >= .8 && m.evidenceAttempts() >= 5) continue;
      var parents =
          relations.stream()
              .filter(r -> r.type().equals("PREREQUISITE") && r.target() == k.id())
              .map(Relation::source)
              .toList();
      boolean ready =
          parents.stream()
              .allMatch(
                  id -> states.get(id).value() >= .65 && states.get(id).evidenceAttempts() >= 3);
      if (ready)
        recommendations.add(
            Map.of(
                "knowledge",
                k,
                "mastery",
                m,
                "reason",
                m.evidenceAttempts() == 0 ? "先修条件已满足，适合开始学习" : "已具备相关基础，建议通过测验巩固"));
    }
    recommendations.sort(
        Comparator.comparingDouble(
            r ->
                ((Knowledge) r.get("knowledge")).difficulty()
                    - ((Mastery) r.get("mastery")).value() * 5));
    List<Map<String, Object>> trend = new ArrayList<>();
    long now = System.currentTimeMillis();
    for (int day = 13; day >= 0; day--) {
      long until = now - day * 86_400_000L;
      var past = mastery.calculate(nodes, events, until);
      double mean = past.values().stream().mapToDouble(Mastery::value).average().orElse(0);
      long minutes =
          events.stream()
                  .filter(
                      e -> {
                        long t = ((Number) e.get("createdAt")).longValue();
                        return t <= until && t > until - 86_400_000L;
                      })
                  .mapToLong(e -> ((Number) e.get("seconds")).longValue())
                  .sum()
              / 60;
      trend.add(
          Map.of("timestamp", until, "mastery", MasteryService.round(mean), "minutes", minutes));
    }
    return Map.of(
        "mastery",
        states,
        "stats",
        Map.of(
            "average",
            states.values().stream().mapToDouble(Mastery::value).average().orElse(0),
            "mastered",
            states.values().stream()
                .filter(m -> m.value() >= .8 && m.evidenceAttempts() >= 5)
                .count(),
            "totalKnowledge",
            nodes.size(),
            "studySeconds",
            seconds,
            "attempts",
            total,
            "accuracy",
            total == 0 ? 0 : (double) correct / total,
            "evidenceAttempts",
            evidenceTotal,
            "evidenceAccuracy",
            evidenceTotal == 0 ? 0 : (double) evidenceCorrect / evidenceTotal,
            "repeatedAttempts",
            total - evidenceTotal),
        "recommendations",
        recommendations.stream().limit(4).toList(),
        "trend",
        trend,
        "recent",
        events.reversed().stream().limit(8).toList());
  }

  @Transactional
  public Map<String, Object> startQuiz(long userId, long knowledgeId) throws Exception {
    store.knowledge(knowledgeId);
    double level = 1 + mastery.all(userId).get(knowledgeId).value() * 8;
    var questions =
        store
            .jdbc()
            .queryForList(
                "SELECT id,prompt,options,difficulty FROM questions WHERE knowledge_id=? ORDER BY"
                    + " ABS(difficulty-?),id LIMIT 3",
                knowledgeId,
                level);
    if (questions.isEmpty()) throw new ApiException(422, "此知识点暂未配置测验");
    List<Map<String, Object>> safe = new ArrayList<>();
    for (var q : questions)
      safe.add(
          Map.of(
              "id",
              q.get("id"),
              "prompt",
              q.get("prompt"),
              "options",
              json.readTree(q.get("options").toString()),
              "difficulty",
              q.get("difficulty")));
    String id = UUID.randomUUID().toString();
    store
        .jdbc()
        .update(
            "INSERT INTO assessments(id,user_id,knowledge_id,question_ids,created_at)"
                + " VALUES(?,?,?,?,?)",
            id,
            userId,
            knowledgeId,
            json.writeValueAsString(questions.stream().map(q -> q.get("id")).toList()),
            System.currentTimeMillis());
    return Map.of("id", id, "questions", safe, "knowledgeId", knowledgeId);
  }

  @Transactional
  public Object submitQuiz(long userId, QuizAnswer input) throws Exception {
    var rows =
        store
            .jdbc()
            .queryForList(
                "SELECT * FROM assessments WHERE id=? AND user_id=? FOR UPDATE",
                input.assessmentId(),
                userId);
    if (rows.isEmpty()) throw new ApiException(404, "测验不存在");
    var assessment = rows.getFirst();
    if (assessment.get("completed_at") != null) {
      var cached = json.readTree(assessment.get("result").toString());
      // Old result snapshots predate question provenance. Normalize only the response; replaying
      // an assessment must never write new events or replace its historical mastery estimate.
      if (cached instanceof ObjectNode result
          && result.get("mastery") instanceof ObjectNode state
          && !state.has("evidenceAttempts")) {
        int attempts = state.path("attempts").asInt();
        state.put("evidenceAttempts", attempts);
        state.put("evidenceCorrect", state.path("correct").asInt());
        state.put("legacyAttempts", attempts);
        state.put("evidence", state.path("evidence").asText() + "；历史快照（未追溯题目）");
        result.put("evidenceAdded", result.path("total").asInt());
        result.put("repeatedAnswers", 0);
        result.put("historicalResult", true);
      }
      return cached;
    }
    long created = ((Number) assessment.get("created_at")).longValue();
    if (System.currentTimeMillis() - created > 3_600_000)
      throw new ApiException(410, "测验已过期，请重新开始");
    var ids = json.readTree(assessment.get("question_ids").toString());
    if (ids.size() != input.answers().size()) throw new ApiException(400, "请完成全部题目");
    // Serialize evidence accounting across different assessments for the same learner.
    store.jdbc().queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, userId);
    int correct = 0;
    List<Map<String, Object>> feedback = new ArrayList<>();
    long knowledgeId = ((Number) assessment.get("knowledge_id")).longValue();
    int evidenceBefore = mastery.all(userId).get(knowledgeId).evidenceAttempts();
    long submittedAt = System.currentTimeMillis();
    for (int i = 0; i < ids.size(); i++) {
      var q = store.jdbc().queryForMap("SELECT * FROM questions WHERE id=?", ids.get(i).asLong());
      int answer = ((Number) q.get("answer")).intValue();
      var options = json.readTree(q.get("options").toString());
      Integer choice = input.answers().get(i);
      if (choice == null || choice < 0 || choice >= options.size())
        throw new ApiException(400, "答案选项无效");
      boolean ok = choice == answer;
      if (ok) correct++;
      feedback.add(
          Map.of(
              "prompt",
              q.get("prompt"),
              "correct",
              ok,
              "selected",
              choice,
              "answer",
              answer,
              "options",
              options,
              "explanation",
              q.get("explanation")));
      store.questionEvent(userId, knowledgeId, ids.get(i).asLong(), ok, submittedAt);
    }
    var after = mastery.all(userId).get(knowledgeId);
    int evidenceAdded = after.evidenceAttempts() - evidenceBefore;
    var result =
        Map.of(
            "correct",
            correct,
            "total",
            ids.size(),
            "feedback",
            feedback,
            "mastery",
            after,
            "evidenceAdded",
            evidenceAdded,
            "repeatedAnswers",
            ids.size() - evidenceAdded);
    store
        .jdbc()
        .update(
            "UPDATE assessments SET completed_at=?,result=? WHERE id=?",
            System.currentTimeMillis(),
            json.writeValueAsString(result),
            input.assessmentId());
    return result;
  }
}
