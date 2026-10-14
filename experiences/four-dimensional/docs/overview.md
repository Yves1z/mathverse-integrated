# 主页思想动效：分类与版本关系

更新：2026-10-12。统一浏览入口 `/studies/`。本页梳理已完成的研究，不把历次独立样片视为已整合的最终主页。

## 整体与局部

**参考图巨构** `/space-a/reference/` 是目前整体空间的视觉基准：厚重层叠框架、巨大空隙、稳定骨架、少数缓慢四维交换、欧拉阅读及局部光影。

**深井** `/space-a/abyss/euler/` 是独立的垂直节点研究。它已具备构成、曲线行进、侧壁交换和欧拉阅读，还没有与参考巨构接通。上一轮讨论建议让它成为旧巨构中的一次空间发现；连接边界、尺度和进入路径尚待讨论。第五阶段局部空气也尚未接入深井，不能与已有参考巨构光影混为一谈。

## 功能分类

| 分类 | 已具备的能力 | 源码位置 |
|---|---|---|
| 白色入口 | 白色空间、雕塑感拱门、推门过渡 | `src/mathverse/scene` |
| 镜头运动 | 持续深入、弹性扭头、暂停、回正、失焦时钟 | `src/mathverse/motion`；各场景的 Camera 实现 |
| 四维投影 | 内外方体、XW／YW 投影、自然尺度变化、稳定参照与慢速交换 | `experiments/inversion`、`shared/projection` |
| 数学体积 | 圆、旋转曲面、莫比乌斯、高斯、源几何和共同投影 | `shared/math`、`content`、`windows` |
| 欧拉与阅读 | 少量作品痕迹、三章故事、共享角度、真实拾取遮挡、80.1% 窗口与外围 6% 慢行 | `reading`、`content/eulerStory.ts`、`shared/reading` |
| 巨构与背景 | 早期层叠、尺度返修、参考图重建、横向与后方延伸 | `experiments/layered`、`experiments/megastructure` |
| 深井节点 | 正交交织、井边弧线、局部 YW 交换、欧拉体积世界 | `experiments/abyss` |
| 光影与空气 | 石墨灰材质、接触阴影、局部光路、克制微尘 | `shared/rendering`；参考巨构已接入，深井尚待接入 |

源码位置中省略的共同前缀为 `src/mathverse/`。

## 样片家族

| 家族 | 内容与定位 | 场景入口 | 画面与记录 |
|---|---|---|---|
| 入口 A | 原白色入口与精修拱门截图 | `/legacy/` 为保留主页入口 | `artifacts/entrance/` |
| 交互 B | 进入、慢行、扭头与暂停的早期验证 | 对应历史网页演示 | `artifacts/interaction/stage-b/` |
| 窗口 C／D | 公式发现、阅读、数学窗口、光影、欧拉与关系 | 对应历史网页演示 | `artifacts/worlds/` |
| 层叠空间 A | 早期巨构、受光与六个数学窗口 | `/space-a/`、`/space-a/worlds/` | `artifacts/spaces/layered/` |
| 翻转机制 | 内外投影、有序事件、从面上窗口到体积图形 | `/space-inversion/`、`/space-inversion/worlds/`、根主页 `/` | `artifacts/spaces/inversion/` |
| 小世界融合 | 欧拉单元、莫比乌斯、高斯及思想空腔比较 | `/space-fusion/…`、`/thought-cavity/…` | `artifacts/spaces/fusion/` |
| 巨构返修 | 欧拉接入、空间尺度、参考图重建、行进、交换、阅读、光影 | `/space-a/euler/`、`/space-a/reference/` | `artifacts/spaces/megastructure/` |
| 深井研究 | 构成、行进、局部交换、欧拉阅读四个阶段 | `/space-a/abyss/…` | `artifacts/spaces/abyss/` |
| 概念图 | 早期 A／B／C 空间设计图及第四轴草图 | 分类归档供比较 | `artifacts/design/`、`docs/design/discussion/` |

其中巨构与深井目前是独立运行的两个模型，不以复制旧视觉元素代替它们的实际空间连接。

## 继续工作时的次序

1. 以参考巨构作为总体构成基准，讨论深井节点的尺度、进入边界及横向背景。
2. 制作真实连通与浅弧行进的融合样片，再判断空间发现与视差。
3. 复查共同投影、数学显露、实际遮挡和阅读返回。
4. 为融合后的开口校准局部光路与微尘，维持有规律的单一事件。

上述为讨论建议，不表示融合已经批准或实现。历次方案、验收范围与源码快照已分类保留。
