package io.learnscope;

import static io.learnscope.Domain.*;
import static org.assertj.core.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class MasteryServiceTest {
  final MasteryService service = new MasteryService(null);
  static final long DAY = 86_400_000L;
  final Knowledge knowledge = new Knowledge(1, "K1", "Test", "Test", 3, 30, 1, 0, 0, "Content", 1);

  Map<String, Object> answer(long id, long question, long timestamp, boolean correct) {
    return Map.of(
        "id",
        id,
        "knowledgeId",
        1L,
        "questionId",
        question,
        "createdAt",
        timestamp,
        "correct",
        correct ? 1 : 0,
        "total",
        1,
        "seconds",
        0);
  }

  Mastery calculate(List<Map<String, Object>> events, long now) {
    return service.calculate(List.of(knowledge), events, now).get(1L);
  }

  @Test
  void immediateRepeatsRemainPracticeWithoutInflatingMasteryOrNarrowingInterval() {
    var first = answer(1, 101, DAY, true);
    var baseline = calculate(List.of(first), DAY + 1_000);
    var repeated = calculate(List.of(first, answer(2, 101, DAY + 500, true)), DAY + 1_000);
    assertThat(repeated.value()).isEqualTo(baseline.value());
    assertThat(repeated.lower()).isEqualTo(baseline.lower());
    assertThat(repeated.upper()).isEqualTo(baseline.upper());
    assertThat(repeated.attempts()).isEqualTo(2);
    assertThat(repeated.correct()).isEqualTo(2);
    assertThat(repeated.evidenceAttempts()).isEqualTo(1);
    assertThat(repeated.evidenceCorrect()).isEqualTo(1);
    assertThat(repeated.daysSince()).isEqualTo(baseline.daysSince());
  }

  @Test
  void repeatBecomesEvidenceAfterFull24HoursAndPracticeDoesNotExtendCooldown() {
    var history =
        List.of(
            answer(1, 101, DAY, false),
            answer(2, 101, 2 * DAY - 1, true),
            answer(3, 101, 2 * DAY, true));
    var before = calculate(history, 2 * DAY - 1);
    var after = calculate(history, 2 * DAY);
    assertThat(before.attempts()).isEqualTo(2);
    assertThat(before.evidenceAttempts()).isEqualTo(1);
    assertThat(before.evidenceCorrect()).isZero();
    assertThat(after.attempts()).isEqualTo(3);
    assertThat(after.evidenceAttempts()).isEqualTo(2);
    assertThat(after.evidenceCorrect()).isEqualTo(1);
    assertThat(after.value()).isGreaterThan(before.value());
    assertThat(after.daysSince()).isZero();
  }

  @Test
  void differentQuestionsAreCountedSeparatelyIncludingWrongAnswers() {
    var evidence = calculate(List.of(answer(1, 101, DAY, true), answer(2, 102, DAY, false)), DAY);
    assertThat(evidence.evidenceAttempts()).isEqualTo(2);
    assertThat(evidence.evidenceCorrect()).isEqualTo(1);
    assertThat(evidence.legacyAttempts()).isZero();
  }

  @Test
  void studyDoesNotResetDiagnosticRecencyOrDelayForgetting() {
    var first = answer(1, 101, DAY, true);
    Map<String, Object> study =
        Map.of(
            "id",
            2L,
            "knowledgeId",
            1L,
            "createdAt",
            3 * DAY,
            "total",
            0,
            "correct",
            0,
            "seconds",
            600);
    var baseline = calculate(List.of(first), 5 * DAY);
    var studied = calculate(List.of(first, study), 5 * DAY);
    assertThat(studied.daysSince()).isEqualTo(4);
    assertThat(studied.value()).isEqualTo(baseline.value());
    assertThat(studied.seconds()).isEqualTo(600);
    assertThat(studied.evidenceAttempts()).isEqualTo(1);
  }

  @Test
  void eventOrderingAndFutureEventsCannotChangeHistoricalSnapshot() {
    var chronological =
        List.of(
            answer(1, 101, DAY, true),
            answer(2, 102, DAY, false),
            answer(3, 101, DAY + 5_000, false),
            answer(4, 101, 3 * DAY, true));
    var shuffled = new ArrayList<>(chronological);
    Collections.shuffle(shuffled, new Random(2026));
    assertThat(calculate(shuffled, 4 * DAY)).isEqualTo(calculate(chronological, 4 * DAY));
    assertThat(calculate(chronological, 2 * DAY))
        .isEqualTo(calculate(chronological.subList(0, 3), 2 * DAY));
  }

  @Test
  void unknownHistoricalQuestionsArePreservedAndExplicitlyLabelled() {
    var history = new HashMap<>(answer(1, 0, DAY, true));
    history.remove("questionId");
    var state = calculate(List.of(history), DAY);
    assertThat(state.evidenceAttempts()).isEqualTo(1);
    assertThat(state.legacyAttempts()).isEqualTo(1);
    assertThat(state.evidence()).contains("历史证据", "未追溯题目");
  }
}
