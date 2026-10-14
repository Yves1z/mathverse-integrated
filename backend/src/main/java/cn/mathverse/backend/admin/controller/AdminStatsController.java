package cn.mathverse.backend.admin.controller;

import cn.mathverse.backend.admin.service.AdminStatsService;
import cn.mathverse.backend.admin.vo.AdminStatsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminStatsController {
    private final AdminStatsService service;

    @GetMapping("/stats")
    public AdminStatsVO stats() {
        return service.stats();
    }
}
