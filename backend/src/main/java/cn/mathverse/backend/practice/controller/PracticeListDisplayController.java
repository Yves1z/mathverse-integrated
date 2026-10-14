package cn.mathverse.backend.practice.controller;

import cn.mathverse.backend.practice.service.PracticeListDisplayService;
import cn.mathverse.backend.practice.vo.PracticeListDisplaySettingsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/practice-lists")
@RequiredArgsConstructor
public class PracticeListDisplayController {
    private final PracticeListDisplayService service;

    @GetMapping("/display")
    public PracticeListDisplaySettingsVO display() {
        return service.get();
    }
}
