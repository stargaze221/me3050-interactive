(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const gain=$("gain"), tau=$("tau"), inputAmp=$("inputAmp"), initial=$("initial");
  const mainPlot=$("mainPlot"), normalizedPlot=$("normalizedPlot");
  const ns="http://www.w3.org/2000/svg";

  const W=1000,H=500,HN=410;
  const M={l:72,r:24,t:24,b:58};
  const PW=W-M.l-M.r;

  function el(tag,attrs={},text=null){
    const n=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v);
    if(text!==null)n.textContent=text;
    return n;
  }
  function clear(svg){while(svg.firstChild)svg.removeChild(svg.firstChild)}
  function fmt(x,d=3){if(Math.abs(x)<1e-12)x=0;return Number(x).toFixed(d)}

  function params(){
    const K=+gain.value,Tau=+tau.value,U=+inputAmp.value,y0=+initial.value;
    const yss=K*U;
    const tEnd=Math.max(5*Tau,1);
    return {K,Tau,U,y0,yss,tEnd};
  }

  function response(t,p){
    return p.yss+(p.y0-p.yss)*Math.exp(-t/p.Tau);
  }

  function niceTicks(min,max,count=6){
    const raw=Math.max(1e-9,(max-min)/count);
    const pow=Math.pow(10,Math.floor(Math.log10(raw)));
    const r=raw/pow,step=(r<1.5?1:r<3?2:r<7?5:10)*pow;
    const start=Math.ceil(min/step)*step,vals=[];
    for(let v=start;v<=max+step*.15;v+=step)vals.push(v);
    return vals;
  }

  function scales(xMin,xMax,yMin,yMax,height){
    const PH=height-M.t-M.b;
    const x=v=>M.l+(v-xMin)/(xMax-xMin)*PW;
    const y=v=>M.t+(yMax-v)/(yMax-yMin)*PH;
    return {x,y,PH};
  }

  function drawAxes(svg,xMin,xMax,yMin,yMax,height,xLabel,yLabel){
    const {x,y,PH}=scales(xMin,xMax,yMin,yMax,height);
    for(const v of niceTicks(xMin,xMax,6)){
      svg.appendChild(el("line",{x1:x(v),y1:M.t,x2:x(v),y2:height-M.b,class:"grid"}));
      svg.appendChild(el("text",{x:x(v),y:height-M.b+22,"text-anchor":"middle",class:"tick"},fmt(v,2)));
    }
    for(const v of niceTicks(yMin,yMax,6)){
      svg.appendChild(el("line",{x1:M.l,y1:y(v),x2:W-M.r,y2:y(v),class:"grid"}));
      svg.appendChild(el("text",{x:M.l-10,y:y(v)+4,"text-anchor":"end",class:"tick"},fmt(v,2)));
    }
    if(yMin<0&&yMax>0)svg.appendChild(el("line",{x1:M.l,y1:y(0),x2:W-M.r,y2:y(0),class:"zero"}));
    svg.appendChild(el("line",{x1:M.l,y1:height-M.b,x2:W-M.r,y2:height-M.b,class:"axis"}));
    svg.appendChild(el("line",{x1:M.l,y1:M.t,x2:M.l,y2:height-M.b,class:"axis"}));
    svg.appendChild(el("text",{x:M.l+PW/2,y:height-14,"text-anchor":"middle",class:"label"},xLabel));
    svg.appendChild(el("text",{x:18,y:M.t+PH/2,"text-anchor":"middle",class:"label",transform:`rotate(-90 18 ${M.t+PH/2})`},yLabel));
    return {x,y,PH};
  }

  function path(points,x,y){
    return points.map((p,i)=>(i?"L":"M")+x(p[0]).toFixed(2)+","+y(p[1]).toFixed(2)).join(" ");
  }

  function drawMain(p){
    clear(mainPlot);
    const pts=[];
    let minY=Math.min(0,p.y0,p.yss,p.U),maxY=Math.max(0,p.y0,p.yss,p.U);
    for(let i=0;i<=700;i++){
      const t=p.tEnd*i/700,v=response(t,p);pts.push([t,v]);minY=Math.min(minY,v);maxY=Math.max(maxY,v);
    }
    const span=Math.max(.4,maxY-minY),pad=.16*span+.05;
    const yMin=minY-pad,yMax=maxY+pad;
    const {x,y}=drawAxes(mainPlot,0,p.tEnd,yMin,yMax,H,"time t (s)","input / output");

    // step input
    const inPts=[[0,0],[0,p.U],[p.tEnd,p.U]];
    mainPlot.appendChild(el("path",{d:path(inPts,x,y),class:"input-line"}));

    // steady state
    mainPlot.appendChild(el("line",{x1:x(0),y1:y(p.yss),x2:x(p.tEnd),y2:y(p.yss),class:"steady-line"}));

    // output
    mainPlot.appendChild(el("path",{d:path(pts,x,y),class:"output-line"}));

    // tau markers
    for(let n=1;n<=5;n++){
      const tx=n*p.Tau;if(tx>p.tEnd+1e-9)continue;
      mainPlot.appendChild(el("line",{x1:x(tx),y1:M.t,x2:x(tx),y2:H-M.b,class:"tau-line"}));
      const yy=response(tx,p);
      mainPlot.appendChild(el("circle",{cx:x(tx),cy:y(yy),r:4.4,class:"tau-point"}));
      mainPlot.appendChild(el("text",{x:x(tx),y:M.t+15,"text-anchor":"middle",class:"tick"},`${n}τ`));
    }
  }

  function drawNormalized(){
    clear(normalizedPlot);
    const xMin=0,xMax=5,yMin=0,yMax=1.08;
    const {x,y}=drawAxes(normalizedPlot,xMin,xMax,yMin,yMax,HN,"normalized time  t/τ","fraction of total change completed");
    const pts=[];
    for(let i=0;i<=600;i++){
      const z=5*i/600;pts.push([z,1-Math.exp(-z)]);
    }
    normalizedPlot.appendChild(el("path",{d:path(pts,x,y),class:"normal-line"}));
    for(let n=1;n<=5;n++){
      const v=1-Math.exp(-n);
      normalizedPlot.appendChild(el("line",{x1:x(n),y1:M.t,x2:x(n),y2:HN-M.b,class:"tau-line"}));
      normalizedPlot.appendChild(el("circle",{cx:x(n),cy:y(v),r:4.5,class:"tau-point"}));
      normalizedPlot.appendChild(el("text",{x:x(n),y:y(v)-10,"text-anchor":"middle",class:"tick"},`${(100*v).toFixed(1)}%`));
    }
  }

  function render(){
    const p=params();
    $("gainVal").textContent=fmt(p.K,2);
    $("tauVal").textContent=fmt(p.Tau,2)+" s";
    $("inputVal").textContent=fmt(p.U,1);
    $("initialVal").textContent=fmt(p.y0,1);
    $("steadyStat").textContent=fmt(p.yss,3);
    $("tauStat").textContent=fmt(p.Tau,2)+" s";
    $("settleStat").textContent=fmt(4*p.Tau,2)+" s";
    $("errorStat").textContent=fmt(p.y0-p.yss,3);
    drawMain(p);
    drawNormalized();
  }

  [gain,tau,inputAmp,initial].forEach(c=>c.addEventListener("input",render));
  render();
})();
