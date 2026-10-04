package io.learnscope;

import jakarta.validation.constraints.*;
import java.util.List;

public final class Domain {
  private Domain() {}

  public record User(long id, String username, String displayName, String role) {}

  public record Knowledge(
      long id,
      String title,
      String category,
      String description,
      int difficulty,
      int minutes,
      double importance,
      double x,
      double y,
      String content,
      int version) {}

  public record Relation(long id, long source, long target, String type, double weight) {}

  public record Mastery(
      double value,
      double lower,
      double upper,
      int attempts,
      int correct,
      int evidenceAttempts,
      int evidenceCorrect,
      int legacyAttempts,
      long seconds,
      double daysSince,
      String evidence) {}

  public record Login(
      @NotBlank @Size(max = 64) String username, @NotBlank @Size(max = 128) String password) {}

  public record Register(
      @NotBlank @Pattern(regexp = "[a-zA-Z0-9_]{3,32}") String username,
      @NotBlank @Size(max = 64) String displayName,
      @NotBlank @Size(min = 10, max = 128) String password) {}

  public record Study(@Min(1) long knowledgeId, @Min(10) @Max(1800) int seconds) {}

  public record PathRequest(
      @Min(1) long targetId,
      @Min(10) @Max(480) int budgetMinutes,
      @DecimalMin("0.6") @DecimalMax("0.95") double threshold) {}

  public record Forecast(
      @Min(1) long knowledgeId,
      @Min(0) @Max(180) int plannedMinutes,
      @Min(0) @Max(30) int horizonDays) {}

  public record QuizStart(@Min(1) long knowledgeId) {}

  public record QuizAnswer(
      @NotBlank String assessmentId, @NotNull @Size(min = 1, max = 10) List<Integer> answers) {}

  public record KnowledgeEdit(
      @NotBlank @Size(max = 100) String title,
      @NotBlank @Size(max = 64) String category,
      @NotBlank @Size(max = 1000) String description,
      @Min(1) @Max(10) int difficulty,
      @Min(5) @Max(240) int minutes,
      @Min(1) int version) {}

  public record KnowledgeCreate(
      @NotBlank @Size(max = 100) String title,
      @NotBlank @Size(max = 64) String category,
      @NotBlank @Size(max = 1000) String description,
      @Min(1) @Max(10) int difficulty,
      @Min(5) @Max(240) int minutes,
      @NotBlank @Size(max = 20000) String content) {}

  public record RelationEdit(
      @Min(1) long source,
      @Min(1) long target,
      @NotBlank @Pattern(regexp = "PREREQUISITE|RELATED|PART_OF") String type,
      @DecimalMin("0.1") @DecimalMax("1.0") double weight) {}
}
