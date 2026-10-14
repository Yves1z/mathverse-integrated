# 莫比乌斯小兽 · 三种身体姿态

2026-10-12。用户明确喜欢原批准草图右侧的睡觉、好奇与思考设计。本版按这三张小图提取姿态，让状态改变身体的轮廓、立起高度与环带盘绕方式。

| 姿态 | 身体设计 | 素材 |
|---|---|---|
| 睡觉 | 低低摊开，脸贴近地面，环带形成两个舒展的折弯 | `frontend/src/assets/brand/mobius-sleeping-v2.webp` |
| 好奇 | 环带竖直立起，形成细长的开口，脸抬起来看人 | `frontend/src/assets/brand/mobius-curious-v2.webp` |
| 思考 | 环带盘绕成团，前方折带向脸下方卷入，像把自己绕进去 | `frontend/src/assets/brand/mobius-thinking-v2.webp` |

原草图为 `docs/brand/mobius-beast-concept.png`。三张新姿态使用内置 imagegen 从原草图直接编辑生成，随后导出保持透明背景与原画布尺寸的 WebP。三个 WebP 合计约 1.08 MiB。原始 PNG 与旧版姿态均保留，不覆盖。

共用组件将好奇映射到独立的竖起姿态，思考与休息使用新的身体姿态；待机眨眼仍使用原轮廓的闭眼帧。保持原有请求、取消、错误和休息唤醒的 UI 状态规则。睡觉时仅做轻微呼吸，好奇时轻轻伸展探头，思考时轻微扭动；所有状态切换使用短暂淡入淡出。

## 本版验证

组件编译、前端构建和修改组件的 ESLint 检查通过。实际预览确认好奇、思考、睡觉都使用对应的 v2 身体素材；已查看三张大姿态及手机页面。交互检查覆盖独立眨眼层（休息姿态在眨眼时仍隐藏）、60 秒后休息、靠近与输入唤醒、等待回复时思考、正常回复时回应，以及取消／错误不触发回应。390px、320px 视口无横向溢出，入口避开首页底栏，系统减少动态效果与页面运行检查通过。AI 交互使用 3 次模拟请求，未调用真实模型。更新后的动作视频保存在本次工作区的 `output/mobius-poses-v2/preview/mobius-motion-preview.webm`。本次更新仅写入本机源码。

## 内置 imagegen 提示词

参考输入均为完整的原批准草图。背景设置为透明。

### 睡觉

Edit target: approved Mathverse concept sheet. Extract and faithfully refine ONLY the SLEEPING pose in the UPPER RIGHT of the sheet (the small horizontal creature with closed eyes, above the other two studies). That exact body pose is the design target. The face rests low at the lower left; the body forms a soft low horizontal folded Möbius ribbon with a loop arch rising behind the face and a broad ribbon crossing toward the right. Preserve the distinct two-fold sleeping silhouette and its closed curved pencil eyelids and small peaceful smile, indigo shaded folds, warm-white ribbon surfaces, apricot highlights, graphite contours and watercolor sketch texture. This is the same character as the sheet, in that specific sleeping body shape. Single isolated character, not the large standing ring on the left, not a regular torus with merely closed eyes. No new accessories or limbs. Use a 3:2 transparent canvas, full body visible, centered horizontally, common baseline at 90% canvas height. Let the horizontal character occupy approximately 77% of canvas width with generous transparent space above its low silhouette; do not stretch it vertically to fill the canvas. Remove paper, text, arrows, shadow, other poses and swatches; background and internal openings fully transparent alpha. No glow, no 3D, no text, no scene.

### 好奇

Edit target: approved Mathverse concept sheet. Extract and faithfully refine ONLY the CURIOUS upright pose in the MIDDLE RIGHT of the sheet (the small standing creature below the sleeping study and above the tangled thinking study). That precise body silhouette is the design target. The continuous wide Möbius ribbon stands up into a tall, narrow arched loop with a conspicuous vertically elongated opening; the friendly face is on the rising LEFT front strip, looking up curiously, and a soft fold of the ribbon curls toward the lower right. Preserve the original study's alert erect posture, two small oval eyes, little smile, soft indigo folds, warm white face, apricot accents, graphite edges and watercolor-pencil texture. It must look clearly upright and narrower than the large left resting mascot. Single continuous ribbon creature, no detached head, ears, feet, paws or tail. Use a 3:2 transparent canvas. Place the full upright character centered horizontally on the same baseline at 90% canvas height, occupy around 80% canvas height, leaving ample empty transparent space to both sides. Do not widen or flatten the upright silhouette to fill the frame. Remove paper, other characters, text, all arrows and marks, palette, ground shadow and glow. Background and ribbon hole fully transparent alpha. No question mark, no 3D, no scene.

### 思考

Edit target: approved Mathverse concept sheet. Extract and faithfully refine ONLY the THINKING pose in the LOWER RIGHT of the sheet (the compact coiled creature beneath the upright curious study). That exact distinctive coiled body shape is the target. The broad soft continuous Möbius ribbon coils into a compact bowl-like nest at the base; a rounded face-bearing fold rises from its upper-left side, eyes looking upward in thought; a narrower curled ribbon fold turns inward just beneath the face as if the creature has thoughtfully wrapped itself up. Preserve the nested overlapping ribbon folds and tangled-but-soft silhouette visible in that original study. It must be visibly different from the large simple ring on the left and the tall upright curious study. This is a single living continuous ribbon bending upon itself, not several disconnected bands, not a detached humanoid head or hand. Preserve indigo recessed folds, warm white outer strip, apricot highlights and cheek accents, pencil contours and watercolor texture from the approved sheet, two oval eyes and a tiny smile. Use a 3:2 transparent canvas, full character centered on a common baseline at 90% canvas height, occupy about 75% canvas height with even transparent side margins. Do not untangle it into a simple ring; its coil is the personality of this thinking pose. Remove paper, other poses, text, arrows, swatches, floor shadow and glow. All background and fold openings true transparent alpha. No text, question mark, thought bubble, extra limbs, ears, accessories or 3D render.

