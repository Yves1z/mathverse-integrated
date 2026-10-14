export const EULER_CHAPTERS = [
  {
    id:'series', year:'1735', title:'无穷之中，遇见一个圆', short:'无穷与圆',
    caption:'越来越小的方片，留下一个有限的总和。',
    work:'E041 · De summis serierum reciprocarum', date:'1735 年写成 · 1740 年发表',
    latex:'\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}',
    paragraphs:[
      '一个看似只属于整数的问题：把平方倒数不断相加，最终会得到什么？欧拉在 1735 年找到了精确的答案，圆周率出现在无穷级数之中。',
      '这里，每片正方形的边长与 1/n 成正比，面积与 1/n² 成正比。沿着越来越小的方片望向深处，有限的展示逐渐抵达尚未展开的无穷。',
    ],
    source:{title:'Euler Archive · E041 原作与译文',url:'https://scholarlycommons.pacific.edu/euler-works/41/'},
  },
  {
    id:'bridges', year:'1741', title:'把一座城市，化为关系', short:'城市与关系',
    caption:'地形退去。四个节点，七条连接。',
    work:'E053 · Solutio problematis ad geometriam situs pertinentis', date:'1735 年写成 · 1741 年发表（依档案记录）',
    latex:'\\deg(A)=5,\\quad\\deg(B)=\\deg(C)=\\deg(D)=3',
    paragraphs:[
      '能否一次走过柯尼斯堡的七座桥，而且每座桥只经过一次？欧拉把问题转向了连接关系：重要的是从哪里进入，又从哪里离开。',
      '以今天的图论语言，四块陆地成为四个节点，七座桥成为七条边。这里四个节点的度数都是奇数；连通图要有一条走遍每条边恰好一次的路径，奇度节点只能有 0 个或 2 个。因此这次漫步无法完成。',
    ],
    source:{title:'Euler Archive · E053 七桥问题',url:'https://scholarlycommons.pacific.edu/euler-works/53/'},
  },
  {
    id:'rotation', year:'1748', title:'让不同的语言，共用一次旋转', short:'指数与旋转',
    caption:'纸上的关系，进入圆与螺旋的世界。',
    work:'E101 · Introductio in analysin infinitorum, I', date:'1748 年出版 · 《无穷分析引论》第一卷',
    latex:'e^{i\\theta}=\\cos\\theta+i\\sin\\theta',
    paragraphs:[
      '1748 年，《无穷分析引论》出版。函数、级数与指数在这部作品中形成相互联系的语言。这里用现代记号，把复指数与三角函数的关系展开成一次可以看见的旋转。',
      '一个角度同时决定圆上的点、实部与虚部，以及向纵深展开的螺旋。转到半周，便抵达 −1；再加上 1，就是欧拉恒等式。沿着下方入口进入相邻窗口，同一个角度会被保留。',
    ],
    source:{title:'Euler Archive · E101 《无穷分析引论》',url:'https://scholarlycommons.pacific.edu/euler-works/101/'},
  },
] as const;

export type EulerChapter = 0|1|2;
export type Point3 = [number,number,number];
export type EulerStoryState = {chapter:EulerChapter; terms:number; abstract:boolean; weights:Point3; abstraction:number; lastTime:number|null; frozen:boolean};
export const createEulerStory = ():EulerStoryState => ({chapter:0,terms:24,abstract:false,weights:[1,0,0],abstraction:0,lastTime:null,frozen:false});

// Exponential convergence also permits reversal before the previous chapter has settled.
// The shared space clock prevents a hidden tab or a frozen scene from catching up.
export function advanceEulerStory(state:EulerStoryState,time:number,reduced=false):void{
  const dt=state.lastTime===null?0:Math.max(0,Math.min(.05,time-state.lastTime));
  state.lastTime=time;
  const alpha=reduced?1:1-Math.exp(-4.6*dt);
  for(let i=0;i<3;i++)state.weights[i]+=((i===state.chapter?1:0)-state.weights[i])*alpha;
  state.abstraction+=((state.abstract?1:0)-state.abstraction)*alpha;
}
export function partialBasel(terms:number):number{
  let sum=0;for(let n=1;n<=terms;n++)sum+=1/(n*n);return sum;
}
export function seriesSquare(n:number):{center:Point3;side:number}{
  return {center:[-1.65+1.0*Math.log(n),.58*Math.sin(1.2*Math.log(n)),-.42*(n-1)],side:2.7/n};
}
export const BRIDGE_NODES:readonly Point3[]=[[-.65,0,0],[-2.35,1.7,-.35],[-2.35,-1.7,.15],[2.15,0,-.5]];
export const BRIDGE_EDGES = [[0,1,.65],[0,1,-.65],[0,2,.65],[0,2,-.65],[0,3,.35],[1,3,.4],[2,3,-.4]] as const;
export const bridgeDegrees=()=>BRIDGE_NODES.map((_,i)=>BRIDGE_EDGES.reduce((n,[a,b])=>n+Number(a===i)+Number(b===i),0));
export function bridgePoint(edge:number,t:number,out:Point3):Point3{
  const [ai,bi,bend]=BRIDGE_EDGES[edge],a=BRIDGE_NODES[ai],b=BRIDGE_NODES[bi];
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let i=0;i<3;i++){
    const c=(a[i]+b[i])/2+(i===0?-(b[1]-a[1])/length*bend:i===1?(b[0]-a[0])/length*bend:-.3);
    out[i]=(1-t)*(1-t)*a[i]+2*(1-t)*t*c+t*t*b[i];
  }return out;
}
