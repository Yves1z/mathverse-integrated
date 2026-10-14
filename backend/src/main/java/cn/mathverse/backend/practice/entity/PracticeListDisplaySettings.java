package cn.mathverse.backend.practice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("practice_list_display_settings")
public class PracticeListDisplaySettings {
    @TableId(type = IdType.INPUT) private Short id;
    private String heading;
    private String description;
    @TableField("base_color") private String baseColor;
    @TableField("progress_color") private String progressColor;
    @TableField("text_color") private String textColor;
    @TableField("bar_height") private Integer barHeight;
    @TableField("blend_percent") private Integer blendPercent;
    @TableField("sort_direction") private String sortDirection;
    @TableField("show_problem_count") private Boolean showProblemCount;
    @TableField("updated_at") private OffsetDateTime updatedAt;
    @TableField("updated_by") private Long updatedBy;
}
