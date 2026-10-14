package cn.mathverse.backend.admin.dto;
import jakarta.validation.constraints.*;
public record AdminSourceCreateRequest(
        @NotBlank @Pattern(regexp="^[a-z0-9-]+$", message="来源代码只能包含小写字母、数字和连字符") @Size(max=64) String code,
        @NotBlank @Size(max=100) String label,
        Integer sortOrder,
        @Pattern(regexp="^(national|provincial|mock|textbook|other)$", message="来源分组不合法") String groupCode,
        Boolean active
) {}
