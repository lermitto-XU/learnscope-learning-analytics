package io.learnscope;

import static io.learnscope.Domain.*;
import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PredictionServiceTest {
  final ObjectMapper json = new ObjectMapper();
  final AtomicInteger requests = new AtomicInteger();
  final AtomicReference<JsonNode> received = new AtomicReference<>();
  HttpServer server;

  @AfterEach
  void stop() {
    if (server != null) server.stop(0);
  }

  PredictionService service(int status, String response) throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/predict/batch",
        exchange -> {
          requests.incrementAndGet();
          received.set(json.readTree(exchange.getRequestBody()));
          byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, bytes.length);
          exchange.getResponseBody().write(bytes);
          exchange.close();
        });
    server.start();
    return new PredictionService(
        json, "http://127.0.0.1:" + server.getAddress().getPort(), "test-key");
  }

  Knowledge knowledge() {
    return new Knowledge(1, "Test", "Test", "Test", 5, 30, 1, 0, 0, "Test", 1);
  }

  Mastery state(int attempts) throws Exception {
    var fields = json.createObjectNode();
    fields.put("value", .6).put("lower", .2).put("upper", .9);
    fields.put("attempts", attempts).put("correct", attempts - 1);
    fields.put("evidenceAttempts", 2).put("evidenceCorrect", 1).put("legacyAttempts", 0);
    fields.put("seconds", 1200).put("daysSince", 3).put("evidence", "Test");
    return json.treeToValue(fields, Mastery.class);
  }

  String pair(double scenario, double baseline) {
    return "[{\"probability\":"
        + scenario
        + ",\"source\":\"calibrated-ensemble\",\"modelVersion\":\"test\",\"modelSpread\":[]},"
        + "{\"probability\":"
        + baseline
        + ",\"source\":\"calibrated-ensemble\",\"modelVersion\":\"test\",\"modelSpread\":[]}]";
  }

  @Test
  void comparesSameHorizonInOneBatchWithoutForcingPositiveDifference() throws Exception {
    var result =
        service(200, pair(.58, .61)).forecast(knowledge(), state(25), .7, new Forecast(1, 30, 5));
    assertThat(requests.get()).isEqualTo(1);
    assertThat(result).containsEntry("probability", .58).containsEntry("baselineProbability", .61);
    assertThat(result)
        .containsEntry("difference", -.03)
        .containsEntry("baselineSource", "calibrated-ensemble");
    assertThat(result.get("comparisonNotice").toString()).contains("不代表学习的因果收益");
    var items = received.get().get("items");
    assertThat(items.size()).isEqualTo(2);
    assertThat(items.get(0).get("plannedMinutes").asInt()).isEqualTo(30);
    assertThat(items.get(1).get("plannedMinutes").asInt()).isZero();
    assertThat(items.get(0).get("horizonDays").asInt()).isEqualTo(5);
    assertThat(items.get(1).get("horizonDays").asInt()).isEqualTo(5);
    assertThat(items.get(0).get("attempts").asInt()).isEqualTo(2);
    assertThat(items.get(0).get("accuracy").asDouble()).isEqualTo(.5);
  }

  @Test
  void zeroExtraMinutesHasTheSameBaseline() throws Exception {
    var result =
        service(200, pair(.61, .61)).forecast(knowledge(), state(25), .7, new Forecast(1, 0, 5));
    assertThat(result).containsEntry("difference", 0.0);
    assertThat(received.get().get("items").get(0)).isEqualTo(received.get().get("items").get(1));
  }

  @Test
  void oneInvalidPredictionFallsBackAsAWholePair() throws Exception {
    var result =
        service(200, pair(.99, 1.2)).forecast(knowledge(), state(25), .7, new Forecast(1, 30, 5));
    assertFallback(result);
    assertThat(result.get("probability")).isNotEqualTo(.99);
    assertThat(((Number) result.get("difference")).doubleValue()).isGreaterThan(0);
  }

  @Test
  void unavailableServiceFallsBackWithZeroDifferenceAndRepeatedPracticeDoesNotRaiseTheEstimate()
      throws Exception {
    var predictor = service(503, "{}");
    var first = predictor.forecast(knowledge(), state(2), .7, new Forecast(1, 0, 5));
    var repeated = predictor.forecast(knowledge(), state(25), .7, new Forecast(1, 0, 5));
    assertFallback(first);
    assertThat(first).containsEntry("difference", 0.0);
    assertThat(first.get("probability")).isEqualTo(repeated.get("probability"));
    assertThat(first.get("baselineProbability")).isEqualTo(first.get("probability"));
  }

  @Test
  void inconsistentZeroMinutePredictionsFallBackTogether() throws Exception {
    var result =
        service(200, pair(.8, .7)).forecast(knowledge(), state(25), .7, new Forecast(1, 0, 5));
    assertFallback(result);
    assertThat(result).containsEntry("difference", 0.0);
  }

  void assertFallback(Map<String, Object> result) {
    assertThat(result)
        .containsEntry("source", "rule-fallback")
        .containsEntry("baselineSource", "rule-fallback");
    assertThat(result.get("notice").toString()).contains("情景与对照均来自启发式规则");
  }
}
