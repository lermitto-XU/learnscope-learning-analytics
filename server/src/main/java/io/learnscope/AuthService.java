package io.learnscope;

import static io.learnscope.Domain.*;

import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final Store store;
  private final boolean secure;
  private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
  private final SecureRandom random = new SecureRandom();
  private final Map<String, Deque<Long>> failures = new LinkedHashMap<>();

  public AuthService(Store store, @Value("${app.secure-cookie}") boolean secure) {
    this.store = store;
    this.secure = secure;
  }

  public String hashPassword(String password) {
    return passwords.encode(password);
  }

  static String digest(String text) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

  private String token() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return HexFormat.of().formatHex(bytes);
  }

  public Map<String, Object> login(
      Login input, HttpServletRequest request, HttpServletResponse response) {
    String key = request.getRemoteAddr() + ":" + input.username();
    synchronized (failures) {
      if (failures.size() > 512) failures.remove(failures.keySet().iterator().next());
      var recent = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
      recent.removeIf(t -> t < System.currentTimeMillis() - 600_000);
      if (recent.size() >= 8) throw new ApiException(429, "登录尝试过多，请十分钟后重试");
    }
    var rows = store.jdbc().queryForList("SELECT * FROM users WHERE username=?", input.username());
    String hash =
        rows.isEmpty()
            ? "$2a$12$p7ppDeoYHHah/jTdKnCKAOueLy33lVlIvWbiocBCOYrnUB.NVXWt6"
            : (String) rows.getFirst().get("password_hash");
    boolean valid = passwords.matches(input.password(), hash);
    if (rows.isEmpty() || !valid) {
      synchronized (failures) {
        failures.get(key).add(System.currentTimeMillis());
      }
      throw new ApiException(401, "用户名或密码不正确");
    }
    synchronized (failures) {
      failures.remove(key);
    }
    invalidate(request);
    var row = rows.getFirst();
    User user =
        new User(
            ((Number) row.get("id")).longValue(),
            (String) row.get("username"),
            (String) row.get("display_name"),
            (String) row.get("role"));
    String raw = token(), csrf = token();
    store.jdbc().update("DELETE FROM sessions WHERE expires_at<?", System.currentTimeMillis());
    store
        .jdbc()
        .update(
            "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)",
            digest(raw),
            user.id(),
            csrf,
            System.currentTimeMillis() + 28_800_000);
    response.addHeader("Set-Cookie", cookie(raw, 28_800).toString());
    store.audit(user.id(), "LOGIN", "登录成功");
    return Map.of("user", user, "csrf", csrf);
  }

  public void register(Register input) {
    store
        .jdbc()
        .update(
            "INSERT INTO users(username,display_name,password_hash,role,created_at)"
                + " VALUES(?,?,?,?,?)",
            input.username(),
            input.displayName(),
            hashPassword(input.password()),
            "STUDENT",
            System.currentTimeMillis());
  }

  private ResponseCookie cookie(String value, long seconds) {
    return ResponseCookie.from("learnscope_session", value)
        .httpOnly(true)
        .secure(secure)
        .sameSite("Strict")
        .path("/")
        .maxAge(seconds)
        .build();
  }

  private String rawCookie(HttpServletRequest request) {
    if (request.getCookies() == null) return null;
    return Arrays.stream(request.getCookies())
        .filter(c -> c.getName().equals("learnscope_session"))
        .map(Cookie::getValue)
        .findFirst()
        .orElse(null);
  }

  public Map<String, Object> session(HttpServletRequest request) {
    String raw = rawCookie(request);
    if (raw == null || !raw.matches("[0-9a-f]{64}")) throw new ApiException(401, "请先登录");
    var rows =
        store
            .jdbc()
            .queryForList(
                "SELECT u.id,u.username,u.display_name,u.role,s.csrf FROM sessions s JOIN users u"
                    + " ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
                digest(raw),
                System.currentTimeMillis());
    if (rows.isEmpty()) throw new ApiException(401, "登录已过期，请重新登录");
    var row = rows.getFirst();
    return Map.of(
        "user",
        new User(
            ((Number) row.get("id")).longValue(),
            (String) row.get("username"),
            (String) row.get("display_name"),
            (String) row.get("role")),
        "csrf",
        row.get("csrf"));
  }

  public User user(HttpServletRequest request) {
    return (User) request.getAttribute("user");
  }

  public void staff(HttpServletRequest request) {
    if (!Set.of("TEACHER", "ADMIN").contains(user(request).role()))
      throw new ApiException(403, "需要教师或管理员权限");
  }

  private void invalidate(HttpServletRequest request) {
    String raw = rawCookie(request);
    if (raw != null) store.jdbc().update("DELETE FROM sessions WHERE token_hash=?", digest(raw));
  }

  public void logout(HttpServletRequest request, HttpServletResponse response) {
    invalidate(request);
    response.addHeader("Set-Cookie", cookie("", 0).toString());
  }
}
