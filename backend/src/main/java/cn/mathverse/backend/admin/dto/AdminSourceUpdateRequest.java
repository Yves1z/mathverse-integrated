package cn.mathverse.backend.admin.dto;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
public record AdminSourceUpdateRequest(
        @Size(min=1,max=100) String label,
        Integer sortOrder,
        @Pattern(regexp="^(national|provincial|mock|textbook|other)$", message="来源分组不合法") String groupCode,
        Boolean active
) {}
