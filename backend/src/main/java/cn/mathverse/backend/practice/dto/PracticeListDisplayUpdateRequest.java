package cn.mathverse.backend.practice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PracticeListDisplayUpdateRequest(
        @NotBlank @Size(max = 60) String heading,
        @NotNull @Size(max = 200) String description,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String baseColor,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String progressColor,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$") String textColor,
        @NotNull @Min(20) @Max(120) Integer barHeight,
        @NotNull @Min(0) @Max(30) Integer blendPercent,
        @NotBlank @Pattern(regexp = "asc|desc") String sortDirection,
        @NotNull Boolean showProblemCount
) {}
