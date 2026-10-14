# 莫比乌斯小兽 · 动态设计

2026-10-12。沿用用户批准的莫比乌斯环带角色，并采用原草图右侧的三种身体姿态：摊低蜷起的睡觉、竖起环带的好奇、盘绕成团的思考。它们与待机和开心回应共同组成五种动作。原始批准形象继续保留，网页素材使用透明 WebP。[三种身体姿态及生成记录](MOBIUS_POSES_V2.md)。

| 状态 | 动作 | 触发 |
|---|---|---|
| 待机 | 4.8 秒轻微呼吸，每 7.4 秒短暂眨眼 | 首页和学习助手待机 |
| 好奇 | 竖起细长的环带，3.2 秒轻轻探头 | 靠近首页品牌区、开始输入、悬浮入口获焦点 |
| 思考 | 把身体盘绕成团，2.8 秒缓缓扭动 | 首页随机选题或实际等待 AI 回复 |
| 回应 | 笑眼、一次 1.8 秒弹起并安静下来 | 新的正常回复到达；错误及含警告／错误定位的回复保持平静 |
| 休息 | 环带摊低蜷起、脸贴近地面、6 秒慢呼吸 | 开启休息的角色连续待机 60 秒；收起的边缘入口 |

窗口隐藏或角色滚出可见区域时暂停动画，系统选择减少动态效果时保留静态表情。计时器、媒体查询监听及可见性监听随组件卸载清理。角色状态仅用于 UI 表现，不改变教学策略、响应结构或验证含义。切换到历史对话不触发开心回应。

素材保存在 `frontend/src/assets/brand/`：待机为 `mobius-idle.webp`，短暂眨眼继续使用 `mobius-sleeping.webp` 的同轮廓闭眼帧；身体姿态为 `mobius-curious-v2.webp`、`mobius-thinking-v2.webp`、`mobius-sleeping-v2.webp`；回应为 `mobius-responding.webp`。眨眼与休息独立，不会因短暂闭眼改变整个身体。旧版素材继续保留。共用组件为 `frontend/src/components/brand/MathverseMascot.vue`。仅本机开发预览提供 `/mascot-preview`，可选择动作或依次演示；生产首页与助手直接使用同一组件。

## 验证记录

Vue 组件编译、生产构建、现有 AI 助手浏览器回归通过。已查看五种动作及手机预览截图，并通过浏览器自带录制功能导出动作视频。实际交互检查覆盖：眨眼时开眼／闭眼层切换，待机 60 秒后休息，靠近及输入时唤醒，等待真实界面请求时思考，正常回复时回应、1.8 秒后恢复，报错／取消不开心回应，以及系统减少动态效果。390px 与 320px 视口无横向溢出，入口在首页底栏上方，无页面运行错误。AI 流程的 3 次请求均为本机模拟回复，未调用真实模型。本次更新本机源码，未发布线上。

## 首版表情生成提示词

输入参考均为已批准的透明 `mobius-beast.png`。全部使用内置 imagegen，透明背景。

### 闭眼

Edit target: the approved transparent Mathverse Möbius beast mascot. Create the CLOSED-EYES expression frame for blinking and gentle sleeping. Change ONLY its two black oval eyes into two delicate closed curved eyelid pencil lines in exactly the same locations; keep its small calm smile. Preserve every other part of the approved character: exact ribbon body outline, broad continuous loop with its half-twist, hollow opening, identical pose, proportions, placement and scale, indigo folds, warm white face, apricot accents and pencil/watercolor texture. This is an aligned animation expression frame, not a redesign or a new body pose. Keep the same 3:2 canvas composition and small margins as the reference, centered, full body visible. Background and hollow opening must be fully transparent alpha. No background, no glow, no floor shadow, no text, no symbols, no new accessories, no ears, paws or tail, no 3D render.

### 思考

Edit target: approved transparent Mathverse Möbius beast mascot. Create a THINKING expression and pose, aligned for a website motion state. Preserve the same lovable character, three-quarter view, face position at left, body size, broad continuous ribbon body with one half-twist, large hollow opening, exact indigo/warm-white/apricot palette, pencil and watercolor texture. Gently flex the upper and front ribbon inward so the central loop becomes slightly more compact and the twist feels tucked in, as if the creature is concentrating; keep the loop continuous, no knot, no limbs. Change the eyes only subtly to a thoughtful upward-looking gaze, keep small calm mouth. Keep the same 3:2 canvas, same center, same approximate outer bounding box and baseline as reference. Full character visible with even margins. True transparent alpha backdrop and loop opening. No question mark, no thought bubble, no glow, no shadow, no text, no accessories, no cat ears, paws or tail, no 3D. This is a coherent alternate animation key pose of the SAME approved mascot.

### 回应

Edit target: approved transparent Mathverse Möbius beast mascot. Create a happy RESPONSE expression frame for when an AI reply arrives. Change primarily the face: two happy crescent eyes following the same diagonal face axis and a small open smiling mouth, subtle friendly delight, not exaggerated. Let the ribbon body lift very slightly with an alert pleasant curve, preserving the continuous broad Möbius loop and half-twist and hollow opening. Preserve exact approved identity, face position on left, body scale and silhouette, indigo folded ribbon, warm-white surfaces, apricot watercolor cheeks and pencil/watercolor sketch texture. Same 3:2 canvas placement, bounding box and baseline as reference, centered full body and even margins so it can transition smoothly with the original. Transparent alpha background and hollow loop, no ground shadow or glow. No confetti, stars, text, question marks, speech bubbles, ears, paws, tail, accessories, or 3D rendering. Single SAME mascot, only a warm responsive expression and tiny pose adjustment.

