# Mathverse 阶段 A 交付记录

日期：2026-10-09。状态：空间与交互骨架完成，可在桌面浏览器体验。

## 体验与启动

项目：D:\Mathverse。开发预览：http://127.0.0.1:5184/ 。预览只在本机运行，终端关闭后需重新启动。

```powershell
. D:\Mathverse\Enter-Environment.ps1
npm run dev
```

点击中央门或“推门，进入”按钮，镜头穿过真正的三维门洞进入空间。进入后，按住鼠标左键拖拽环顾；“暂停旅程”控制位移，“看向前方”恢复朝向。

## 本阶段实现

- 白色空间与中央实体门，门绕侧面铰链向内部打开，镜头连续穿过门洞。
- 三轴结构、重复格栅、纵深层次、稀疏暖色光片及几何占位对象。疏密交替的区域使空间在前进中发生变化。
- 位移沿独立路径持续向深处前进，拖拽只改变视角。允许回望，保持眼高，不产生镜头侧倾。
- 拖拽采用基础平滑阻尼；真正的弹簧响应、细致边界和入场节奏留待阶段 B。
- 暂停与恢复位移；页面失焦或隐藏时挂起推进，避免返回后突然跳跃。偏好减少动态效果的访客进入后默认暂停位移。
- 沿路径维护有限数量的结构区块，采用实例化绘制；配置、场景、镜头与界面分开，便于下一阶段迭代。

这是独立的主页原型，尚未接入正式 mathweb 首页。正式网站业务代码与依赖文件未改动。现阶段不包含数学内容阅读模式。

## 文件与参数

| 文件 | 作用 |
|---|---|
| src/mathverse/MathverseHome.tsx | 页面入口、阶段状态与操作界面 |
| src/mathverse/motion/CameraDirector.tsx | 唯一镜头控制器，分离前进和环顾 |
| src/mathverse/scene/WhiteEntrance.tsx | 白色门前与真实门洞 |
| src/mathverse/scene/Door.tsx | 实体门及开门动画 |
| src/mathverse/scene/StructureField.tsx | 有限区块的结构空间与占位对象 |
| src/mathverse/scene/Lighting.tsx | 基础灯光 |
| src/mathverse/config/motion.ts | 眼高、速度、入场时间与拖拽参数 |
| src/mathverse/config/visual.ts | 配色、结构尺度与雾参数 |
| scripts/entrance/stage-a.browser.test.mjs | 阶段 A 浏览器功能验证与截图 |

当前探索速度为每秒 0.35 个场景单位，眼高 1.55，视野 55 度。开门时间 1.6 秒，镜头入场 3.3 秒，入场延迟 0.55 秒。这些值为可调原型参数，阶段 B 会根据体验继续打磨。

## 验证结果

TypeScript 与生产构建通过。Edge 154.0.4258.62 的 1920×1080 和 1280×720 浏览器功能检查通过，无捕获到的页面错误或控制台错误。

| 检查 | 结果 |
|---|---|
| 门前进入探索状态 | 通过 |
| 相机自动前进 | 通过，采样距离从 0.176 增至 0.482 |
| 暂停后距离不变 | 通过 |
| 拖拽独立改变视角 | 通过，路径横坐标与眼高保持不变 |
| 向后回望 | 通过 |
| 恢复前方与继续前进 | 通过 |
| 两种桌面尺寸的操作界面 | 通过 |
| 结构距路径中心线的最小净空 | 2.935，大于设计阈值 2.55 |

一次采样为 17 次绘制调用、58,644 个三角形。此记录用于说明原型场景规模，不代表帧率或完整 GPU 性能验证。长时间前进、资源回收、加载体积与性能预算在阶段 E 验证。

可复查 artifacts/entrance/stage-a/verification.json。截图：

- artifacts/entrance/stage-a/entrance.png：白色门前。
- artifacts/entrance/stage-a/interior-forward.png：进入后的前方结构空间。
- artifacts/entrance/stage-a/interior-side.png：侧面环顾。
- artifacts/entrance/stage-a/interior-back.png：回望入口。
- artifacts/entrance/stage-a/interior-1280.png：较小桌面视口。

## 下一阶段边界

阶段 B 打磨开门与穿越的节奏、弹性扭头、拖拽的柔和边界和回正行为，并录制连续体验片段。

阶段 C 才接入数学对象、停留识别与阅读时的极慢位移。阶段 D 打磨最终灯光、材质和景深层次；阶段 E 完成性能与长时间运行验收。
