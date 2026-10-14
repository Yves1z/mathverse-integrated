package cn.mathverse.backend.auth.controller;

import cn.mathverse.backend.auth.dto.*;
import cn.mathverse.backend.auth.service.AuthService;
import cn.mathverse.backend.auth.vo.*;
import cn.mathverse.backend.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken(), token.getHeaderName());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        return authService.register(request, clientIp(servletRequest));
    }

    @PostMapping("/login")
    public AuthMeResponse login(@Valid @RequestBody LoginRequest request,
                                HttpServletRequest servletRequest,
                                HttpServletResponse servletResponse) {
        return authService.login(request, clientIp(servletRequest), servletRequest, servletResponse);
    }

    @GetMapping("/me")
    public AuthMeResponse me(Authentication authentication) {
        return authService.me(authentication);
    }

    @PostMapping("/logout")
    public SimpleMessage logout(HttpServletRequest request) {
        authService.logout(request);
        return new SimpleMessage("已退出登录");
    }

    @PostMapping("/change-password")
    public SimpleMessage changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                        Authentication authentication,
                                        HttpServletRequest servletRequest) {
        authService.changePassword(SecurityUtils.requireUserId(authentication), request, servletRequest);
        return new SimpleMessage("密码修改成功，请重新登录");
    }

    private String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
