package io.learnscope;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ErrorAdvice {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> known(ApiException error) {
    return ResponseEntity.status(error.status).body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class,
    IllegalArgumentException.class
  })
  ResponseEntity<?> validation(Exception error) {
    return ResponseEntity.badRequest().body(Map.of("message", "输入格式不正确，请检查字段与取值范围"));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict(Exception error) {
    return ResponseEntity.status(409).body(Map.of("message", "数据已存在或关联对象无效"));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected(Exception error) {
    org.slf4j.LoggerFactory.getLogger(getClass()).error("Request failed", error);
    return ResponseEntity.internalServerError().body(Map.of("message", "服务暂时无法完成请求，请稍后重试"));
  }
}
