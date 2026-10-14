package cn.mathverse.backend.practice.vo;

import java.time.OffsetDateTime;

public record PracticeListDisplaySettingsVO(
        String heading,
        String description,
        String baseColor,
        String progressColor,
        String textColor,
        int barHeight,
        int blendPercent,
        String sortDirection,
        boolean showProblemCount,
        OffsetDateTime updatedAt
) {}
