package cn.mathverse.backend.practice.vo;
import cn.mathverse.backend.problem.vo.ProblemListVO;
import java.time.OffsetDateTime;
public record PracticeListItemVO(
        String problemId, int position, String note,
        OffsetDateTime addedAt, OffsetDateTime updatedAt,
        ProblemListVO problem
) {}
