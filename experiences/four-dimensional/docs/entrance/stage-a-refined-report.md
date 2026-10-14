# 阶段 A 精修网页 demo

日期：2026-10-09。预览地址：http://127.0.0.1:5184/ 。

本版直接更新 D:\Mathverse 的独立主页原型。正式 mathweb 业务工程没有改动；本次没有安装新软件。

## 可体验的变化

- 开场改成细长的雕塑拱门。1920×1080 下门高约占画面 29%，原版约 46%。
- 拉远初始机位，增加白场留白，调整柔光、阴影和门体亮度。
- 门板、门框和门洞使用同一拱形参数；包含实体厚度、倒角、细凹槽和小型金属把手。
- 书架空间改为倾斜框架、嵌套薄片与多方向结构。中远景基于四维坐标旋转和投影进行连续变化。
- 相机继续沿独立路径前进。拖拽环顾、回望、暂停前进和恢复前方保持可用。
- “暂停旅程”暂停相机位移，空间仍然变化；“定格空间”单独暂停结构变化，便于比较。
- 有效入口点击与拖拽可恢复失焦挂起的运动；页面隐藏时继续挂起。

## 文件与参数

拱形参数位于 src/mathverse/scene/archGeometry.ts；入口与门体位于 WhiteEntrance.tsx、Door.tsx。空间实现位于 FoldedField.tsx，原书架实现不再用于当前页面。

初始机位距离 9.6、镜头入场 5.2 秒、开门 2.3 秒、探索速度 0.35 场景单位/秒。第四轴变化的基准周期为 80 秒，不同轴采用不同频率。近景使用安全带和柔和淡出，避免结构穿过路径。

本版属于设计体验样板。完整弹簧扭头、数学内容阅读、最终后期效果和长期性能验收仍在后续阶段。

## 检查与运行

```powershell
. D:\Mathverse\Enter-Environment.ps1
npm run dev
```

```powershell
npm run build
npm run test:stage-a
```

浏览器检查使用现有 Edge，覆盖 1920×1080、1280×720、自动前进、环顾回望、暂停恢复、空间独立变化和空间定格。最终结果以 artifacts/entrance/stage-a-refined/verification.json 为准。

截图位于 artifacts/entrance/stage-a-refined；此前版本截图仍位于 artifacts/entrance/stage-a。原版源代码副本位于 artifacts/archive/sources/stage-a-original-source/src。

已完成生产构建及浏览器功能检查。功能报告中的绘制调用与三角形数量是场景规模采样；帧率、10 分钟持续运行和资源增长尚未完成正式测量。
