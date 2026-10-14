package cn.mathverse.backend.practice;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.mathverse.backend.common.exception.BusinessException;
import cn.mathverse.backend.practice.dto.PracticeListDisplayUpdateRequest;
import cn.mathverse.backend.practice.service.PracticeListDisplayService;
import cn.mathverse.backend.practice.vo.PracticeListDisplaySettingsVO;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
class PracticeListDisplayIntegrationTest {
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

  @Autowired PracticeListDisplayService service;
  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;

  @BeforeEach
  void restoreSeededRow() {
    db.update(
        "UPDATE practice_list_display_settings SET heading='官方题单',"
            + " description='由数海首位用户负责维护，所有人均可查看和打印。',"
            + " base_color='#dbe9f7', progress_color='#a9c9e8', text_color='#123047',"
            + " bar_height=40, blend_percent=8, sort_direction='asc', show_problem_count=TRUE"
            + " WHERE id=1");
  }

  @Test
  void migrationSeedsDefaultChartSettings() {
    PracticeListDisplaySettingsVO settings = service.get();
    assertEquals("官方题单", settings.heading());
    assertEquals("#dbe9f7", settings.baseColor());
    assertEquals("#a9c9e8", settings.progressColor());
    assertEquals("#123047", settings.textColor());
    assertEquals(40, settings.barHeight());
    assertEquals(8, settings.blendPercent());
    assertEquals("asc", settings.sortDirection());
    assertTrue(settings.showProblemCount());
  }

  @Test
  void savedSettingsAreReadBackAndAudited() {
    long admin = admin("display" + UUID.randomUUID().toString().substring(0, 8));
    long before = auditCount();

    PracticeListDisplaySettingsVO saved =
        service.update(
            admin,
            new PracticeListDisplayUpdateRequest(
                "  精选官方题单  ", "  每周更新  ", "#E3EEF9", "#5B8FC4", "#0F2A3F", 52, 12, "desc",
                false));

    assertEquals("精选官方题单", saved.heading());
    assertEquals("每周更新", saved.description());
    assertEquals("#5B8FC4", saved.progressColor());
    assertEquals(52, saved.barHeight());
    assertEquals(12, saved.blendPercent());
    assertEquals("desc", saved.sortDirection());
    assertFalse(saved.showProblemCount());

    // 重新读取确认写库，而不是只在内存里生效。
    PracticeListDisplaySettingsVO reloaded = service.get();
    assertEquals("精选官方题单", reloaded.heading());
    assertEquals(52, reloaded.barHeight());
    assertEquals("desc", reloaded.sortDirection());
    assertFalse(reloaded.showProblemCount());
    assertEquals(before + 1, auditCount());
  }

  @Test
  void invalidSettingsAreRejected() {
    long admin = admin("invalid" + UUID.randomUUID().toString().substring(0, 8));

    assertBadRequest(() -> service.update(admin, request("#zzzzzz", 40, 8, "asc", "官方题单", "说明")));
    assertBadRequest(() -> service.update(admin, request("#123456", 10, 8, "asc", "官方题单", "说明")));
    assertBadRequest(() -> service.update(admin, request("#123456", 200, 8, "asc", "官方题单", "说明")));
    assertBadRequest(() -> service.update(admin, request("#123456", 40, 99, "asc", "官方题单", "说明")));
    assertBadRequest(() -> service.update(admin, request("#123456", 40, 8, "sideways", "官方题单", "说明")));
    assertBadRequest(() -> service.update(admin, request("#123456", 40, 8, "asc", "   ", "说明")));
    assertBadRequest(
        () -> service.update(admin, request("#123456", 40, 8, "asc", "官方题单", "字".repeat(201))));

    // 非法请求不会写坏已保存的配置。
    assertEquals(40, service.get().barHeight());
  }

  @Test
  void publicEndpointIsReadableWithoutLogin() throws Exception {
    mvc.perform(get("/api/v1/practice-lists/display"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.heading").value("官方题单"))
        .andExpect(jsonPath("$.barHeight").value(40))
        .andExpect(jsonPath("$.showProblemCount").value(true));
  }

  @Test
  void adminEndpointRejectsAnonymousWriters() throws Exception {
    mvc.perform(
            put("/api/v1/admin/practice-list-display")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"heading\":\"官方题单\",\"description\":\"说明\",\"baseColor\":\"#dbe9f7\","
                        + "\"progressColor\":\"#a9c9e8\",\"textColor\":\"#123047\",\"barHeight\":40,"
                        + "\"blendPercent\":8,\"sortDirection\":\"asc\",\"showProblemCount\":true}"))
        .andExpect(status().is4xxClientError());
    assertEquals("#dbe9f7", service.get().baseColor());
  }

  private PracticeListDisplayUpdateRequest request(
      String baseColor,
      int barHeight,
      int blendPercent,
      String sort,
      String heading,
      String description) {
    return new PracticeListDisplayUpdateRequest(
        heading, description, baseColor, "#a9c9e8", "#123047", barHeight, blendPercent, sort, true);
  }

  private void assertBadRequest(org.junit.jupiter.api.function.Executable action) {
    BusinessException error = assertThrows(BusinessException.class, action);
    assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
  }

  private long auditCount() {
    Long count =
        db.queryForObject(
            "SELECT COUNT(*) FROM audit_logs WHERE action='PRACTICE_LIST_DISPLAY_UPDATE'",
            Long.class);
    return count == null ? 0 : count;
  }

  private long admin(String name) {
    Long id =
        db.queryForObject(
            "INSERT INTO users(public_id,uid,username,email,password_hash,role) VALUES"
                + " (?,?,?,?,?,'ADMIN') RETURNING id",
            Long.class,
            UUID.randomUUID(),
            "UID" + UUID.randomUUID().toString().substring(0, 12),
            name,
            name + "@example.test",
            "unused");
    return id;
  }
}
