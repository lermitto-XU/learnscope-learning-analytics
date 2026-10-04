package io.learnscope;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:tests;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
      "app.predictor-url=http://127.0.0.1:1"
    })
@AutoConfigureMockMvc
@Transactional
class ApiIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired Store store;
  @Autowired MasteryService mastery;

  record Session(Cookie cookie, String csrf) {}

  Session login(String username) throws Exception {
    var response =
        mvc.perform(
                post("/api/auth/login")
                    .contentType("application/json")
                    .content(
                        "{\"username\":\"" + username + "\",\"password\":\"LearnScope2026!\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse();
    String cookie = response.getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
    assertThat(response.getHeader("Set-Cookie")).contains("HttpOnly", "SameSite=Strict");
    return new Session(
        new Cookie("learnscope_session", cookie),
        json.readTree(response.getContentAsString()).get("csrf").asText());
  }

  @Test
  void authenticationCsrfAndRoleRestrictionsAreEnforcedByServer() throws Exception {
    mvc.perform(get("/api/graph")).andExpect(status().isUnauthorized());
    Session s = login("student");
    mvc.perform(
            post("/api/paths")
                .cookie(s.cookie())
                .contentType("application/json")
                .content("{\"targetId\":16,\"budgetMinutes\":90,\"threshold\":0.8}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/paths")
                .cookie(s.cookie())
                .header("X-CSRF-Token", s.csrf())
                .header("Origin", "https://evil.example")
                .contentType("application/json")
                .content("{\"targetId\":16,\"budgetMinutes\":90,\"threshold\":0.8}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/relations")
                .cookie(s.cookie())
                .header("X-CSRF-Token", s.csrf())
                .contentType("application/json")
                .content("{\"source\":16,\"target\":1,\"type\":\"PREREQUISITE\",\"weight\":1}"))
        .andExpect(status().isForbidden());
    Session teacher = login("teacher");
    mvc.perform(
            post("/api/relations")
                .cookie(teacher.cookie())
                .header("X-CSRF-Token", teacher.csrf())
                .contentType("application/json")
                .content("{\"source\":16,\"target\":1,\"type\":\"PREREQUISITE\",\"weight\":1}"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void quizDoesNotLeakAnswersIsOwnedAndIsIdempotent() throws Exception {
    Session student = login("student");
    var started =
        mvc.perform(
                post("/api/assessments")
                    .cookie(student.cookie())
                    .header("X-CSRF-Token", student.csrf())
                    .contentType("application/json")
                    .content("{\"knowledgeId\":15}"))
            .andExpect(status().isOk())
            .andReturn();
    var quiz = json.readTree(started.getResponse().getContentAsString());
    assertThat(quiz.get("questions").get(0).has("answer")).isFalse();
    long before = store.events(1).size();
    String body = "{\"assessmentId\":\"" + quiz.get("id").asText() + "\",\"answers\":[0,0,0]}";
    Session teacher = login("teacher");
    mvc.perform(
            post("/api/assessments/submit")
                .cookie(teacher.cookie())
                .header("X-CSRF-Token", teacher.csrf())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/assessments/submit")
                .cookie(student.cookie())
                .header("X-CSRF-Token", student.csrf())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.correct").value(3))
        .andExpect(jsonPath("$.evidenceAdded").value(3))
        .andExpect(jsonPath("$.repeatedAnswers").value(0))
        .andExpect(jsonPath("$.historicalResult").doesNotExist());
    assertThat(store.events(1).size()).isEqualTo(before + 3);
    mvc.perform(
            post("/api/assessments/submit")
                .cookie(student.cookie())
                .header("X-CSRF-Token", student.csrf())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.historicalResult").doesNotExist());
    assertThat(store.events(1).size()).isEqualTo(before + 3);
    mvc.perform(get("/api/records").cookie(teacher.cookie())).andExpect(content().json("[]"));
  }

  @Test
  void completedLegacyAssessmentIsNormalizedWithoutReplayingItsEvents() throws Exception {
    Session student = login("student");
    var started =
        mvc.perform(
                post("/api/assessments")
                    .cookie(student.cookie())
                    .header("X-CSRF-Token", student.csrf())
                    .contentType("application/json")
                    .content("{\"knowledgeId\":15}"))
            .andExpect(status().isOk())
            .andReturn();
    var quiz = json.readTree(started.getResponse().getContentAsString());
    String assessmentId = quiz.get("id").asText();
    String body = "{\"assessmentId\":\"" + assessmentId + "\",\"answers\":[0,0,0]}";
    var submitted =
        mvc.perform(
                post("/api/assessments/submit")
                    .cookie(student.cookie())
                    .header("X-CSRF-Token", student.csrf())
                    .contentType("application/json")
                    .content(body))
            .andExpect(status().isOk())
            .andReturn();
    var legacy = (ObjectNode) json.readTree(submitted.getResponse().getContentAsString());
    legacy.remove(java.util.List.of("evidenceAdded", "repeatedAnswers"));
    var oldState = (ObjectNode) legacy.get("mastery");
    oldState.remove(java.util.List.of("evidenceAttempts", "evidenceCorrect", "legacyAttempts"));
    String persisted = json.writeValueAsString(legacy);
    store.jdbc().update("UPDATE assessments SET result=? WHERE id=?", persisted, assessmentId);
    var eventsBefore = store.events(1);
    double masteryBefore = mastery.all(1).get(15L).value();

    var replayed =
        mvc.perform(
                post("/api/assessments/submit")
                    .cookie(student.cookie())
                    .header("X-CSRF-Token", student.csrf())
                    .contentType("application/json")
                    .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.historicalResult").value(true))
            .andExpect(jsonPath("$.evidenceAdded").value(3))
            .andExpect(jsonPath("$.repeatedAnswers").value(0))
            .andExpect(jsonPath("$.mastery.evidenceAttempts").value(3))
            .andExpect(jsonPath("$.mastery.evidenceCorrect").value(3))
            .andExpect(jsonPath("$.mastery.legacyAttempts").value(3))
            .andReturn();
    var result = json.readTree(replayed.getResponse().getContentAsString());
    assertThat(result.at("/mastery/value")).isEqualTo(legacy.at("/mastery/value"));
    assertThat(result.at("/mastery/lower")).isEqualTo(legacy.at("/mastery/lower"));
    assertThat(store.events(1)).isEqualTo(eventsBefore);
    assertThat(mastery.all(1).get(15L).value()).isEqualTo(masteryBefore);
    assertThat(
            store
                .jdbc()
                .queryForObject(
                    "SELECT result FROM assessments WHERE id=?", String.class, assessmentId))
        .isEqualTo(persisted);
  }

  @Test
  void aNewAssessmentOfTheSameQuestionsKeepsPracticeButAddsNoImmediateEvidence() throws Exception {
    Session student = login("student");
    JsonNode first = null;
    for (int round = 0; round < 2; round++) {
      var started =
          mvc.perform(
                  post("/api/assessments")
                      .cookie(student.cookie())
                      .header("X-CSRF-Token", student.csrf())
                      .contentType("application/json")
                      .content("{\"knowledgeId\":15}"))
              .andExpect(status().isOk())
              .andReturn();
      var quiz = json.readTree(started.getResponse().getContentAsString());
      String body = "{\"assessmentId\":\"" + quiz.get("id").asText() + "\",\"answers\":[0,0,0]}";
      var submitted =
          mvc.perform(
                  post("/api/assessments/submit")
                      .cookie(student.cookie())
                      .header("X-CSRF-Token", student.csrf())
                      .contentType("application/json")
                      .content(body))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.evidenceAdded").value(round == 0 ? 3 : 0))
              .andExpect(jsonPath("$.repeatedAnswers").value(round == 0 ? 0 : 3))
              .andReturn();
      var result = json.readTree(submitted.getResponse().getContentAsString());
      if (round == 0) first = result;
      else {
        assertThat(result.at("/mastery/value")).isEqualTo(first.at("/mastery/value"));
        assertThat(result.at("/mastery/attempts").asInt()).isEqualTo(6);
        assertThat(result.at("/mastery/evidenceAttempts").asInt()).isEqualTo(3);
      }
    }
    assertThat(
            store.events(1).stream().filter(e -> ((Number) e.get("knowledgeId")).longValue() == 15))
        .allMatch(e -> ((Number) e.get("questionId")).longValue() > 0);
  }

  @Test
  void studyIsNotEvidenceOfMasteryAndPredictionFailureIsExplicit() throws Exception {
    Session s = login("student");
    double before = mastery.all(1).get(18L).value();
    mvc.perform(
            post("/api/study")
                .cookie(s.cookie())
                .header("X-CSRF-Token", s.csrf())
                .contentType("application/json")
                .content("{\"knowledgeId\":18,\"seconds\":600}"))
        .andExpect(status().isOk());
    assertThat(mastery.all(1).get(18L).value()).isEqualTo(before);
    mvc.perform(
            post("/api/predictions")
                .cookie(s.cookie())
                .header("X-CSRF-Token", s.csrf())
                .contentType("application/json")
                .content("{\"knowledgeId\":18,\"plannedMinutes\":30,\"horizonDays\":3}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source").value("rule-fallback"));
    mvc.perform(
            post("/api/study")
                .cookie(s.cookie())
                .header("X-CSRF-Token", s.csrf())
                .contentType("application/json")
                .content("{\"knowledgeId\":18,\"seconds\":-1}"))
        .andExpect(status().isBadRequest());
  }
}
