import {useState} from 'react';
import type {ContentRuntime} from '../content/runtime';
import {EULER_CHAPTERS,partialBasel,type EulerChapter} from '../content/eulerStory';
import type {ReadingState} from './ReadingKernel';
import {MathTex} from './ReadingUI';

export function EulerStoryUI({runtime,reading,onChapter}:{runtime:ContentRuntime;reading:ReadingState;onChapter:(chapter:EulerChapter)=>void}){
  const [chapter,setChapter]=useState(runtime.euler.chapter),[terms,setTerms]=useState(runtime.euler.terms),[abstract,setAbstract]=useState(runtime.euler.abstract);
  const [angle,setAngle]=useState(Math.round(reading.angle*180/Math.PI));
  const story=EULER_CHAPTERS[chapter],disabled=reading.phase==='closing';
  const sum=partialBasel(terms),remainder=Math.PI*Math.PI/6-sum;
  return <div className="euler-story">
    <nav className="euler-chapters" aria-label="欧拉的三次思想转向">
      {EULER_CHAPTERS.map((item,index)=><button key={item.id} aria-label={`欧拉故事：${item.short}`} aria-current={chapter===index?'step':undefined} disabled={disabled} onClick={()=>{
        const next=index as EulerChapter;runtime.euler.chapter=next;
        if(runtime.euler.frozen)runtime.euler.weights=[Number(next===0),Number(next===1),Number(next===2)];
        setChapter(next);onChapter(next);
      }}><span>0{index+1}</span><strong>{item.short}</strong></button>)}
    </nav>
    <section className="euler-chapter-content" aria-labelledby="euler-chapter-title">
      <p className="euler-date">{story.date}</p>
      <h3 id="euler-chapter-title">{story.title}</h3>
      <MathTex latex={story.latex}/>
      <div className="reading-prose">{story.paragraphs.map(p=><p key={p}>{p}</p>)}</div>
      {chapter===0&&<div className="reading-control euler-control">
        <label htmlFor="series-terms">展开方片 <output>{terms} 项</output></label>
        <input id="series-terms" aria-label="展开级数项数" type="range" min="4" max="48" step="1" value={terms} disabled={disabled} onChange={event=>{const value=Number(event.target.value);runtime.euler.terms=value;setTerms(value);}}/>
        <p className="euler-readout">前 {terms} 项的和 <strong>{sum.toFixed(6)}</strong><br/>距离 π²/6 仍有 <strong>{remainder.toFixed(6)}</strong></p>
        <p className="euler-detail">方片只展示前 {terms} 项；完整的级数继续延伸。</p>
      </div>}
      {chapter===1&&<div className="reading-control euler-control">
        <button className="euler-abstraction" aria-label="剥离地形" aria-pressed={abstract} disabled={disabled} onClick={()=>{runtime.euler.abstract=!abstract;if(runtime.euler.frozen)runtime.euler.abstraction=Number(!abstract);setAbstract(!abstract);}}><span>{abstract?'让地形回来':'剥离地形'}</span><span aria-hidden="true">{abstract?'＋':'−'}</span></button>
        <p className="euler-detail">观察地形退去以后，连接是否仍然相同。节点旁的数字是度数；地形为抽象示意。</p>
      </div>}
      {chapter===2&&<div className="reading-control euler-control">
        <label htmlFor="euler-angle">转动同一个角度 <output>{angle}°</output></label>
        <input id="euler-angle" aria-label="欧拉故事中的旋转角度" type="range" min="0" max="360" step="1" value={angle} disabled={disabled} onChange={event=>{const value=Number(event.target.value);setAngle(value);reading.angle=value*Math.PI/180;}}/>
        <p className="coordinate-readout">{angle===180?'半周。圆上的点抵达 −1。':`z = ${Math.cos(angle*Math.PI/180).toFixed(3)} + (${Math.sin(angle*Math.PI/180).toFixed(3)}) i`}</p>
      </div>}
      <div className="euler-work"><span>沿着作品，继续追溯</span><a href={story.source.url} target="_blank" rel="noreferrer">{story.work} ↗</a></div>
    </section>
    <aside className="euler-coda"><span>仍在继续的思想</span><p>晚年，严重的眼疾使欧拉失明。他仍继续研究，直到生命的最后阶段。这个窗口让作品继续展开，留下少量属于人的痕迹。</p><a href="https://library.ethz.ch/en/collections-and-archives/short-portraits/leonhard-euler-1707-1783.html" target="_blank" rel="noreferrer">ETH 图书馆 · 欧拉生平与馆藏 ↗</a></aside>
    <p className="euler-art-note">纸页是当代艺术构图，公式采用现代记号。原作可从作品入口查看。</p>
  </div>;
}
