export type RendererKey = 'identity' | 'gaussian' | 'circle' | 'mobius' | 'person' | 'rotation';
export type MathNode = {
  id:string; kind:'formula'|'geometry'|'person'|'relation'; title:string; eyebrow:string; summary:string;
  latex?:string; rendererKey:RendererKey; relatedIds:string[]; paragraphs:string[];
  sources:{title:string;url:string}[];
};
const exponential={title:'NIST · 复指数与三角函数',url:'https://dlmf.nist.gov/4.2#E24'};
export const MATH_NODES: readonly MathNode[] = [
  {id:'euler-identity',kind:'formula',title:'欧拉恒等式',eyebrow:'01 / EXPONENTIAL',summary:'一次半周旋转，把五个常数连在一起。',latex:'e^{i\\pi}+1=0',rendererKey:'identity',relatedIds:['unit-circle','complex-rotation','leonhard-euler'],paragraphs:[
    '把实数轴放进复平面：乘以 $e^{i\\theta}$，可以理解为绕原点旋转 θ 弧度。模长保持为 1，改变的是方向。',
    '当 θ = π，单位圆上的点从 1 转到 −1。因此 $e^{i\\pi}=-1$，再加上 1，得到零。',
    '这个等式把 0、1、圆周率 π、自然对数的底 e 和虚数单位 i 放在同一个关系里。它也是指数、三角函数与几何之间的一座桥。',
  ],sources:[exponential]},
  {id:'gaussian-integral',kind:'formula',title:'高斯积分',eyebrow:'02 / INFINITY',summary:'一条无限延伸的曲线，围出有限的面积。',latex:'\\int_{-\\infty}^{\\infty}e^{-x^2}\\,\\mathrm{d}x=\\sqrt{\\pi}',rendererKey:'gaussian',relatedIds:['unit-circle'],paragraphs:[
    '函数 $e^{-x^2}$ 在原点达到 1，向两侧迅速衰减。它的图像延伸到无限远，但曲线下方的总面积是有限的。',
    '令这个积分为 I。把两个相同的积分相乘，得到整个平面上的二重积分。被积函数是 $e^{-(x^2+y^2)}$，它只取决于离原点的距离。',
    '换成极坐标，角度积分给出 $2\\pi$，径向积分 $\\int_0^\\infty e^{-r^2}r\\,\\mathrm{d}r$ 给出 $\\tfrac12$。所以 $I^2=\\pi$。因为 I 为正，$I=\\sqrt{\\pi}$。',
  ],sources:[{title:'NIST · 误差函数与高斯积分',url:'https://dlmf.nist.gov/7.2#E2'}]},
  {id:'unit-circle',kind:'geometry',title:'单位圆',eyebrow:'03 / GEOMETRY',summary:'让角度成为一个可以看见的复数。',latex:'z=\\cos\\theta+i\\sin\\theta,\\quad |z|=1',rendererKey:'circle',relatedIds:['complex-rotation','euler-identity'],paragraphs:[
    '单位圆以原点为圆心、半径为 1。角度 θ 对应的点，其横坐标是 cos θ，纵坐标是 sin θ。',
    '在复平面中，同一个点写成 z = cos θ + i sin θ。实部与虚部是两个方向，模长表示到原点的距离。',
    '拖动下方角度滑块，观察圆上的点与半径方向。到 180° 时，点落在 −1；到 360° 时，回到 1。',
  ],sources:[exponential]},
  {id:'mobius-strip',kind:'geometry',title:'莫比乌斯带',eyebrow:'04 / TOPOLOGY',summary:'沿着一条边，走完一个无法区分内外的曲面。',latex:'(u,v)\\sim(u+2\\pi,-v)',rendererKey:'mobius',relatedIds:['unit-circle'],paragraphs:[
    '把一条纸带的一端扭转半圈，再连接两端，就得到莫比乌斯带。这里显示的是它的参数化曲面。',
    '在这张曲面上，无法在所有位置一致地指定“正面”和“反面”。沿带面绕一圈，局部法向会反过来；这种性质称为不可定向。',
    '它只有一条连续的边界。观察亮边：它绕过整个带面，最终与自身相接。下方滑块只改变展示角度，曲面的连接关系保持不变。',
  ],sources:[{title:'UC San Diego · 莫比乌斯带参数化',url:'https://mathweb.ucsd.edu/~jeggers/math31ch/mobius_strip.pdf'}]},
  {id:'leonhard-euler',kind:'person',title:'莱昂哈德·欧拉',eyebrow:'05 / LEONHARD EULER',summary:'1707—1783。从无穷、城市与旋转，辨认一个人的思想。',rendererKey:'person',relatedIds:['euler-identity','complex-rotation'],paragraphs:[
    '莱昂哈德·欧拉（Leonhard Euler，1707—1783）是一位瑞士数学家。',
    '沿着作品，辨认一个人的思想。Euler Archive 收录了他的作品，提供通向原始文献的入口。',
    '窗口里的纸页与符号是抽象的思想痕迹，属于本作品的艺术构图。原始文献可从下方 Euler Archive 进入。',
    '从欧拉恒等式继续，可以走向复数旋转、三角函数和单位圆。一个名字把这些不同的数学表达连接起来。',
  ],sources:[{title:'ETH Zurich · 欧拉馆藏简介',url:'https://library.ethz.ch/en/collections-and-archives/short-portraits/leonhard-euler-1707-1783.html'},{title:'University of the Pacific · Euler Archive',url:'https://scholarlycommons.pacific.edu/euler-works/'}]},
  {id:'complex-rotation',kind:'relation',title:'复数的旋转',eyebrow:'06 / CONNECTION',summary:'公式、圆与角度，是同一个关系的不同面貌。',latex:'e^{i\\theta}=\\cos\\theta+i\\sin\\theta',rendererKey:'rotation',relatedIds:['euler-identity','unit-circle','leonhard-euler'],paragraphs:[
    '左侧的指数表达、圆上的点，以及从原点出发的方向，描述着同一个复数。',
    '乘以 $e^{i\\theta}$ 会旋转 θ；接着乘以 $e^{i\\varphi}$，等于再转 φ。指数相加，对应旋转角度相加。',
    '把角度调到 180°，就抵达欧拉恒等式。下方的关联入口可以在阅读层中切换公式与图形，背景旅程保持连续。',
  ],sources:[exponential]},
];
export const NODE_BY_ID=new Map(MATH_NODES.map(node=>[node.id,node]));
