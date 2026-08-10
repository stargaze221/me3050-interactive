(() => {
"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const ctype=$("ctype"),Pg=$("plantGain"),Pt=$("plantTau"),kc=$("kc"),ki=$("ki"),kd=$("kd"),rp=$("responsePlot"),cp=$("controlPlot");
function E(t,a={},s=null){const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(s!==null)e.textContent=s;return e}
function clear(s){while(s.firstChild)s.removeChild(s.firstChild)}
function fmt(v,d=2){return Number(Math.abs(v)<1e-12?0:v).toFixed(d)}
function params(){const type=ctype.value;return{type,Kp:+Pg.value,tau:+Pt.value,Kc:+kc.value,Ki:(type==="PI"||type==="PID")?+ki.value:0,Kd:(type==="PD"||type==="PID")?+kd.value:0,r:1}}
function finalValue(q){return q.Ki>0?q.r:(q.Kp*q.Kc/(1+q.Kp*q.Kc))*q.r}
function simulate(q){const slow=q.Ki>0?1/Math.max(.15,q.Kp*q.Ki/(1+q.Kp*q.Kc)):q.tau/(1+q.Kp*q.Kc);const tEnd=Math.min(35,Math.max(6,10*slow,8*q.tau));const N=1800,h=tEnd/N;let y=0,I=0;const out=[];
 function dy(y,I){return (q.Kp*(q.Kc*(q.r-y)+q.Ki*I)-y)/(q.tau+q.Kp*q.Kd)}
 function u(y,I,yd){return q.Kc*(q.r-y)+q.Ki*I-q.Kd*yd}
 for(let i=0;i<=N;i++){const t=i*h,yd=dy(y,I);out.push({t,y,u:u(y,I,yd)});if(i===N)break;
   const f=(Y,J)=>({y:dy(Y,J),i:q.r-Y});const a=f(y,I),b=f(y+.5*h*a.y,I+.5*h*a.i),c=f(y+.5*h*b.y,I+.5*h*b.i),d=f(y+h*c.y,I+h*c.i);y+=h*(a.y+2*b.y+2*c.y+d.y)/6;I+=h*(a.i+2*b.i+2*c.i+d.i)/6;
 }return{data:out,tEnd}}
function metrics(q,s){const yss=finalValue(q),tol=.02*Math.max(1e-6,Math.abs(yss));let maxY=-Infinity,uPeak=0,last=-1,t10=null,t90=null;for(let i=0;i<s.data.length;i++){const d=s.data[i];maxY=Math.max(maxY,d.y);uPeak=Math.max(uPeak,Math.abs(d.u));if(Math.abs(d.y-yss)>tol)last=i;if(t10===null&&d.y>=.1*yss)t10=d.t;if(t90===null&&d.y>=.9*yss)t90=d.t}const ts=last<s.data.length-1?s.data[Math.min(last+1,s.data.length-1)].t:null;return{yss,sse:q.r-yss,os:Math.max(0,100*(maxY-q.r)/q.r),uPeak,ts,rise:t10!==null&&t90!==null?t90-t10:null}}
function nice(min,max,n=6){const raw=Math.max(1e-9,(max-min)/n),pow=10**Math.floor(Math.log10(raw)),r=raw/pow,st=(r<1.5?1:r<3?2:r<7?5:10)*pow,start=Math.ceil(min/st)*st,a=[];for(let v=start;v<=max+.2*st;v+=st)a.push(v);return a}
function draw(svg,s,key,yref,klass,H){clear(svg);const W=1000,M={l:70,r:25,t:20,b:55},pw=W-M.l-M.r,ph=H-M.t-M.b,vals=s.data.map(d=>d[key]);let ymin=Math.min(0,...vals),ymax=Math.max(yref??0,...vals),pad=.12*Math.max(.3,ymax-ymin);ymin-=pad;ymax+=pad;const x=t=>M.l+t/s.tEnd*pw,y=v=>M.t+(ymax-v)/(ymax-ymin)*ph;
 for(let i=0;i<=6;i++){const t=s.tEnd*i/6;svg.appendChild(E("line",{x1:x(t),y1:M.t,x2:x(t),y2:H-M.b,class:"grid"}));svg.appendChild(E("text",{x:x(t),y:H-M.b+20,"text-anchor":"middle",class:"tick"},fmt(t,1)))}
 nice(ymin,ymax,6).forEach(v=>{svg.appendChild(E("line",{x1:M.l,y1:y(v),x2:W-M.r,y2:y(v),class:Math.abs(v)<1e-9?"zero":"grid"}));svg.appendChild(E("text",{x:M.l-8,y:y(v)+4,"text-anchor":"end",class:"tick"},fmt(v,1)))});
 if(key==="y"){svg.appendChild(E("rect",{x:M.l,y:y(1.02),width:pw,height:Math.max(1,y(.98)-y(1.02)),class:"settle-band"}));svg.appendChild(E("line",{x1:M.l,y1:y(1),x2:W-M.r,y2:y(1),class:"setpoint-line"}))}
 const d=s.data.map((q,i)=>(i?"L":"M")+x(q.t).toFixed(2)+","+y(q[key]).toFixed(2)).join(" ");svg.appendChild(E("path",{d,class:klass}));svg.appendChild(E("line",{x1:M.l,y1:H-M.b,x2:W-M.r,y2:H-M.b,class:"axis"}));svg.appendChild(E("line",{x1:M.l,y1:M.t,x2:M.l,y2:H-M.b,class:"axis"}));svg.appendChild(E("text",{x:M.l+pw/2,y:H-12,"text-anchor":"middle",class:"axislabel"},"time t (s)"));svg.appendChild(E("text",{x:18,y:M.t+ph/2,"text-anchor":"middle",class:"axislabel",transform:`rotate(-90 18 ${M.t+ph/2})`},key==="y"?"output y(t)":"control u(t)"))
}
function updateActive(){const t=ctype.value,integ=t==="PI"||t==="PID",der=t==="PD"||t==="PID";document.querySelector(".integral").classList.toggle("inactive",!integ);document.querySelector(".derivative").classList.toggle("inactive",!der);ki.disabled=!integ;kd.disabled=!der}
function render(){updateActive();const q=params(),s=simulate(q),m=metrics(q,s);$("plantGainVal").textContent=fmt(q.Kp,2);$("plantTauVal").textContent=fmt(q.tau,2)+" s";$("kcVal").textContent=fmt(q.Kc,1);$("kiVal").textContent=fmt(+ki.value,1);$("kdVal").textContent=fmt(+kd.value,2);$("sseStat").textContent=fmt(m.sse,4);$("osStat").textContent=fmt(m.os,1)+"%";$("tsStat").textContent=m.ts===null?"not settled":fmt(m.ts,2)+" s";$("uPeakStat").textContent=fmt(m.uPeak,2);$("controllerFormula").innerHTML=`Active controller: <strong>${q.type}</strong> &nbsp; u = ${fmt(q.Kc,1)}e ${q.Ki?`+ ${fmt(q.Ki,1)}∫e dt `:""}${q.Kd?`− ${fmt(q.Kd,2)}ẏ`:""}. &nbsp; Predicted steady-state output = ${fmt(m.yss,3)}.`;draw(rp,s,"y",1,"response",470);draw(cp,s,"u",0,"control-line",380)}
[ctype,Pg,Pt,kc,ki,kd].forEach(e=>e.addEventListener("input",render));document.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{ctype.value=b.dataset.type;kc.value=b.dataset.kc;ki.value=b.dataset.ki;kd.value=b.dataset.kd;render()}));render();
})();