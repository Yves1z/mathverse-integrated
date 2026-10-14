# Mathverse 莫比乌斯小兽

2026-10-12：用户确认采用莫比乌斯小兽草图作为 Mathverse 的正式角色。

身体是一条柔软的连续扭转环带；脸直接位于带子上。保留铅笔与水彩的手绘质感，使用靛蓝、暖白和杏黄色。不要替换成普通动物、机器人或只有无穷符号的图标。

- 首页：小兽与 Mathverse 标题共同组成品牌区域；手机上改为上下排列。
- AI 学习助手：小兽本身是可拖动的悬浮入口，收起后从边缘探出。面板采用柔和圆角、暖白底与靛蓝／杏黄的标题区域，小兽出现在标题、欢迎状态及等待响应时。
- 等待响应时仅做轻微摆动，遵循系统减少动态效果偏好。头像和装饰不改变上下文、教学策略或响应标记。

共用组件：`frontend/src/components/brand/MathverseMascot.vue`。
透明素材：`frontend/src/assets/brand/mobius-beast.png`，由 imagegen 从批准的草图中提取。
批准草图：`mobius-beast-concept.png`。

## 素材生成记录

使用内置 imagegen 编辑工具，输入为批准的草图，要求透明背景。最终提示词：

> Edit target: attached approved Mathverse Möbius creature concept sheet. Extract ONLY the large main creature on the left into a standalone transparent-background website mascot asset. Preserve its exact approved identity, silhouette, pose, ribbon folds and twist, face proportions, oval black eyes with glints, small smile, warm-white outer ribbon, indigo shaded folds, apricot accents, and delicate hand-drawn pencil and watercolor texture. Keep its original three-quarter-view pose and whole body fully visible, centered with a small even transparent margin. Transparent alpha background, including the hollow loop opening. Remove paper background, all titles, all arrows, palette swatches, little study poses, and ground pencil shadow. Do not redesign, do not add ears, feet or accessories, do not make 3D, do not simplify it into a generic infinity symbol. Single isolated mascot only, no text, no watermark. Make the existing contour readable at small UI sizes while preserving the drawing.

## 验证

2026-10-12 后续加入五种动作与实际 UI 状态切换；详见 [动态设计](MOBIUS_MOTION.md)。原始批准草图与透明 PNG 继续保留，网页动画使用透明 WebP 姿态。

生产前端构建、现有 AI 助手浏览器回归和首页随机选题回归通过。人工查看电脑首页／面板与手机截图；390px、320px 宽度没有横向溢出，首页小兽入口位于底栏上方，素材正常加载，无页面运行错误。本次仅更新本机源码，未发布到线上。
