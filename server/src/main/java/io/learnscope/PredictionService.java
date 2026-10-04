package io.learnscope;

import static io.learnscope.Domain.*;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PredictionService {
  private final ObjectMapper json;
  private final String url, key;
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofMillis(800)).build();

  public PredictionService(
      ObjectMapper json,
      @Value("${app.predictor-url}") String url,
      @Value("${PREDICTOR_KEY:}") String key) {
    this.json = json;
    this.url = url;
    this.key = key;
  }

  public Map<String, Object> forecast(Knowledge k, Mastery m, double prerequisite, Forecast input) {
    var features =
        Map.<String, Object>of(
            "mastery",
            m.value(),
            "accuracy",
            m.evidenceAttempts() == 0 ? 0.5 : (double) m.evidenceCorrect() / m.evidenceAttempts(),
            "attempts",
            m.evidenceAttempts(),
            "studyMinutes",
            m.seconds() / 60.0,
            "difficulty",
            k.difficulty(),
            "daysSince",
            m.daysSince(),
            "prerequisite",
            prerequisite,
            "plannedMinutes",
            input.plannedMinutes(),
            "horizonDays",
            input.horizonDays());
    var baselineFeatures = new LinkedHashMap<>(features);
    baselineFeatures.put("plannedMinutes", 0);
    Map<String, Object> result;
    Map<String, Object> baseline;
    try {
      var request =
          HttpRequest.newBuilder(URI.create(url + "/predict/batch"))
              .timeout(Duration.ofMillis(1800))
              .header("Content-Type", "application/json")
              .header("X-Predictor-Key", key)
              .POST(
                  HttpRequest.BodyPublishers.ofString(
                      json.writeValueAsString(
                          Map.of("items", List.of(features, baselineFeatures)))))
              .build();
      var response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200)
        throw new IllegalStateException("Predictor status " + response.statusCode());
      List<Map<String, Object>> predictions =
          json.readValue(
              response.body(),
              new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
      if (predictions.size() != 2) throw new IllegalStateException("Predictor pair is incomplete");
      result = predictions.get(0);
      baseline = predictions.get(1);
      validatePrediction(result);
      validatePrediction(baseline);
      if (!Objects.equals(result.get("source"), baseline.get("source"))
          || !Objects.equals(result.get("modelVersion"), baseline.get("modelVersion")))
        throw new IllegalStateException("Predictor pair uses different models");
      if (input.plannedMinutes() == 0
          && Double.compare(probability(result), probability(baseline)) != 0)
        throw new IllegalStateException("Identical scenarios returned different probabilities");
    } catch (Exception error) {
      if (error instanceof InterruptedException) Thread.currentThread().interrupt();
      result = fallback(k, m, prerequisite, input.plannedMinutes(), input.horizonDays());
      baseline = fallback(k, m, prerequisite, 0, input.horizonDays());
    }
    result = new LinkedHashMap<>(result);
    result.put("baselineProbability", probability(baseline));
    result.put("baselineSource", baseline.get("source"));
    result.put("difference", MasteryService.round(probability(result) - probability(baseline)));
    result.put(
        "comparisonNotice", "对照使用相同预测间隔、额外学习 0 分钟。差值是模型对两种情景的关联预测，不代表学习的因果收益，也不保证增加时长会提高预测值。");
    result.put("features", features);
    result.put("current", m);
    result.put("knowledge", k);
    result.put(
        "factors",
        List.of(
            Map.of(
                "label",
                "测验证据",
                "value",
                "计分证据 "
                    + m.evidenceAttempts()
                    + " 次 / 累计作答 "
                    + m.attempts()
                    + " 次 · "
                    + m.evidence()),
            Map.of("label", "前置知识", "value", Math.round(prerequisite * 100) + "% 平均估计掌握度"),
            Map.of("label", "学习间隔", "value", Math.round(m.daysSince()) + " 天 · 遗忘参数为演示假设")));
    return result;
  }

  private static double probability(Map<String, Object> prediction) {
    return ((Number) prediction.get("probability")).doubleValue();
  }

  private static void validatePrediction(Map<String, Object> prediction) {
    if (prediction == null
        || !(prediction.get("probability") instanceof Number value)
        || !Double.isFinite(value.doubleValue())
        || value.doubleValue() < 0
        || value.doubleValue() > 1
        || !"calibrated-ensemble".equals(prediction.get("source")))
      throw new IllegalStateException("Invalid predictor result");
  }

  private static Map<String, Object> fallback(
      Knowledge k, Mastery m, double prerequisite, int plannedMinutes, int horizonDays) {
    double retained =
        0.15
            + (m.value() - 0.15)
                * Math.pow(0.5, horizonDays / (20.0 + Math.min(m.evidenceAttempts(), 30) * 2));
    double gain =
        (1 - retained)
            * (1 - Math.exp(-plannedMinutes / (45.0 + k.difficulty() * 8)))
            * (0.5 + 0.5 * prerequisite);
    double p = Math.min(0.98, (retained + gain) * 0.87 + (1 - retained - gain) * 0.2);
    return Map.of(
        "probability",
        MasteryService.round(p),
        "source",
        "rule-fallback",
        "modelSpread",
        List.of(),
        "notice",
        "预测服务不可用，情景与对照均来自启发式规则，尚未经过真实数据校准。");
  }

  public Object metrics() {
    try {
      var request =
          HttpRequest.newBuilder(URI.create(url + "/metrics"))
              .timeout(Duration.ofMillis(1800))
              .header("X-Predictor-Key", key)
              .GET()
              .build();
      var response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) throw new IllegalStateException();
      return json.readTree(response.body());
    } catch (Exception error) {
      if (error instanceof InterruptedException) Thread.currentThread().interrupt();
      return Map.of("available", false, "notice", "模型服务不可用；预测将使用规则回退");
    }
  }
}
