package cn.mathverse.backend.practice;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.mathverse.backend.practice.service.PracticeListService;
import cn.mathverse.backend.practice.vo.PracticeListStatsVO;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "logging.level.root=WARN",
      "logging.level.org.springframework=WARN",
      "debug=false",
      "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.session.SessionAutoConfiguration"
    })
@AutoConfigureMockMvc
class PracticeListStatsIntegrationTest {
  static EmbeddedPostgres postgres;

  static {
    try {
      postgres = EmbeddedPostgres.builder().setPort(0).start();
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
    r.add("spring.datasource.username", () -> "postgres");
    r.add("spring.datasource.password", () -> "");
    r.add("mathverse.storage.root", () -> "target/editorial-test-uploads");
  }

  @Autowired PracticeListService service;
  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;

  @Test
  void countsPublicListsContributorsAndTotal() {
    // 库里第一个用户会触发 V3 的触发器自动创建「官方起步题单」，
    // 先用一个占位用户把它消耗掉，再读基线，增量才稳定。
    user("stats-primer");

    // 其他测试类可能共用同一个库，因此这里比较增量而不是绝对值。
    PracticeListStatsVO before = service.publicStats();

    long alice = user("stats-alice");
    long bob = user("stats-bob");
    insertList(alice, true, true);
    insertList(alice, true, false);
    insertList(bob, true, false);
    insertList(bob, false, false);

    PracticeListStatsVO after = service.publicStats();

    // 公开题单只统计 is_public 的 3 份。
    assertEquals(before.publicListCount() + 3, after.publicListCount());
    // 贡献者按创建者去重：alice 两份只算一个人。
    assertEquals(before.publicContributorCount() + 2, after.publicContributorCount());
    // 累计创建包含私密题单。
    assertEquals(before.totalListCount() + 4, after.totalListCount());
  }

  @Test
  void publicEndpointIsReadableWithoutLogin() throws Exception {
    mvc.perform(get("/api/v1/practice-lists/stats"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.publicListCount").isNumber())
        .andExpect(jsonPath("$.publicContributorCount").isNumber())
        .andExpect(jsonPath("$.totalListCount").isNumber());
  }

  private void insertList(long userId, boolean isPublic, boolean isOfficial) {
    db.update(
        "INSERT INTO practice_lists(public_id,user_id,title,description,is_default,is_public,is_official)"
            + " VALUES (?,?,?,'',FALSE,?,?)",
        UUID.randomUUID(),
        userId,
        "统计题单" + UUID.randomUUID().toString().substring(0, 6),
        isPublic,
        isOfficial);
  }

  private long user(String name) {
    Long id =
        db.queryForObject(
            "INSERT INTO users(public_id,uid,username,email,password_hash,role) VALUES"
                + " (?,?,?,?,?,'USER') RETURNING id",
            Long.class,
            UUID.randomUUID(),
            "UID" + UUID.randomUUID().toString().substring(0, 12),
            name + UUID.randomUUID().toString().substring(0, 6),
            name + "@example.test",
            "unused");
    return id;
  }
}
