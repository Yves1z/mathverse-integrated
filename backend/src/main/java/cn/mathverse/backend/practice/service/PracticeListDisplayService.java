package cn.mathverse.backend.practice.service;

import cn.mathverse.backend.admin.service.AuditLogService;
import cn.mathverse.backend.common.exception.BusinessException;
import cn.mathverse.backend.practice.dto.PracticeListDisplayUpdateRequest;
import cn.mathverse.backend.practice.entity.PracticeListDisplaySettings;
import cn.mathverse.backend.practice.mapper.PracticeListDisplaySettingsMapper;
import cn.mathverse.backend.practice.vo.PracticeListDisplaySettingsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PracticeListDisplayService {
    private static final short SETTINGS_ID = 1;
    private static final Pattern COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$");

    private final PracticeListDisplaySettingsMapper mapper;
    private final AuditLogService audit;

    public PracticeListDisplaySettingsVO get() {
        PracticeListDisplaySettings settings = mapper.selectById(SETTINGS_ID);
        if (settings == null) {
            throw BusinessException.notFound("DISPLAY_SETTINGS_MISSING", "题单展示配置尚未初始化");
        }
        return toVo(settings);
    }

    @Transactional
    public PracticeListDisplaySettingsVO update(Long actorUserId, PracticeListDisplayUpdateRequest request) {
        PracticeListDisplaySettings settings = mapper.selectById(SETTINGS_ID);
        if (settings == null) {
            throw BusinessException.notFound("DISPLAY_SETTINGS_MISSING", "题单展示配置尚未初始化");
        }
        String heading = requireText(request.heading(), 60, "标题");
        String description = request.description() == null ? "" : request.description().trim();
        if (description.length() > 200) {
            throw BusinessException.badRequest("DISPLAY_DESCRIPTION_TOO_LONG", "说明文字不能超过 200 个字符");
        }
        String baseColor = requireColor(request.baseColor(), "未完成颜色");
        String progressColor = requireColor(request.progressColor(), "已完成颜色");
        String textColor = requireColor(request.textColor(), "文字颜色");
        int barHeight = requireRange(request.barHeight(), 20, 120, "条形高度");
        int blendPercent = requireRange(request.blendPercent(), 0, 30, "过渡宽度");
        String sortDirection = request.sortDirection();
        if (!"asc".equals(sortDirection) && !"desc".equals(sortDirection)) {
            throw BusinessException.badRequest("DISPLAY_SORT_INVALID", "排序方向只能是 asc 或 desc");
        }
        settings.setHeading(heading);
        settings.setDescription(description);
        settings.setBaseColor(baseColor);
        settings.setProgressColor(progressColor);
        settings.setTextColor(textColor);
        settings.setBarHeight(barHeight);
        settings.setBlendPercent(blendPercent);
        settings.setSortDirection(sortDirection);
        settings.setShowProblemCount(Boolean.TRUE.equals(request.showProblemCount()));
        settings.setUpdatedAt(OffsetDateTime.now());
        settings.setUpdatedBy(actorUserId);
        mapper.updateById(settings);
        audit.log(actorUserId, "PRACTICE_LIST_DISPLAY_UPDATE", "practice_list_display_settings", "1",
                "baseColor=" + baseColor + ",progressColor=" + progressColor + ",textColor=" + textColor
                        + ",barHeight=" + barHeight + ",blendPercent=" + blendPercent
                        + ",sortDirection=" + sortDirection
                        + ",showProblemCount=" + settings.getShowProblemCount());
        return toVo(settings);
    }

    private static String requireText(String value, int max, String label) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) {
            throw BusinessException.badRequest("DISPLAY_TEXT_EMPTY", label + "不能为空");
        }
        if (text.length() > max) {
            throw BusinessException.badRequest("DISPLAY_TEXT_TOO_LONG", label + "不能超过 " + max + " 个字符");
        }
        return text;
    }

    private static String requireColor(String value, String label) {
        String color = value == null ? "" : value.trim();
        if (!COLOR.matcher(color).matches()) {
            throw BusinessException.badRequest("DISPLAY_COLOR_INVALID", label + "必须是 #RRGGBB 或 #RRGGBBAA");
        }
        return color;
    }

    private static int requireRange(Integer value, int min, int max, String label) {
        if (value == null || value < min || value > max) {
            throw BusinessException.badRequest("DISPLAY_RANGE_INVALID", label + "必须在 " + min + " 到 " + max + " 之间");
        }
        return value;
    }

    private static PracticeListDisplaySettingsVO toVo(PracticeListDisplaySettings settings) {
        return new PracticeListDisplaySettingsVO(
                settings.getHeading(),
                settings.getDescription() == null ? "" : settings.getDescription(),
                settings.getBaseColor(),
                settings.getProgressColor(),
                settings.getTextColor(),
                Objects.requireNonNullElse(settings.getBarHeight(), 40),
                Objects.requireNonNullElse(settings.getBlendPercent(), 8),
                "desc".equals(settings.getSortDirection()) ? "desc" : "asc",
                Boolean.TRUE.equals(settings.getShowProblemCount()),
                settings.getUpdatedAt());
    }
}
