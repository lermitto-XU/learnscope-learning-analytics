package io.learnscope;

import static io.learnscope.Domain.*;
import static org.assertj.core.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class PathServiceTest {
  final PathService service = new PathService();

  Knowledge node(long id, int difficulty) {
    return new Knowledge(id, "K" + id, "Test", "Test", difficulty, 30, 1, 0, 0, "Content", 1);
  }

  Mastery state(double value, int attempts) {
    return new Mastery(value, 0, 1, attempts, attempts, attempts, attempts, 0, 0, 0, "Test");
  }

  @Test
  void budgetRetainsDependencyOrderAndNeverSchedulesAfterFirstOverflow() {
    var nodes = List.of(node(1, 9), node(2, 1), node(3, 2));
    var edges =
        List.of(new Relation(1, 1, 2, "PREREQUISITE", 1), new Relation(2, 2, 3, "PREREQUISITE", 1));
    var states = Map.of(1L, state(.15, 0), 2L, state(.15, 0), 3L, state(.15, 0));
    var plan = service.plan(nodes, edges, states, new PathRequest(3, 40, .8));
    assertThat(plan.steps()).extracting(s -> s.knowledge().id()).containsExactly(1L, 2L, 3L);
    assertThat(plan.steps())
        .extracting(PathService.Step::inBudget)
        .containsExactly(true, false, false);
    assertThat(plan.scheduledMinutes()).isLessThanOrEqualTo(40);
    assertThat(plan.completeWithinBudget()).isFalse();
  }

  @Test
  void onlyEvidenceSupportedMasteryCanBeSkippedAndRelatedEdgesAreNotDependencies() {
    var nodes = List.of(node(1, 2), node(2, 3), node(3, 4));
    var edges =
        List.of(new Relation(1, 1, 2, "PREREQUISITE", 1), new Relation(2, 3, 2, "RELATED", 1));
    var plan =
        service.plan(
            nodes,
            edges,
            Map.of(1L, state(.95, 6), 2L, state(.9, 0), 3L, state(.15, 0)),
            new PathRequest(2, 120, .8));
    assertThat(plan.skipped()).containsExactly(1L);
    assertThat(plan.steps()).extracting(s -> s.knowledge().id()).containsExactly(2L);
  }

  @Test
  void shortIntervalPracticeCannotSatisfyEvidenceThreshold() {
    var repeated = new Mastery(.95, 0, 1, 30, 30, 3, 3, 0, 0, 0, "Test");
    var plan =
        service.plan(
            List.of(node(1, 2)), List.of(), Map.of(1L, repeated), new PathRequest(1, 120, .8));
    assertThat(plan.skipped()).isEmpty();
    assertThat(plan.steps()).hasSize(1);
    assertThat(plan.warnings()).anyMatch(w -> w.contains("证据不足"));
  }

  @Test
  void rejectsCyclesInsteadOfReturningAMisleadingFallbackPath() {
    var nodes = List.of(node(1, 2), node(2, 3));
    var edges = List.of(new Relation(1, 1, 2, "PREREQUISITE", 1));
    assertThatThrownBy(
            () -> service.validateRelation(nodes, edges, new RelationEdit(2, 1, "PREREQUISITE", 1)))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("循环");
    var cyclic = new ArrayList<>(edges);
    cyclic.add(new Relation(2, 2, 1, "PREREQUISITE", 1));
    assertThatThrownBy(
            () ->
                service.plan(
                    nodes,
                    cyclic,
                    Map.of(1L, state(.2, 0), 2L, state(.2, 0)),
                    new PathRequest(2, 90, .8)))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void everyPrerequisitePrecedesItsTargetAcrossRandomDags() {
    Random rng = new Random(2026);
    for (int example = 0; example < 50; example++) {
      List<Knowledge> nodes = new ArrayList<>();
      List<Relation> edges = new ArrayList<>();
      Map<Long, Mastery> states = new HashMap<>();
      for (long id = 1; id <= 30; id++) {
        nodes.add(node(id, 1 + rng.nextInt(10)));
        states.put(id, state(.15, 0));
      }
      for (long a = 1; a < 30; a++)
        for (long b = a + 1; b <= 30; b++)
          if (rng.nextDouble() < .12)
            edges.add(new Relation(edges.size() + 1, a, b, "PREREQUISITE", 1));
      var plan = service.plan(nodes, edges, states, new PathRequest(30, 90, .8));
      List<Long> order = plan.steps().stream().map(s -> s.knowledge().id()).toList();
      for (var edge : edges)
        if (order.contains(edge.target())) {
          assertThat(order).contains(edge.source());
          assertThat(order.indexOf(edge.source())).isLessThan(order.indexOf(edge.target()));
        }
      assertThat(order).doesNotHaveDuplicates();
    }
  }
}
