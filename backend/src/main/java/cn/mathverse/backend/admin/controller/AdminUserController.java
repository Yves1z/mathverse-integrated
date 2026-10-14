package cn.mathverse.backend.admin.controller;

import cn.mathverse.backend.admin.dto.AdminUserBanRequest;
import cn.mathverse.backend.admin.service.AdminUserService;
import cn.mathverse.backend.admin.vo.AdminUserVO;
import cn.mathverse.backend.auth.vo.SimpleMessage;
import cn.mathverse.backend.common.api.PageResponse;
import cn.mathverse.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final cn.mathverse.backend.admin.editorial.EditorialService editorial;
    private final AdminUserService service;

    @GetMapping
    public PageResponse<AdminUserVO> list(@RequestParam(required=false) String keyword,
                                          @RequestParam(defaultValue="1") int page,
                                          @RequestParam(defaultValue="20") int pageSize) {
        return service.list(keyword, page, pageSize);
    }

    @PatchMapping("/{publicId}/ban")
    public AdminUserVO ban(@PathVariable String publicId, @Valid @RequestBody AdminUserBanRequest request, Authentication auth) {
        editorial.manager(SecurityUtils.requireUserId(auth));
        return service.setBanned(SecurityUtils.requireUserId(auth), publicId, request.banned());
    }

    @DeleteMapping("/{publicId}")
    public SimpleMessage delete(@PathVariable String publicId, Authentication auth) {
        editorial.manager(SecurityUtils.requireUserId(auth));
        service.delete(SecurityUtils.requireUserId(auth), publicId);
        return new SimpleMessage("用户已删除");
    }
}
