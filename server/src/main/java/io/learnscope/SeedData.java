package io.learnscope;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SeedData implements ApplicationRunner {
  private final Store store;
  private final AuthService auth;
  private final ObjectMapper json;
  private final boolean demo;
  private final String demoPassword;
  private final String adminPassword;

  public SeedData(
      Store store,
      AuthService auth,
      ObjectMapper json,
      @Value("${app.demo}") boolean demo,
      @Value("${app.demo-password}") String demoPassword,
      @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String adminPassword) {
    this.store = store;
    this.auth = auth;
    this.json = json;
    this.demo = demo;
    this.demoPassword = demoPassword;
    this.adminPassword = adminPassword;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) throws Exception {
    if (store.jdbc().queryForObject("SELECT COUNT(*) FROM knowledge", Integer.class) == 0) {
      var seed = json.readTree(new ClassPathResource("seed.json").getInputStream());
      for (var k : seed.get("knowledge"))
        store
            .jdbc()
            .update(
                "INSERT INTO"
                    + " knowledge(id,title,category,description,difficulty,minutes,importance,x,y,content)"
                    + " VALUES(?,?,?,?,?,?,?,?,?,?)",
                k.get("id").asLong(),
                k.get("title").asText(),
                k.get("category").asText(),
                k.get("description").asText(),
                k.get("difficulty").asInt(),
                k.get("minutes").asInt(),
                k.get("importance").asDouble(),
                k.get("x").asDouble(),
                k.get("y").asDouble(),
                k.get("content").asText());
      for (var r : seed.get("relations"))
        store
            .jdbc()
            .update(
                "INSERT INTO relations(source_id,target_id,type,weight) VALUES(?,?,?,?)",
                r.get("source").asLong(),
                r.get("target").asLong(),
                r.get("type").asText(),
                r.get("weight").asDouble());
      for (var q : seed.get("questions"))
        store
            .jdbc()
            .update(
                "INSERT INTO questions(knowledge_id,prompt,options,answer,explanation,difficulty)"
                    + " VALUES(?,?,?,?,?,?)",
                q.get("knowledgeId").asLong(),
                q.get("prompt").asText(),
                json.writeValueAsString(q.get("options")),
                q.get("answer").asInt(),
                q.get("explanation").asText(),
                q.get("difficulty").asInt());
    }
    if (store.jdbc().queryForObject("SELECT COUNT(*) FROM users", Integer.class) > 0) return;
    if (!demo) {
      if (adminPassword.length() < 12)
        throw new IllegalStateException(
            "DEMO_MODE=false requires BOOTSTRAP_ADMIN_PASSWORD with at least 12 characters");
      store
          .jdbc()
          .update(
              "INSERT INTO users(username,display_name,password_hash,role,created_at)"
                  + " VALUES(?,?,?,?,?)",
              "admin",
              "管理员",
              auth.hashPassword(adminPassword),
              "ADMIN",
              System.currentTimeMillis());
      return;
    }
    for (var account :
        List.of(
            new String[] {"student", "林同学", "STUDENT"},
            new String[] {"teacher", "陈老师", "TEACHER"},
            new String[] {"admin", "管理员", "ADMIN"})) {
      store
          .jdbc()
          .update(
              "INSERT INTO users(username,display_name,password_hash,role,created_at)"
                  + " VALUES(?,?,?,?,?)",
              account[0],
              account[1],
              auth.hashPassword(demoPassword),
              account[2],
              System.currentTimeMillis());
    }
    long student =
        store.jdbc().queryForObject("SELECT id FROM users WHERE username='student'", Long.class);
    Random rng = new Random(2026);
    long now = System.currentTimeMillis();
    for (int day = 27; day >= 0; day--) {
      if (day % 6 == 0) continue;
      long k = 1 + (27 - day) % 11;
      long time = now - day * 86_400_000L - 3_600_000;
      store.event(student, k, "STUDY", (12 + rng.nextInt(24)) * 60, 0, 0, time);
      var questionIds =
          store
              .jdbc()
              .queryForList(
                  "SELECT id FROM questions WHERE knowledge_id=? ORDER BY id LIMIT 3",
                  Long.class,
                  k);
      for (int q = 0; q < 3; q++)
        store.questionEvent(
            student,
            k,
            questionIds.get(q),
            k <= 5 || rng.nextDouble() > .38,
            time + q * 1000 + 60000);
    }
    // Initial data are reproducible synthetic learner histories, not real personal data.
    for (long k = 1; k <= 4; k++) {
      var questionIds =
          store
              .jdbc()
              .queryForList(
                  "SELECT id FROM questions WHERE knowledge_id=? ORDER BY id LIMIT 3",
                  Long.class,
                  k);
      for (int q = 0; q < 6; q++)
        store.questionEvent(
            student,
            k,
            questionIds.get(q % 3),
            true,
            now - (2 - q / 3) * 86_400_000L - 120_000 + (q % 3) * 1000);
    }
  }
}
