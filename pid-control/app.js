(() => {
"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const ctype=$("ctype"),Pg=$("plantGain"),Pwn=$("plantWn"),Pz=$("plantZeta"),kc=$("kc"),ki=$("ki"),kd=$("kd"),rp=$("responsePlot"),cp=$("controlPlot");
function E(t,a={},s=null){const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(s!==null)e.textContent=s;return e}
function clear(s){while(s.firstChild)s.removeChild(s.firstChild)}
function fmt(v,d=2){return Number(Math.abs(v)<1e-12?0:v).toFixed(d)}
function params(){const type=ctype.value;return{type,Kp:+Pg.value,wn:+Pwn.value,zeta:+Pz.value,Kc:+kc.value,Ki:(type==="PI"||type==="PID")?+ki.value:0,Kd:(type==="PD"||type==="PID")?+kd.value:0,r:1}}
function closedLoop(q){
 const a2=2*q.zeta*q.wn+q.Kp*q.wn*q.wn*q.Kd;
 const a1=q.wn*q.wn*(1+q.Kp*q.Kc);
 const a0=q.Kp*q.wn*q.wn*q.Ki;
 if(q.Ki<=1e-12)return{stable:a2>0&&a1>0,a2,a1,a0,margin:null,order:2};
 const margin=a2*a1-a0;
 return{stable:a2>0&&a1>0&&a0>0&&margin>0,a2,a1,a0,margin,order:3};
}
function finalValue(q,cl){if(!cl.stable)return null;return q.Ki>0?q.r:(q.Kp*q.Kc/(1+q.Kp*q.Kc))*q.r}
function simulate(q){
 const tEnd=Math.min(45,Math.max(8,8/(Math.max(.1,q.zeta)*q.wn),12/q.wn));
 const N=2600,h=tEnd/N;let y=0,v=0,I=0;const out=[];let diverged=false;
 function f(Y,V,J){const e=q.r-Y,u=q.Kc*e+q.Ki*J-q.Kd*V;return{y:V,v:q.Kp*q.wn*q.wn*u-2*q.zeta*q.wn*V-q.wn*q.wn*Y,i:e,u}}
 for(let n=0;n<=N;n++){
   const t=n*h,a=f(y,v,I);out.push({t,y,u:a.u});
   if(n===N)break;
   const b=f(y+.5*h*a.y,v+.5*h*a.v,I+.5*h*a.i),c=f(y+.5*h*b.y,v+.5*h*b.v,I+.5*h*b.i),d=f(y+h*c.y,v+h*c.v,I+h*c.i);
   y+=h*(a.y+2*b.y+2*c.y+d.y)/6;v+=h*(a.v+2*b.v+2*c.v+d.v)/6;I+=h*(a.i+2*b.i+2*c.i+d.i)/6;
   if(!Number.isFinite(y)||!Number.isFinite(v)||!Number.isFinite(I)||Math.abs(y)>50||Math.abs(v)>250||Math.abs(I)>250){diverged=true;break}
 }
 return{data:out,tEnd:out[out.length-1].t||tEnd,diverged}
}
function metrics(q,cl,s){
 const yss=finalValue(q,cl),uPeak=Math.max(...s.data.map(d=>Math.abs(d.u)));
 if(yss===null)return{yss:null,sse:null,os:null,uPeak,ts:null};
 const tol=.02*Math.max(1e-6,Math.abs(yss));let maxY=-Infinity,last=-1;
 for(let i=0;i<s.data.length;i++){const d=s.data[i];maxY=Math.max(maxY,d.y);if(Math.abs(d.y-yss)>tol)last=i}
 const ts=last<s.data.length-1?s.data[Math.min(last+1,s.data.length-1)].t:null;
 return{yss,sse:q.r-yss,os:Math.max(0,100*(maxY-q.r)/Math.abs(q.r)),uPeak,ts};
}
function nice(min,max,n=6){const raw=Math.max(1e-9,(max-min)/n),pow=10**Math.floor(Math.log10(raw)),r=raw/pow,st=(r<1.5?1:r<3?2:r<7?5:10)*pow,start=Math.ceil(min/st)*st,a=[];for(let v=start;v<=max+.2*st;v+=st)a.push(v);return a}
function draw(svg,s,key,yref,klass,H,yss=null,unstable=false){
 clear(svg);const W=1000,M={l:70,r:25,t:20,b:55},pw=W-M.l-M.r,ph=H-M.t-M.b,vals=s.data.map(d=>d[key]);let ymin=Math.min(0,...vals),ymax=Math.max(yref??0,...vals),pad=.12*Math.max(.3,ymax-ymin);ymin-=pad;ymax+=pad;const span=Math.max(1e-9,ymax-ymin),x=t=>M.l+t/Math.max(1e-9,s.tEnd)*pw,y=v=>M.t+(ymax-v)/span*ph;
 for(let i=0;i<=6;i++){const t=s.tEnd*i/6;svg.appendChild(E("line",{x1:x(t),y1:M.t,x2:x(t),y2:H-M.b,class:"grid"}));svg.appendChild(E("text",{x:x(t),y:H-M.b+20,"text-anchor":"middle",class:"tick"},fmt(t,t<10?2:1)))}
 nice(ymin,ymax,6).forEach(vv=>{svg.appendChild(E("line",{x1:M.l,y1:y(vv),x2:W-M.r,y2:y(vv),class:Math.abs(vv)<1e-9?"zero":"grid"}));svg.appendChild(E("text",{x:M.l-8,y:y(vv)+4,"text-anchor":"end",class:"tick"},fmt(vv,1)))});
 if(key==="y"){
   if(yss!==null){const tol=.02*Math.max(1e-6,Math.abs(yss));svg.appendChild(E("rect",{x:M.l,y:yss+tol<ymax?y(yss+tol):M.t,width:pw,height:Math.max(1,Math.min(H-M.b,y(yss-tol))-Math.max(M.t,y(yss+tol))),class:"settle-band"}))}
   svg.appendChild(E("line",{x1:M.l,y1:y(1),x2:W-M.r,y2:y(1),class:"setpoint-line"}))
 }
 const d=s.data.map((q,i)=>(i?"L":"M")+x(q.t).toFixed(2)+","+y(q[key]).toFixed(2)).join(" ");svg.appendChild(E("path",{d,class:unstable&&key==="y"?"response unstable-response":klass}));
 svg.appendChild(E("line",{x1:M.l,y1:H-M.b,x2:W-M.r,y2:H-M.b,class:"axis"}));svg.appendChild(E("line",{x1:M.l,y1:M.t,x2:M.l,y2:H-M.b,class:"axis"}));svg.appendChild(E("text",{x:M.l+pw/2,y:H-12,"text-anchor":"middle",class:"axislabel"},"time t (s)"));svg.appendChild(E("text",{x:18,y:M.t+ph/2,"text-anchor":"middle",class:"axislabel",transform:`rotate(-90 18 ${M.t+ph/2})`},key==="y"?"output y(t)":"control u(t)"));
}
function updateActive(){const t=ctype.value,integ=t==="PI"||t==="PID",der=t==="PD"||t==="PID";document.querySelector(".integral").classList.toggle("inactive",!integ);document.querySelector(".derivative").classList.toggle("inactive",!der);ki.disabled=!integ;kd.disabled=!der}
function render(){
 updateActive();const q=params(),cl=closedLoop(q),s=simulate(q),m=metrics(q,cl,s),isUnstable=!cl.stable||s.diverged;
 $("plantGainVal").textContent=fmt(q.Kp,2);$("plantWnVal").textContent=fmt(q.wn,2)+" rad/s";$("plantZetaVal").textContent=fmt(q.zeta,2);$("kcVal").textContent=fmt(q.Kc,1);$("kiVal").textContent=fmt(+ki.value,1);$("kdVal").textContent=fmt(+kd.value,2);
 const stab=$("stabilityStat");stab.textContent=isUnstable?"Unstable":"Stable";stab.className="v "+(isUnstable?"unstable-text":"stable-text");
 $("sseStat").textContent=m.sse===null?"—":fmt(m.sse,4);$("osStat").textContent=m.os===null?"—":fmt(m.os,1)+"%";$("tsStat").textContent=isUnstable?"—":m.ts===null?"not settled":fmt(m.ts,2)+" s";$("uPeakStat").textContent=fmt(m.uPeak,2);
 const terms=`u = ${fmt(q.Kc,1)}e ${q.Ki?`+ ${fmt(q.Ki,1)}∫e dt `:""}${q.Kd?`− ${fmt(q.Kd,2)}ẏ`:""}`;
 const poly=cl.order===2?`s² + ${fmt(cl.a2,2)}s + ${fmt(cl.a1,2)}`:`s³ + ${fmt(cl.a2,2)}s² + ${fmt(cl.a1,2)}s + ${fmt(cl.a0,2)}`;
 const routh=cl.order===3?` &nbsp; Routh test: a₂a₁ − a₀ = ${fmt(cl.margin,2)} ${cl.stable?"> 0":"≤ 0"}.`:"";
 $("controllerFormula").innerHTML=`Active controller: <strong>${q.type}</strong>. &nbsp; ${terms}.<br>Closed-loop characteristic polynomial: <strong>${poly}</strong>.${routh}`;
 draw(rp,s,"y",1,"response",470,m.yss,isUnstable);draw(cp,s,"u",0,"control-line",380,null,isUnstable);
}
[ctype,Pg,Pwn,Pz,kc,ki,kd].forEach(e=>e.addEventListener("input",render));document.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{ctype.value=b.dataset.type;kc.value=b.dataset.kc;ki.value=b.dataset.ki;kd.value=b.dataset.kd;render()}));render();
})();