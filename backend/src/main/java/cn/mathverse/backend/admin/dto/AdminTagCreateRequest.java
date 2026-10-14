package cn.mathverse.backend.admin.dto;
import jakarta.validation.constraints.*;
public record AdminTagCreateRequest(@NotBlank @Size(max=100) String name, Integer sortOrder, Boolean active) {}
