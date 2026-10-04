package io.learnscope;

import static io.learnscope.Domain.*;

import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class PathService {
  public record Step(
      Knowledge knowledge, double mastery, int estimatedMinutes, boolean inBudget, String reason) {}

  public record Plan(
      List<Step> steps,
      List<Long> skipped,
      int totalMinutes,
      int scheduledMinutes,
      boolean completeWithinBudget,
      String algorithm,
      List<String> warnings) {}

  public Plan plan(
      List<Knowledge> nodes,
      List<Relation> relations,
      Map<Long, Mastery> mastery,
      PathRequest request) {
    Map<Long, Knowledge> byId = new HashMap<>();
    nodes.forEach(k -> byId.put(k.id(), k));
    if (!byId.containsKey(request.targetId())) throw new ApiException(404, "目标知识点不存在");
    Map<Long, Set<Long>> prerequisites = new HashMap<>();
    Map<Long, Set<Long>> dependents = new HashMap<>();
    nodes.forEach(k -> prerequisites.put(k.id(), new TreeSet<>()));
    nodes.forEach(k -> dependents.put(k.id(), new TreeSet<>()));
    relations.stream()
        .filter(r -> r.type().equals("PREREQUISITE"))
        .forEach(
            r -> {
              prerequisites.get(r.target()).add(r.source());
              dependents.get(r.source()).add(r.target());
            });
    Set<Long> closure = new TreeSet<>();
    Deque<Long> pending = new ArrayDeque<>();
    pending.add(request.targetId());
    while (!pending.isEmpty()) {
      long id = pending.removeFirst();
      if (closure.add(id)) pending.addAll(prerequisites.get(id));
    }
    Map<Long, Integer> degrees = new HashMap<>();
    for (long id : closure)
      degrees.put(id, (int) prerequisites.get(id).stream().filter(closure::contains).count());
    Comparator<Long> priority =
        Comparator.comparingInt((Long id) -> byId.get(id).difficulty())
            .thenComparing(
                Comparator.comparingDouble((Long id) -> byId.get(id).importance()).reversed())
            .thenComparingLong(id -> id);
    PriorityQueue<Long> ready = new PriorityQueue<>(priority);
    degrees.forEach(
        (id, d) -> {
          if (d == 0) ready.add(id);
        });
    List<Long> sorted = new ArrayList<>();
    while (!ready.isEmpty()) {
      long id = ready.remove();
      sorted.add(id);
      for (long next : dependents.get(id))
        if (closure.contains(next) && degrees.compute(next, (key, d) -> d - 1) == 0)
          ready.add(next);
    }
    if (sorted.size() != closure.size()) throw new ApiException(422, "先修关系存在环，无法生成有效路径，请修正知识图谱");
    List<Step> steps = new ArrayList<>();
    List<Long> skipped = new ArrayList<>();
    int total = 0, scheduled = 0;
    boolean budgetClosed = false;
    for (long id : sorted) {
      Mastery m = mastery.get(id);
      Knowledge k = byId.get(id);
      if (m.value() >= request.threshold() && m.evidenceAttempts() >= 5) {
        skipped.add(id);
        continue;
      }
      int minutes = Math.max(5, (int) Math.ceil(k.minutes() * (1 - 0.55 * m.value())));
      total += minutes;
      boolean fits = !budgetClosed && scheduled + minutes <= request.budgetMinutes();
      if (fits) scheduled += minutes;
      else budgetClosed = true;
      String reason = id == request.targetId() ? "你的目标知识点" : "目标所需的先修知识；后续步骤依赖此基础";
      if (m.evidenceAttempts() == 0) reason += "；建议先完成一次诊断测验";
      steps.add(new Step(k, m.value(), minutes, fits, reason));
    }
    List<String> warnings = new ArrayList<>();
    if (total > request.budgetMinutes()) warnings.add("时间预算不足以完成全部先修内容，已安排保持依赖顺序的连续前缀，其余步骤留待后续学习。");
    if (steps.stream().anyMatch(s -> mastery.get(s.knowledge().id()).evidenceAttempts() < 5))
      warnings.add("部分知识点测验证据不足，路径依据当前估计生成，完成测验后可重新规划。");
    return new Plan(
        steps,
        skipped,
        total,
        scheduled,
        total <= request.budgetMinutes(),
        "先修闭包 + Kahn 拓扑排序 + 就绪节点难度优先",
        warnings);
  }

  public void validateRelation(List<Knowledge> nodes, List<Relation> relations, RelationEdit edit) {
    if (edit.source() == edit.target()) throw new ApiException(422, "知识点不能依赖自身");
    if (nodes.stream().noneMatch(k -> k.id() == edit.source())
        || nodes.stream().noneMatch(k -> k.id() == edit.target()))
      throw new ApiException(404, "关联知识点不存在");
    if (!"PREREQUISITE".equals(edit.type())) return;
    Map<Long, List<Long>> next = new HashMap<>();
    relations.stream()
        .filter(r -> r.type().equals("PREREQUISITE"))
        .forEach(r -> next.computeIfAbsent(r.source(), id -> new ArrayList<>()).add(r.target()));
    Set<Long> visited = new HashSet<>();
    Deque<Long> queue = new ArrayDeque<>();
    queue.add(edit.target());
    while (!queue.isEmpty()) {
      long id = queue.removeFirst();
      if (id == edit.source()) throw new ApiException(422, "该关系会产生循环依赖，已拒绝保存");
      if (visited.add(id)) queue.addAll(next.getOrDefault(id, List.of()));
    }
  }
}
