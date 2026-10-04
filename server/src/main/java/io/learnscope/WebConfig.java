package io.learnscope;

import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final AuthService auth;
  private final Set<String> origins;

  public WebConfig(AuthService auth, @Value("${app.origin}") String origins) {
    this.auth = auth;
    this.origins = new HashSet<>(Arrays.asList(origins.split(",")));
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry
        .addInterceptor(
            new HandlerInterceptor() {
              @Override
              public boolean preHandle(
                  HttpServletRequest request, HttpServletResponse response, Object handler) {
                response.setHeader("Cache-Control", "no-store");
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("X-Frame-Options", "DENY");
                boolean write = !Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
                String origin = request.getHeader("Origin");
                if (write && origin != null && !origins.contains(origin))
                  throw new ApiException(403, "请求来源不受信任");
                if (write
                    && !"DELETE".equals(request.getMethod())
                    && (request.getContentType() == null
                        || !request.getContentType().startsWith("application/json")))
                  throw new ApiException(415, "请使用 JSON 请求");
                if (Set.of("/api/health", "/api/auth/login", "/api/auth/register")
                    .contains(request.getRequestURI())) return true;
                var session = auth.session(request);
                request.setAttribute("user", session.get("user"));
                if (write) {
                  String csrf = request.getHeader("X-CSRF-Token");
                  if (csrf == null
                      || !MessageDigest.isEqual(
                          csrf.getBytes(StandardCharsets.UTF_8),
                          session.get("csrf").toString().getBytes(StandardCharsets.UTF_8)))
                    throw new ApiException(403, "会话校验失败，请刷新后重试");
                }
                return true;
              }
            })
        .addPathPatterns("/api/**");
  }
}
