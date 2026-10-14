package cn.mathverse.backend.admin.dto;
import jakarta.validation.constraints.NotNull;
public record AdminUserBanRequest(@NotNull Boolean banned) {}
