package cn.mathverse.backend.problem.service;

import cn.mathverse.backend.common.exception.BusinessException;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProblemSourceCatalogService {
  private static final Map<String, String> PROVINCES = provinces();
  private final JdbcTemplate db;

  public Optional<String> resolveCode(String value) {
    String input = Objects.toString(value, "").trim();
    if (input.isBlank()) return Optional.empty();

    var direct =
        db.queryForList(
            "SELECT code FROM problem_sources WHERE active=true AND (code=? OR lower(label)=lower(?)) ORDER BY code LIMIT 1",
            input,
            input);
    if (!direct.isEmpty()) return Optional.of(direct.getFirst().get("code").toString());

    String key = aliasKey(input);
    var alias =
        db.queryForList(
            "SELECT a.source_code FROM problem_source_aliases a JOIN problem_sources s ON s.code=a.source_code WHERE a.alias_key=? AND s.active=true LIMIT 1",
            key);
    if (!alias.isEmpty()) return Optional.of(alias.getFirst().get("source_code").toString());

    String inferred = inferCode(key);
    if (inferred == null) return Optional.empty();
    Long active =
        db.queryForObject(
            "SELECT count(*) FROM problem_sources WHERE code=? AND active=true", Long.class, inferred);
    return active != null && active > 0 ? Optional.of(inferred) : Optional.empty();
  }

  public String requireCode(String value) {
    return resolveCode(value)
        .orElseThrow(
            () ->
                BusinessException.badRequest(
                    "INVALID_SOURCE", "无法识别题目来源：" + Objects.toString(value, "") + "。请从来源目录选择规范来源"));
  }

  public String label(String code) {
    var rows = db.queryForList("SELECT label FROM problem_sources WHERE code=?", code);
    if (rows.isEmpty())
      throw BusinessException.badRequest("INVALID_SOURCE", "题目来源不存在或已停用");
    return rows.getFirst().get("label").toString();
  }

  static String aliasKey(String value) {
    return Normalizer.normalize(Objects.toString(value, ""), Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[\\s·•._()（）【】\\[\\]—_-]+", "");
  }

  private String inferCode(String key) {
    if (key.matches(".*(模拟|一模|二模|三模|联考|月考|校考|诊断|摸底).*")) return "mock";
    if (key.contains("新高考")) {
      if (key.matches(".*新高考(二|2|ii)(卷)?.*")) return "national-new-2";
      if (key.matches(".*新高考(一|1|i)(卷)?.*")) return "national-new-1";
    }
    if (key.contains("新课标")) {
      if (key.matches(".*新课标(二|2|ii)(卷)?.*")) return "national-curriculum-2";
      if (key.matches(".*新课标(一|1|i)(卷)?.*")) return "national-curriculum-1";
    }
    if (key.matches(".*全国甲(卷)?.*")) return "national-a";
    if (key.matches(".*全国乙(卷)?.*")) return "national-b";
    if (key.matches(".*全国(三|3|iii)(卷)?.*")) return "national-3";
    if (key.matches(".*全国(二|2|ii)(卷)?.*")) return "national-2";
    if (key.matches(".*全国(一|1|i)(卷)?.*")) return "national-1";
    for (var province : PROVINCES.entrySet()) {
      if (key.contains(province.getKey())) return province.getValue();
    }
    return null;
  }

  private static Map<String, String> provinces() {
    Map<String, String> values = new LinkedHashMap<>();
    values.put("黑龙江", "gaokao-heilongjiang");
    values.put("内蒙古", "gaokao-neimenggu");
    values.put("北京", "gaokao-beijing");
    values.put("天津", "gaokao-tianjin");
    values.put("上海", "gaokao-shanghai");
    values.put("浙江", "gaokao-zhejiang");
    values.put("江苏", "gaokao-jiangsu");
    values.put("海南", "gaokao-hainan");
    values.put("山东", "gaokao-shandong");
    values.put("广东", "gaokao-guangdong");
    values.put("福建", "gaokao-fujian");
    values.put("湖北", "gaokao-hubei");
    values.put("湖南", "gaokao-hunan");
    values.put("河北", "gaokao-hebei");
    values.put("辽宁", "gaokao-liaoning");
    values.put("重庆", "gaokao-chongqing");
    values.put("四川", "gaokao-sichuan");
    values.put("安徽", "gaokao-anhui");
    values.put("江西", "gaokao-jiangxi");
    values.put("山西", "gaokao-shanxi");
    values.put("陕西", "gaokao-shaanxi");
    values.put("河南", "gaokao-henan");
    values.put("吉林", "gaokao-jilin");
    values.put("广西", "gaokao-guangxi");
    values.put("贵州", "gaokao-guizhou");
    values.put("云南", "gaokao-yunnan");
    values.put("西藏", "gaokao-xizang");
    values.put("甘肃", "gaokao-gansu");
    values.put("青海", "gaokao-qinghai");
    values.put("宁夏", "gaokao-ningxia");
    values.put("新疆", "gaokao-xinjiang");
    return Map.copyOf(values);
  }
}
