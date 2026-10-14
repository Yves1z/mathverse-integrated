import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { MATH_NODES,NODE_BY_ID } from '../content/nodes';
import type { ContentRuntime } from '../content/runtime';
import type { ReadingState } from './ReadingKernel';

export function MathTex({latex}:{latex:string}){
  const html=useMemo(()=>katex.renderToString(latex,{displayMode:true,throwOnError:false,trust:false}),[latex]);
  return <div className="math-typeset" dangerouslySetInnerHTML={{__html:html}}/>;
}
function InlineMathText({text}:{text:string}){
  return <>{text.split(/(\$[^$]+\$)/g).map((part,index)=>part.startsWith('$')&&part.endsWith('$')?<span key={index} dangerouslySetInnerHTML={{__html:katex.renderToString(part.slice(1,-1),{throwOnError:false,trust:false})}}/>:part)}</>;
}
function useDialogKeys(root:React.RefObject<HTMLElement|null>,onClose:()=>void){
  useEffect(()=>{
    const dialog=root.current;if(!dialog)return;
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
      if(event.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(element=>element.getClientRects().length>0);
      const first=controls[0],last=controls[controls.length-1];if(!first)return;
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[root,onClose]);
}
export function NodeLabels({runtime,onOpen,onHover}:{runtime:ContentRuntime;onOpen:(id:string,origin?:HTMLElement)=>void;onHover:(id:string|null)=>void}){
  return <div className="node-labels" aria-label="空间中的数学">{MATH_NODES.map(node=><button key={node.id} className="node-label" aria-label={`观察${node.title}`} data-testid={`node-label-${node.id}`} ref={element=>{const state=runtime.nodes.get(node.id);if(state)state.label=element;}}
    onPointerEnter={()=>onHover(node.id)} onPointerLeave={()=>onHover(null)} onFocus={()=>onHover(node.id)} onBlur={()=>onHover(null)} onClick={event=>onOpen(node.id,event.currentTarget)}>
    <span>{node.eyebrow}</span><strong>{node.title}</strong><i aria-hidden="true">↗</i>
  </button>)}</div>;
}
export function MathCatalog({onClose,onOpen}:{onClose:()=>void;onOpen:(id:string,origin?:HTMLElement)=>void}){
  const root=useRef<HTMLElement>(null);useDialogKeys(root,onClose);
  return <section className="catalog-overlay" role="dialog" aria-modal="true" aria-labelledby="catalog-title" ref={root}>
    <div className="catalog-sheet"><header><div><p className="reading-eyebrow">SIX WAYS INTO INFINITY</p><h2 id="catalog-title">数学索引</h2></div><button className="close-reading" onClick={onClose} aria-label="关闭数学索引">×</button></header>
      <p className="catalog-intro">沿着一个问题，进入另一种视角。</p>
      <div className="catalog-grid">{MATH_NODES.map(node=><button key={node.id} className="catalog-item" aria-label={`打开${node.title}`} onClick={event=>onOpen(node.id,event.currentTarget)}>
        <span className="reading-eyebrow">{node.eyebrow}</span><h3>{node.title}</h3><p>{node.summary}</p><span className="catalog-arrow" aria-hidden="true">↗</span>
      </button>)}</div>
    </div>
  </section>;
}
export function ReadingPanel({reading,runtime,selectedId,onClose,onSwitch}:{reading:ReadingState;runtime:ContentRuntime;selectedId:string;onClose:()=>void;onSwitch:(id:string)=>void}){
  const node=NODE_BY_ID.get(selectedId)!;const root=useRef<HTMLElement>(null);
  const [degrees,setDegrees]=useState(60),[turn,setTurn]=useState(0);
  useDialogKeys(root,onClose);
  useLayoutEffect(()=>{
    setDegrees(Math.round(reading.angle*180/Math.PI));setTurn(0);
    const scroll=root.current?.querySelector('.reading-scroll');if(scroll)scroll.scrollTop=0;
    root.current?.querySelector<HTMLElement>('#reading-title')?.focus({preventScroll:true});
  },[selectedId]);
  const circle=node.rendererKey==='circle'||node.rendererKey==='rotation'||node.rendererKey==='identity';
  return <section ref={root} className={`reading-overlay reading-${reading.phase}`} role="dialog" aria-modal="true" aria-labelledby="reading-title" aria-describedby="reading-summary" data-testid="reading-dialog">
    <div className="reading-window" ref={element=>{runtime.windowElement=element;}} data-testid="reading-window">
    <div className="observation-caption" aria-hidden="true"><span>{node.eyebrow}</span><p>{node.rendererKey==='person'?'沿着纸页，辨认思想的痕迹。':'目光停留。空间继续。'}</p></div>
    <article className="reading-panel"><div className="reading-topline"><span className="reading-eyebrow">{node.eyebrow}</span><button className="close-reading" onClick={onClose} aria-label="退出阅读">×</button></div>
      <div className="reading-scroll"><h2 id="reading-title" tabIndex={-1}>{node.title}</h2><p id="reading-summary" className="reading-summary">{node.summary}</p>
        {node.latex&&<MathTex latex={node.latex}/>}
        <div className="reading-prose">{node.paragraphs.map((paragraph,index)=><p key={index}><InlineMathText text={paragraph}/></p>)}</div>
        {circle&&<div className="reading-control"><label htmlFor="angle-slider">改变角度 <output>{degrees}°</output></label><input id="angle-slider" type="range" min="0" max="360" step="1" value={degrees} onChange={event=>{const value=Number(event.target.value);setDegrees(value);reading.angle=value*Math.PI/180;}} disabled={reading.phase==='closing'}/><p className="coordinate-readout">z = {Math.abs(Math.cos(degrees*Math.PI/180))<0.0005?'0.000':Math.cos(degrees*Math.PI/180).toFixed(3)} + ({Math.abs(Math.sin(degrees*Math.PI/180))<0.0005?'0.000':Math.sin(degrees*Math.PI/180).toFixed(3)}) i</p></div>}
        {node.rendererKey==='mobius'&&<div className="reading-control"><label htmlFor="surface-slider">环顾曲面 <output>{turn}°</output></label><input id="surface-slider" type="range" min="-180" max="180" step="1" value={turn} onChange={event=>{const value=Number(event.target.value);setTurn(value);reading.objectYaw=value*Math.PI/180;}} disabled={reading.phase==='closing'}/></div>}
        <nav className="related-nodes" aria-label="关联数学"><h3>继续沿着这个关系</h3>{node.relatedIds.map(id=><button key={id} disabled={reading.phase==='closing'} onClick={()=>onSwitch(id)} aria-label={`继续阅读：${NODE_BY_ID.get(id)!.title}`}>{NODE_BY_ID.get(id)!.title}<span aria-hidden="true">↗</span></button>)}</nav>
        <div className="reading-sources"><span>资料来源</span>{node.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>
      </div><div className="reading-bottom"><span className="slow-journey" aria-hidden="true"/><span>世界仍在缓慢前行</span><span>ESC 返回</span></div>
    </article>
    </div>
  </section>;
}
