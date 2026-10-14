package cn.mathverse.backend.admin.controller;

import cn.mathverse.backend.practice.dto.PracticeListDisplayUpdateRequest;
import cn.mathverse.backend.practice.service.PracticeListDisplayService;
import cn.mathverse.backend.practice.vo.PracticeListDisplaySettingsVO;
import cn.mathverse.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/practice-list-display")
@RequiredArgsConstructor
public class AdminPracticeListDisplayController {
    private final PracticeListDisplayService service;

    @GetMapping
    public PracticeListDisplaySettingsVO get() {
        return service.get();
    }

    @PutMapping
    public PracticeListDisplaySettingsVO update(
            @Valid @RequestBody PracticeListDisplayUpdateRequest request, Authentication auth) {
        return service.update(SecurityUtils.requireUserId(auth), request);
    }
}
