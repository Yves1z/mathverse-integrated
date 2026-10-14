package cn.mathverse.backend.auth.vo;
public record AuthMeResponse(boolean authenticated, AuthUserVO user) {}
