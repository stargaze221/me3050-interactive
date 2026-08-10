(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const amp=$("amp"), omega=$("omega"), nPulse=$("nPulse"), tau=$("tau");
  const pulseSelect=$("pulseSelect");
  const inputPlot=$("inputPlot"), responsePlot=$("responsePlot"), superPlot=$("superPlot");
  const showComponents=$("showComponents"), showDirect=$("showDirect"), showExactResponse=$("showExactResponse");

  let selectedK=5;

  const W=1000,H=430,HS=460;
  const M={l:72,r:24,t:24,b:58};
  const PW=W-M.l-M.r;
  const ns="http://www.w3.org/2000/svg";

  function el(tag,attrs={},text=null){
    const node=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs)) node.setAttribute(k,v);
    if(text!==null) node.textContent=text;
    return node;
  }
  function clear(svg){while(svg.firstChild) svg.removeChild(svg.firstChild)}
  function fmt(x,d=3){if(Math.abs(x)<1e-13)x=0;return Number(x).toFixed(d)}
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}

  function params(){
    const A=+amp.value,w=+omega.value,N=+nPulse.value,Tau=+tau.value;
    const T=2*Math.PI/w,tEnd=2*T,dt=tEnd/N;
    return {A,w,N,Tau,T,tEnd,dt};
  }
  function pulseAmplitude(k,p){
    const tm=(k+.5)*p.dt;
    return p.A*Math.sin(p.w*tm);
  }
  function pulseApproxAt(t,p){
    const k=clamp(Math.floor(t/p.dt),0,p.N-1);
    return pulseAmplitude(k,p);
  }
  function singlePulseResponse(t,k,p){
    const a=pulseAmplitude(k,p),t0=k*p.dt,t1=(k+1)*p.dt;
    if(t<t0) return 0;
    if(t<t1) return a*(1-Math.exp(-(t-t0)/p.Tau));
    const y1=a*(1-Math.exp(-p.dt/p.Tau));
    return y1*Math.exp(-(t-t1)/p.Tau);
  }
  function sumResponse(t,p){
    let s=0;
    for(let k=0;k<p.N;k++) s+=singlePulseResponse(t,k,p);
    return s;
  }
  function boundaryStates(p){
    const ys=[0];
    let y=0;
    const alpha=Math.exp(-p.dt/p.Tau);
    for(let k=0;k<p.N;k++){
      const a=pulseAmplitude(k,p);
      y=a+(y-a)*alpha;
      ys.push(y);
    }
    return ys;
  }
  function directPulseResponse(t,p,ys){
    if(t<=0) return 0;
    if(t>=p.tEnd) return ys[p.N];
    const k=clamp(Math.floor(t/p.dt),0,p.N-1);
    const t0=k*p.dt,a=pulseAmplitude(k,p),y0=ys[k];
    return a+(y0-a)*Math.exp(-(t-t0)/p.Tau);
  }
  function exactSineResponse(t,p){
    const q=p.w*p.Tau,den=1+q*q;
    return p.A/den*(Math.sin(p.w*t)-q*Math.cos(p.w*t)+q*Math.exp(-t/p.Tau));
  }
  function rmsInputError(p){
    const S=2400;let sum=0;
    for(let i=0;i<S;i++){
      const t=p.tEnd*(i+.5)/S;
      const e=p.A*Math.sin(p.w*t)-pulseApproxAt(t,p);
      sum+=e*e;
    }
    return Math.sqrt(sum/S);
  }
  function outputErrors(p){
    const S=900,ys=boundaryStates(p);
    let maxSuper=0,sumExact=0;
    for(let i=0;i<=S;i++){
      const t=p.tEnd*i/S;
      const s=sumResponse(t,p);
      const d=directPulseResponse(t,p,ys);
      const e=s-d;
      maxSuper=Math.max(maxSuper,Math.abs(e));
      const ee=d-exactSineResponse(t,p);
      sumExact+=ee*ee;
    }
    return {maxSuper,rmsExact:Math.sqrt(sumExact/(S+1))};
  }

  function scales(p,yMin,yMax,height=H){
    const PH=height-M.t-M.b;
    const x=t=>M.l+(t/p.tEnd)*PW;
    const y=v=>M.t+(yMax-v)/(yMax-yMin)*PH;
    return {x,y,PH};
  }
  function niceTicks(min,max,count=6){
    const raw=Math.max(1e-9,(max-min)/count);
    const pow=Math.pow(10,Math.floor(Math.log10(raw)));
    const r=raw/pow,step=(r<1.5?1:r<3?2:r<7?5:10)*pow;
    const start=Math.ceil(min/step)*step,vals=[];
    for(let v=start;v<=max+step*.2;v+=step) vals.push(v);
    return vals;
  }
  function drawAxes(svg,p,yMin,yMax,xLabel,yLabel,height=H){
    const {x,y,PH}=scales(p,yMin,yMax,height);
    for(const v of niceTicks(0,p.tEnd,6)){
      svg.appendChild(el("line",{x1:x(v),y1:M.t,x2:x(v),y2:height-M.b,class:"grid"}));
      svg.appendChild(el("text",{x:x(v),y:height-M.b+22,"text-anchor":"middle",class:"ticktext"},fmt(v,2)));
    }
    for(const v of niceTicks(yMin,yMax,6)){
      svg.appendChild(el("line",{x1:M.l,y1:y(v),x2:W-M.r,y2:y(v),class:"grid"}));
      svg.appendChild(el("text",{x:M.l-10,y:y(v)+4,"text-anchor":"end",class:"ticktext"},fmt(v,2)));
    }
    if(yMin<0&&yMax>0) svg.appendChild(el("line",{x1:M.l,y1:y(0),x2:W-M.r,y2:y(0),class:"zero-line"}));
    svg.appendChild(el("line",{x1:M.l,y1:height-M.b,x2:W-M.r,y2:height-M.b,class:"axis"}));
    svg.appendChild(el("line",{x1:M.l,y1:M.t,x2:M.l,y2:height-M.b,class:"axis"}));
    svg.appendChild(el("text",{x:M.l+PW/2,y:height-14,"text-anchor":"middle",class:"axislabel"},xLabel));
    svg.appendChild(el("text",{
      x:18,y:M.t+PH/2,"text-anchor":"middle",class:"axislabel",
      transform:`rotate(-90 18 ${M.t+PH/2})`
    },yLabel));
    return {x,y,PH};
  }
  function pathFromPoints(points,x,y){
    return points.map((pt,i)=>(i?"L":"M")+x(pt[0]).toFixed(2)+","+y(pt[1]).toFixed(2)).join(" ");
  }

  function drawInput(p){
    clear(inputPlot);
    const yPad=Math.max(.25,p.A*.18),yMin=-p.A-yPad,yMax=p.A+yPad;
    const {x,y,PH}=drawAxes(inputPlot,p,yMin,yMax,"time t (s)","input x(t), uₖ(t)");
    const t0=selectedK*p.dt,t1=(selectedK+1)*p.dt;
    inputPlot.appendChild(el("rect",{x:x(t0),y:M.t,width:x(t1)-x(t0),height:PH,class:"pulse-highlight"}));

    const exact=[];
    for(let i=0;i<=700;i++){const t=p.tEnd*i/700;exact.push([t,p.A*Math.sin(p.w*t)])}
    inputPlot.appendChild(el("path",{d:pathFromPoints(exact,x,y),class:"exact-line"}));

    const q=[];
    for(let k=0;k<p.N;k++){
      const a=pulseAmplitude(k,p),aPrev=k===0?0:pulseAmplitude(k-1,p);
      const left=k*p.dt,right=(k+1)*p.dt;
      if(k===0)q.push([left,0],[left,a]); else q.push([left,aPrev],[left,a]);
      q.push([right,a]);
    }
    q.push([p.tEnd,0]);
    inputPlot.appendChild(el("path",{d:pathFromPoints(q,x,y),class:"pulse-line"}));

    for(let k=0;k<p.N;k++){
      const tm=(k+.5)*p.dt,a=pulseAmplitude(k,p);
      inputPlot.appendChild(el("circle",{cx:x(tm),cy:y(a),r:3.2,class:"sample-point"}));
    }
    for(let k=0;k<p.N;k++){
      const left=k*p.dt,right=(k+1)*p.dt;
      const r=el("rect",{x:x(left),y:M.t,width:Math.max(3,x(right)-x(left)),height:PH,
        class:"pulse-hit",tabindex:"0",role:"button","aria-label":`Select pulse ${k+1}`});
      r.addEventListener("click",()=>{selectedK=k;render()});
      r.addEventListener("keydown",e=>{
        if(e.key==="Enter"||e.key===" "){e.preventDefault();selectedK=k;render()}
      });
      inputPlot.appendChild(r);
    }
  }

  function drawResponse(p){
    clear(responsePlot);
    const vals=[];let minY=0,maxY=0;
    for(let i=0;i<=900;i++){
      const t=p.tEnd*i/900,v=singlePulseResponse(t,selectedK,p);
      vals.push([t,v]);minY=Math.min(minY,v);maxY=Math.max(maxY,v);
    }
    const a=Math.abs(pulseAmplitude(selectedK,p));
    const span=Math.max(a*.55,Math.abs(maxY-minY),.15),pad=Math.max(.08,span*.22);
    let yMin=Math.min(0,minY)-pad,yMax=Math.max(0,maxY)+pad;
    if(yMax-yMin<.25){yMin-=.12;yMax+=.12}
    const {x,y,PH}=drawAxes(responsePlot,p,yMin,yMax,"time t (s)","single-pulse response yₖ(t)");
    const t0=selectedK*p.dt,t1=(selectedK+1)*p.dt;
    responsePlot.appendChild(el("rect",{x:x(t0),y:M.t,width:x(t1)-x(t0),height:PH,fill:"rgba(217,119,6,.08)"}));
    responsePlot.appendChild(el("line",{x1:x(t0),y1:M.t,x2:x(t0),y2:H-M.b,class:"pulse-boundary"}));
    responsePlot.appendChild(el("line",{x1:x(t1),y1:M.t,x2:x(t1),y2:H-M.b,class:"pulse-boundary"}));
    responsePlot.appendChild(el("path",{d:pathFromPoints(vals,x,y),class:"response-line"}));
  }

  function drawSuperposition(p){
    clear(superPlot);
    const S=800,ys=boundaryStates(p);
    const sumPts=[],directPts=[],exactPts=[];
    let minY=0,maxY=0;

    for(let i=0;i<=S;i++){
      const t=p.tEnd*i/S;
      const s=sumResponse(t,p),d=directPulseResponse(t,p,ys),e=exactSineResponse(t,p);
      sumPts.push([t,s]);directPts.push([t,d]);exactPts.push([t,e]);
      minY=Math.min(minY,s,d,e);maxY=Math.max(maxY,s,d,e);
    }
    const span=Math.max(.3,maxY-minY),pad=.14*span+.04;
    const yMin=minY-pad,yMax=maxY+pad;
    const {x,y}=drawAxes(superPlot,p,yMin,yMax,"time t (s)","system output y(t)",HS);

    if(showComponents.checked){
      for(let k=0;k<p.N;k++){
        const pts=[];
        for(let i=0;i<=S;i++){
          const t=p.tEnd*i/S;
          pts.push([t,singlePulseResponse(t,k,p)]);
        }
        superPlot.appendChild(el("path",{
          d:pathFromPoints(pts,x,y),
          class:k===selectedK?"component-selected":"component-line"
        }));
      }
    }

    superPlot.appendChild(el("path",{d:pathFromPoints(sumPts,x,y),class:"sum-line"}));
    if(showDirect.checked) superPlot.appendChild(el("path",{d:pathFromPoints(directPts,x,y),class:"direct-line"}));
    if(showExactResponse.checked) superPlot.appendChild(el("path",{d:pathFromPoints(exactPts,x,y),class:"exact-response-line"}));
  }

  function syncSelect(p){
    if(pulseSelect.options.length!==p.N){
      pulseSelect.innerHTML="";
      for(let k=0;k<p.N;k++){
        const o=document.createElement("option");o.value=k;o.textContent=`Pulse ${k+1}`;
        pulseSelect.appendChild(o);
      }
    }
    pulseSelect.value=String(selectedK);
  }

  function render(){
    const p=params();
    selectedK=clamp(selectedK,0,p.N-1);
    syncSelect(p);

    $("ampVal").textContent=fmt(p.A,1);
    $("omegaVal").textContent=fmt(p.w,1)+" rad/s";
    $("nPulseVal").textContent=String(p.N);
    $("tauVal").textContent=fmt(p.Tau,2)+" s";

    const a=pulseAmplitude(selectedK,p);
    const t0=selectedK*p.dt,t1=(selectedK+1)*p.dt,tm=(selectedK+.5)*p.dt;

    $("dtStat").textContent=fmt(p.dt,4)+" s";
    $("rmsStat").textContent=fmt(rmsInputError(p),4);
    $("ukStat").textContent=fmt(a,4);
    $("kStat").textContent=`${selectedK+1} of ${p.N}`;
    $("selectedInfo").textContent=`Pulse ${selectedK+1}: t = ${fmt(t0,3)}–${fmt(t1,3)} s, midpoint ${fmt(tm,3)} s`;

    const errs=outputErrors(p);
    $("superErr").textContent=errs.maxSuper<1e-10?"≈ 0 (numerical precision)":errs.maxSuper.toExponential(2);
    $("outputErr").textContent=fmt(errs.rmsExact,4);
    $("componentCount").textContent=String(p.N);
    $("tauStat").textContent=fmt(p.Tau,2)+" s";

    drawInput(p);drawResponse(p);drawSuperposition(p);
  }

  [amp,omega,nPulse,tau].forEach(ctrl=>ctrl.addEventListener("input",()=>{
    if(ctrl===nPulse) selectedK=clamp(selectedK,0,(+nPulse.value)-1);
    render();
  }));
  [showComponents,showDirect,showExactResponse].forEach(c=>c.addEventListener("change",render));
  pulseSelect.addEventListener("change",()=>{selectedK=+pulseSelect.value;render()});
  $("prevBtn").addEventListener("click",()=>{const N=+nPulse.value;selectedK=(selectedK-1+N)%N;render()});
  $("nextBtn").addEventListener("click",()=>{const N=+nPulse.value;selectedK=(selectedK+1)%N;render()});

  render();
})();
