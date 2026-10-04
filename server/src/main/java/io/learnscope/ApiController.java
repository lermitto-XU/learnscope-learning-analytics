package io.learnscope;

import static io.learnscope.Domain.*;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final Store store;
  private final AuthService auth;
  private final MasteryService mastery;
  private final PathService paths;
  private final LearningService learning;
  private final PredictionService prediction;
  private final boolean demo;

  public ApiController(
      Store store,
      AuthService auth,
      MasteryService mastery,
      PathService paths,
      LearningService learning,
      PredictionService prediction,
      @Value("${app.demo}") boolean demo) {
    this.store = store;
    this.auth = auth;
    this.mastery = mastery;
    this.paths = paths;
    this.learning = learning;
    this.prediction = prediction;
    this.demo = demo;
  }

  @GetMapping("/health")
  Object health() {
    return Map.of("status", "ok", "application", "LearnScope", "demo", demo);
  }

  @PostMapping("/auth/login")
  Object login(
      @Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
    return auth.login(input, request, response);
  }

  @PostMapping("/auth/register")
  Object register(@Valid @RequestBody Register input) {
    auth.register(input);
    return Map.of("message", "注册成功，请登录");
  }

  @GetMapping("/auth/me")
  Object me(HttpServletRequest request) {
    return auth.session(request);
  }

  @PostMapping("/auth/logout")
  Object logout(HttpServletRequest request, HttpServletResponse response) {
    auth.logout(request, response);
    return Map.of("message", "已退出");
  }

  @GetMapping("/graph")
  Object graph(HttpServletRequest request) {
    return Map.of(
        "nodes",
        store.knowledge(),
        "edges",
        store.relations(),
        "mastery",
        mastery.all(auth.user(request).id()));
  }

  @GetMapping("/overview")
  Object overview(HttpServletRequest request) {
    return learning.overview(auth.user(request).id());
  }

  @GetMapping("/knowledge/{id}")
  Object detail(@PathVariable long id, HttpServletRequest request) {
    return Map.of(
        "knowledge", store.knowledge(id), "mastery", mastery.all(auth.user(request).id()).get(id));
  }

  @PostMapping("/study")
  Object study(@Valid @RequestBody Study input, HttpServletRequest request) {
    store.knowledge(input.knowledgeId());
    store.event(
        auth.user(request).id(),
        input.knowledgeId(),
        "STUDY",
        input.seconds(),
        0,
        0,
        System.currentTimeMillis());
    return Map.of("message", "学习记录已保存，完成测验可更新掌握度估计");
  }

  @PostMapping("/paths")
  Object path(@Valid @RequestBody PathRequest input, HttpServletRequest request) {
    return paths.plan(
        store.knowledge(), store.relations(), mastery.all(auth.user(request).id()), input);
  }

  @PostMapping("/predictions")
  Object forecast(@Valid @RequestBody Forecast input, HttpServletRequest request) {
    var states = mastery.all(auth.user(request).id());
    var k = store.knowledge(input.knowledgeId());
    double prior =
        store.relations().stream()
            .filter(r -> r.type().equals("PREREQUISITE") && r.target() == k.id())
            .mapToDouble(r -> states.get(r.source()).value())
            .average()
            .orElse(1);
    return prediction.forecast(k, states.get(k.id()), prior, input);
  }

  @GetMapping("/models/metrics")
  Object metrics() {
    return prediction.metrics();
  }

  @PostMapping("/assessments")
  Object quiz(@Valid @RequestBody QuizStart input, HttpServletRequest request) throws Exception {
    return learning.startQuiz(auth.user(request).id(), input.knowledgeId());
  }

  @PostMapping("/assessments/submit")
  Object submit(@Valid @RequestBody QuizAnswer input, HttpServletRequest request) throws Exception {
    return learning.submitQuiz(auth.user(request).id(), input);
  }

  @GetMapping("/records")
  Object records(HttpServletRequest request) {
    return store.events(auth.user(request).id());
  }

  @GetMapping("/records/export")
  Object export(HttpServletRequest request) {
    return Map.of(
        "user",
        auth.user(request),
        "events",
        store.events(auth.user(request).id()),
        "mastery",
        mastery.all(auth.user(request).id()));
  }

  @PostMapping("/knowledge")
  @Transactional
  Object create(@Valid @RequestBody KnowledgeCreate input, HttpServletRequest request) {
    auth.staff(request);
    store.jdbc().queryForList("SELECT id FROM knowledge ORDER BY id FOR UPDATE");
    long id =
        store.jdbc().queryForObject("SELECT COALESCE(MAX(id),0)+1 FROM knowledge", Long.class);
    store
        .jdbc()
        .update(
            "INSERT INTO"
                + " knowledge(id,title,category,description,difficulty,minutes,importance,x,y,content)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?)",
            id,
            input.title(),
            input.category(),
            input.description(),
            input.difficulty(),
            input.minutes(),
            0.7,
            100 + ((id - 1) % 7) * 150,
            100 + ((id - 1) / 7 % 4) * 150,
            input.content());
    store.audit(auth.user(request).id(), "CREATE_KNOWLEDGE", "knowledgeId=" + id);
    return store.knowledge(id);
  }

  @PutMapping("/knowledge/{id}")
  @Transactional
  Object edit(
      @PathVariable long id, @Valid @RequestBody KnowledgeEdit input, HttpServletRequest request) {
    auth.staff(request);
    store.knowledge(id);
    int changed =
        store
            .jdbc()
            .update(
                "UPDATE knowledge SET"
                    + " title=?,category=?,description=?,difficulty=?,minutes=?,version=version+1"
                    + " WHERE id=? AND version=?",
                input.title(),
                input.category(),
                input.description(),
                input.difficulty(),
                input.minutes(),
                id,
                input.version());
    if (changed == 0) throw new ApiException(409, "知识点已被更新，请刷新后重试");
    store.audit(auth.user(request).id(), "EDIT_KNOWLEDGE", "knowledgeId=" + id);
    return store.knowledge(id);
  }

  @PostMapping("/relations")
  @Transactional
  Object relation(@Valid @RequestBody RelationEdit input, HttpServletRequest request) {
    auth.staff(request);
    // Serializes competing graph edits so two individually valid edges cannot create a cycle
    // together.
    store.jdbc().queryForList("SELECT id FROM knowledge ORDER BY id FOR UPDATE");
    paths.validateRelation(store.knowledge(), store.relations(), input);
    store
        .jdbc()
        .update(
            "INSERT INTO relations(source_id,target_id,type,weight) VALUES(?,?,?,?)",
            input.source(),
            input.target(),
            input.type(),
            input.weight());
    store.audit(auth.user(request).id(), "ADD_RELATION", input.toString());
    return Map.of("message", "关系已保存");
  }

  @DeleteMapping("/relations/{id}")
  @Transactional
  Object deleteRelation(@PathVariable long id, HttpServletRequest request) {
    auth.staff(request);
    if (store.jdbc().update("DELETE FROM relations WHERE id=?", id) == 0)
      throw new ApiException(404, "关系不存在");
    store.audit(auth.user(request).id(), "DELETE_RELATION", "relationId=" + id);
    return Map.of("message", "关系已删除");
  }

  @GetMapping("/management")
  Object management(HttpServletRequest request) {
    auth.staff(request);
    return Map.of(
        "users",
        store.jdbc().queryForList("SELECT id,username,display_name,role FROM users ORDER BY id"),
        "audit",
        store
            .jdbc()
            .queryForList(
                "SELECT action,detail,created_at FROM audit_log ORDER BY id DESC LIMIT 20"),
        "events",
        store.jdbc().queryForObject("SELECT COUNT(*) FROM learning_events", Long.class),
        "model",
        prediction.metrics());
  }
}
