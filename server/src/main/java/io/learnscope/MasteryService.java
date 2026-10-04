package io.learnscope;

import static io.learnscope.Domain.*;

import java.util.*;
import org.springframework.stereotype.Service;

/**
 * BKT evidence update with a configurable heuristic forgetting half-life. Not a ground-truth score.
 */
@Service
public class MasteryService {
  static final long EVIDENCE_COOLDOWN_MILLIS = 86_400_000L;
  private final Store store;

  public MasteryService(Store store) {
    this.store = store;
  }

  public Map<Long, Mastery> all(long userId) {
    return calculate(store.knowledge(), store.events(userId), System.currentTimeMillis());
  }

  public Map<Long, Mastery> calculate(
      List<Knowledge> knowledge, List<Map<String, Object>> events, long now) {
    // Replays and historical snapshots use the same order even if callers supply unsorted events.
    var ordered =
        events.stream()
            .filter(e -> number(e, "createdAt") <= now)
            .sorted(
                Comparator.<Map<String, Object>>comparingLong(e -> number(e, "createdAt"))
                    .thenComparingLong(e -> number(e, "id"))
                    .thenComparingLong(e -> number(e, "questionId"))
                    .thenComparingLong(e -> number(e, "correct")))
            .toList();
    Map<Long, Mastery> result = new LinkedHashMap<>();
    for (Knowledge k : knowledge) {
      double p = 0.15;
      int attempts = 0, correct = 0;
      int evidenceAttempts = 0, evidenceCorrect = 0, legacyAttempts = 0;
      long seconds = 0;
      Long last = null;
      Map<Long, Long> countedQuestions = new HashMap<>();
      for (var e : ordered) {
        if (number(e, "knowledgeId") != k.id()) continue;
        long timestamp = number(e, "createdAt");
        seconds += number(e, "seconds");
        int n = (int) number(e, "total"), c = (int) number(e, "correct");
        attempts += n;
        correct += c;
        if (n == 0) continue;
        long questionId = number(e, "questionId");
        Long previous = countedQuestions.get(questionId);
        // Raw practice stays visible; short-interval repeats are not new diagnostic evidence.
        if (questionId > 0 && previous != null && timestamp - previous < EVIDENCE_COOLDOWN_MILLIS)
          continue;
        if (questionId > 0) countedQuestions.put(questionId, timestamp);
        else legacyAttempts += n;
        if (last != null) p = decay(p, timestamp - last, evidenceAttempts);
        last = timestamp;
        for (int i = 0; i < n; i++) {
          double slip = 0.08 + 0.009 * k.difficulty(), guess = 0.20;
          boolean ok = i < c;
          double numerator = ok ? p * (1 - slip) : p * slip;
          p = numerator / (numerator + (ok ? (1 - p) * guess : (1 - p) * (1 - guess)));
          p = p + (1 - p) * 0.06;
        }
        evidenceAttempts += n;
        evidenceCorrect += c;
      }
      double days = last == null ? 0 : Math.max(0, (now - last) / 86_400_000.0);
      if (last != null) p = decay(p, now - last, evidenceAttempts);
      // No passive study time is treated as proof of understanding.
      double lower = 0, upper = 1;
      if (evidenceAttempts > 0) {
        double observed = (double) evidenceCorrect / evidenceAttempts,
            z2 = 1.96 * 1.96,
            denominator = 1 + z2 / evidenceAttempts;
        double center = (observed + z2 / (2 * evidenceAttempts)) / denominator;
        double width =
            1.96
                * Math.sqrt(
                    observed * (1 - observed) / evidenceAttempts
                        + z2 / (4.0 * evidenceAttempts * evidenceAttempts))
                / denominator;
        lower = Math.max(0, center - width);
        upper = Math.min(1, center + width);
      }
      result.put(
          k.id(),
          new Mastery(
              round(p),
              round(lower),
              round(upper),
              attempts,
              correct,
              evidenceAttempts,
              evidenceCorrect,
              legacyAttempts,
              seconds,
              round(days),
              (evidenceAttempts == 0
                      ? "暂无测验证据"
                      : evidenceAttempts < 5 ? "证据较少" : evidenceAttempts < 15 ? "已有初步证据" : "累计测验证据")
                  + (legacyAttempts > 0 ? "；含 " + legacyAttempts + " 次历史证据（未追溯题目）" : "")));
    }
    return result;
  }

  private static long number(Map<String, Object> event, String key) {
    return event.get(key) instanceof Number n ? n.longValue() : 0;
  }

  private static double decay(double probability, long elapsedMillis, int evidenceAttempts) {
    double days = Math.max(0, elapsedMillis / 86_400_000.0);
    return 0.15
        + (probability - 0.15) * Math.pow(0.5, days / (20 + Math.min(evidenceAttempts, 30) * 2));
  }

  static double round(double value) {
    return Math.round(value * 10_000.0) / 10_000.0;
  }
}
