import './studyCatalog.css';
const groups=[
 {id:'main',name:'参考巨构',intro:'当前整体空间的视觉基准。厚重层叠、深凹开口与少数缓慢交换。',items:[
  ['参考图巨构 · 光影与欧拉','已完成五阶段研究','/space-a/reference/','/artifacts/spaces/megastructure/megastructure-reference-light/index.html'],
  ['参考图巨构 · 纯交换','共同投影与稳定骨架','/space-a/reference/?study=exchange','/artifacts/spaces/megastructure/megastructure-exchange/index.html'],
  ['早期巨构 · 尺度返修','更宽、更高的整体空间','/space-a/euler/','/artifacts/spaces/megastructure/megastructure-expanse/index.html'],
 ]},
 {id:'abyss',name:'深井节点',intro:'独立的垂直空间研究。尚未与参考巨构连接，作为后续融合的候选节点。',items:[
  ['深井 · 构成','上下延伸，横向交织','/space-a/abyss/?view=reveal','/artifacts/spaces/abyss/vertical-abyss-composition/index.html'],
  ['深井 · 行进','绕过遮挡，逐渐发现空腔','/space-a/abyss/journey/','/artifacts/spaces/abyss/vertical-abyss-journey/index.html'],
  ['深井 · 四维交换','追踪暖白接缝的内外关系','/space-a/abyss/exchange/','/artifacts/spaces/abyss/vertical-abyss-exchange/index.html'],
  ['深井 · 欧拉阅读','一个源体积与三次思想转向','/space-a/abyss/euler/','/artifacts/spaces/abyss/vertical-abyss-euler/index.html'],
 ]},
 {id:'mechanism',name:'四维机制',intro:'从嵌套方体到体积世界，验证第四轴投影与有规律的内外交换。',items:[
  ['内外翻转','嵌套体积的基本研究','/space-inversion/','/artifacts/spaces/inversion/space-inversion/index.html'],
  ['有序空间','一次只改变一个单元','/space-inversion/worlds/','/artifacts/spaces/inversion/ordered-inversion/index.html'],
  ['体积数学','图形住在内方体中','/','/artifacts/spaces/inversion/volume-inversion/index.html'],
 ]},
 {id:'worlds',name:'小世界与融合',intro:'公式、人物痕迹与抽象数学景象，探索它们怎样成为空间的一部分。',items:[
  ['三种数学世界','欧拉、莫比乌斯与高斯','/space-fusion/gaussian/worlds/','/artifacts/spaces/fusion/space-fusion-gaussian/index.html'],
  ['欧拉世界','作品与伟大成就的联系','/space-fusion/euler/worlds/','/artifacts/spaces/fusion/space-fusion-euler/index.html'],
  ['思想空腔','已探索的融合方案，供比较','/thought-cavity/three/worlds/','/artifacts/spaces/fusion/thought-cavity-worlds/index.html'],
  ['早期层叠空间','空间返修的历史基底','/space-a/worlds/','/artifacts/spaces/layered/space-revision-a-worlds/index.html'],
 ]},
 {id:'entry',name:'入口与阅读交互',intro:'白色拱门、持续深入、弹性扭头与约 80% 的观察窗口。',items:[
  ['白色入口','早期拱门截图','/legacy/','/artifacts/entrance/stage-a-refined/entrance.png'],
  ['镜头与门','历史交互演示','/artifacts/interaction/stage-b/index.html','/artifacts/interaction/stage-b/index.html'],
  ['数学窗口','历史窗口与阅读研究','/artifacts/worlds/stage-d-windows/index.html','/artifacts/worlds/stage-d-windows/index.html'],
  ['欧拉三章','人物故事与数学世界','/artifacts/worlds/stage-d-euler/index.html','/artifacts/worlds/stage-d-euler/index.html'],
 ]},
];
export function StudyCatalog(){document.title='Mathverse · 动效研究目录';return <main className="study-catalog"><header><span>MATHVERSE / MOTION ATLAS</span><h1>从一扇门，到一种思想。</h1><p>主页动效的分类目录。按主题查看空间、数学世界与交互样片。</p><nav>{groups.map(g=><a key={g.id} href={'#'+g.id}>{g.name}</a>)}</nav></header><aside><strong>整体与节点的关系</strong><p>参考巨构保留为整体视觉基准。深井目前是独立研究，融合的边界、尺度与进入路径仍待讨论。</p></aside>{groups.map(g=><section id={g.id} key={g.id}><div className="catalog-group-heading"><h2>{g.name}</h2><p>{g.intro}</p></div><div className="study-grid">{g.items.map(([name,note,demo,gallery])=><article key={name}><h3>{name}</h3><p>{note}</p><div><a href={demo}>体验样片 ↗</a><a href={gallery}>画面与记录 ↗</a></div></article>)}</div></section>)}<footer>历史源码快照与验证记录已按主题归档。各场景原有地址继续可用。</footer></main>;}
