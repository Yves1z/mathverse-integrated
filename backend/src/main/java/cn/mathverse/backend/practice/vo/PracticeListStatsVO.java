package cn.mathverse.backend.practice.vo;

/** 「题单」页顶部的概况数字。 */
public record PracticeListStatsVO(
        long publicListCount,
        long publicContributorCount,
        long totalListCount
) {}
