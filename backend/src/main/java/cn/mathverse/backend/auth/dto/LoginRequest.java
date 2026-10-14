package cn.mathverse.backend.auth.dto;
import jakarta.validation.constraints.NotBlank;
public record LoginRequest(@NotBlank String account, @NotBlank String password) {}
