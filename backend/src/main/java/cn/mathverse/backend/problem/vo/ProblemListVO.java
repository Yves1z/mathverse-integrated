package cn.mathverse.backend.problem.vo;

import java.util.List;

public record ProblemListVO(
    String id,
    String title,
    String detail,
    Integer year,
    String source,
    String sourceLabel,
    String type,
    String typeLabel,
    String level,
    List<String> tags,
    String sourceText,
    String content,
    String contentFormat,
    List<ProblemAssetVO> assets,
    ProblemStatsVO stats,
    ViewerStateVO viewerState,
    cn.mathverse.backend.curriculum.CurriculumAnnotation curriculum) {}
