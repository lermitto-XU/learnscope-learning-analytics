package io.learnscope;

import static io.learnscope.Domain.*;

import java.sql.Statement;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class Store {
  private final JdbcTemplate db;

  public Store(JdbcTemplate db) {
    this.db = db;
  }

  public JdbcTemplate jdbc() {
    return db;
  }

  public List<Knowledge> knowledge() {
    return db.query(
        "SELECT * FROM knowledge ORDER BY id",
        (r, n) ->
            new Knowledge(
                r.getLong("id"),
                r.getString("title"),
                r.getString("category"),
                r.getString("description"),
                r.getInt("difficulty"),
                r.getInt("minutes"),
                r.getDouble("importance"),
                r.getDouble("x"),
                r.getDouble("y"),
                r.getString("content"),
                r.getInt("version")));
  }

  public Knowledge knowledge(long id) {
    return knowledge().stream()
        .filter(k -> k.id() == id)
        .findFirst()
        .orElseThrow(() -> new ApiException(404, "知识点不存在"));
  }

  public List<Relation> relations() {
    return db.query(
        "SELECT * FROM relations ORDER BY id",
        (r, n) ->
            new Relation(
                r.getLong("id"),
                r.getLong("source_id"),
                r.getLong("target_id"),
                r.getString("type"),
                r.getDouble("weight")));
  }

  public List<Map<String, Object>> events(long userId) {
    return db.query(
        "SELECT e.*, k.title, eq.question_id FROM learning_events e JOIN knowledge k ON"
            + " k.id=e.knowledge_id LEFT JOIN learning_event_questions eq ON eq.event_id=e.id WHERE"
            + " e.user_id=? ORDER BY e.created_at, e.id",
        (r, n) ->
            Map.<String, Object>of(
                "id",
                r.getLong("id"),
                "knowledgeId",
                r.getLong("knowledge_id"),
                "kind",
                r.getString("kind"),
                "seconds",
                r.getInt("seconds"),
                "correct",
                r.getInt("correct"),
                "total",
                r.getInt("total"),
                "createdAt",
                r.getLong("created_at"),
                "title",
                r.getString("title"),
                "questionId",
                r.getLong("question_id")),
        userId);
  }

  public void event(
      long userId,
      long knowledgeId,
      String kind,
      int seconds,
      int correct,
      int total,
      long timestamp) {
    db.update(
        "INSERT INTO learning_events(user_id,knowledge_id,kind,seconds,correct,total,created_at)"
            + " VALUES(?,?,?,?,?,?,?)",
        userId,
        knowledgeId,
        kind,
        seconds,
        correct,
        total,
        timestamp);
  }

  @Transactional
  public void questionEvent(
      long userId, long knowledgeId, long questionId, boolean correct, long timestamp) {
    var key = new GeneratedKeyHolder();
    db.update(
        connection -> {
          var statement =
              connection.prepareStatement(
                  "INSERT INTO"
                      + " learning_events(user_id,knowledge_id,kind,seconds,correct,total,created_at)"
                      + " VALUES(?,?,'QUIZ',0,?,1,?)",
                  Statement.RETURN_GENERATED_KEYS);
          statement.setLong(1, userId);
          statement.setLong(2, knowledgeId);
          statement.setInt(3, correct ? 1 : 0);
          statement.setLong(4, timestamp);
          return statement;
        },
        key);
    db.update(
        "INSERT INTO learning_event_questions(event_id,question_id) VALUES(?,?)",
        Objects.requireNonNull(key.getKey()).longValue(),
        questionId);
  }

  public void audit(long userId, String action, String detail) {
    db.update(
        "INSERT INTO audit_log(user_id,action,detail,created_at) VALUES(?,?,?,?)",
        userId,
        action,
        detail,
        System.currentTimeMillis());
  }
}
