# Mathverse 演示收藏

飞船模型与动画、宇宙网页和知识网图完整保留，按用途收纳。打开本目录 index.html 可进入总览；所有页面与共享资源需要一起保留。

| 目录 | 内容 | 网页入口 |
|---|---|---|
| starships/starship-home | 中央探索舰主页、动态飞船与星图入口 | [打开](starships/starship-home/index.html) |
| starships/cosmic-starship-home | 飞船、深空、黑洞与飞行粒子整合主页 | [打开](starships/cosmic-starship-home/index.html) |
| starships/turbulent-starship | 湍流飞船模型与可拖拽场景 | [打开](starships/turbulent-starship/index.html) |
| starships/fluid-phantom-starship | 流体幻影飞船模型 | [打开](starships/fluid-phantom-starship/index.html) |
| universe/cosmic-background-lab | 宇宙背景与星云实验室 | [打开](universe/cosmic-background-lab/index.html) |
| universe/dynamic-black-hole | 动态黑洞 | [打开](universe/dynamic-black-hole/index.html) |
| community-site | 原始社区主页和 Knowledge Galaxy 知识网图 | [主页](community-site/pages/home.html) · [知识星系](community-site/pages/galaxy.html) |
| effects/manifold-droplet | 流形液滴特效 | [打开](effects/manifold-droplet/index.html) |
| entrance | 独立宇宙入场页 | [打开](entrance/entrance-concept.html) |
| assets | 共享品牌图形、飞船图片与视觉素材 | 由页面引用或用于后续设计 |
| vendor/three | 本地 Three.js 及控制器、环境模块 | 保留 LICENSE 与完整模块目录 |

## 打开方式

在仓库根目录运行 `npm run dev:designs`，浏览器打开 `http://127.0.0.1:5500/`。也可在本目录启动静态服务器，访问根入口。包含 JS 模块的页面应通过 HTTP 打开；原社区主页和独立入场页延续原有 CDN 加载方式，需要联网，其他 Three.js 演示使用本地 vendor。

本目录是视觉原型收藏；主站与 Math Agent 位于本仓库 frontend/backend，四维研究位于 experiences/four-dimensional。飞船模型多为场景脚本生成，JS、CSS、HTML 与图片都属于需要保留的原型源码。


## 保留与维护

飞船、宇宙、知识网页及共享图片/模型脚本属于保留资产，不归入无用测试记录或宣传视频。此次分类完整保留原有 48 个文件，仅更新必要的跨目录引用；68 处本地资源引用与 10 个演示页面已检查。后续移动某个原型时同时核对 assets、vendor、CSS 继承及其他原型资源的依赖。

## 补充的早期方案

`universe/math-universe-original` 与 `universe/math-universe-variant` 保存桌面上两份 Math Universe HTML 原稿，原本未在已分类的 48 个文件中。它们保留原来的 CDN 依赖，需要联网。本包额外收录，不替换后来的宇宙实验室或四维工程。
