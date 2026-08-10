(() => {
"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const wn=$("wn"),zeta=$("zeta"),x10=$("x10"),x20=$("x20"),phase=$("phasePlot"),time=$("timePlot");
function E(t,a={},s=null){const e=document.createElementNS(NS,t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(s!==null)e.textContent=s;return e}
function clear(s){while(s.firstChild)s.removeChild(s.firstChild)}
function fmt(v,d=2){return Number(Math.abs(v)<1e-12?0:v).toFixed(d)}
function p(){return{wn:+wn.value,z:+zeta.value,x1:+x10.value,x2:+x20.value}}
function eig(q){const a=-q.z*q.wn;if(Math.abs(q.z)<1){const b=q.wn*Math.sqrt(1-q.z*q.z);return[{re:a,im:b},{re:a,im:-b}]}const r=q.wn*Math.sqrt(q.z*q.z-1);return[{re:a+r,im:0},{re:a-r,im:0}]}
function eigText(e){if(Math.abs(e.im)<1e-9)return fmt(e.re,3);return `${fmt(e.re,3)} ${e.im>=0?"+":"−"} ${fmt(Math.abs(e.im),3)}j`}
function stability(q){if(q.z>0.001)return"Stable";if(q.z<-0.001)return"Unstable";return"Marginally stable"}
function regime(q){if(q.z<0)return"negative damping: growing oscillation";if(Math.abs(q.z)<.001)return"undamped center";if(q.z<1)return"damped spiral";if(Math.abs(q.z-1)<.001)return"critical repeated pole";return"overdamped node"}
function simulate(q){const tEnd=8/q.wn*(q.z<0?1:Math.max(1,q.z));const N=1500,h=tEnd/N;let a=q.x1,b=q.x2;const out=[{t:0,x1:a,x2:b}];
 const f=(x1,x2)=>({a:x2,b:-q.wn*q.wn*x1-2*q.z*q.wn*x2});
 for(let i=0;i<N;i++){const k1=f(a,b),k2=f(a+.5*h*k1.a,b+.5*h*k1.b),k3=f(a+.5*h*k2.a,b+.5*h*k2.b),k4=f(a+h*k3.a,b+h*k3.b);a+=h*(k1.a+2*k2.a+2*k3.a+k4.a)/6;b+=h*(k1.b+2*k2.b+2*k3.b+k4.b)/6;out.push({t:(i+1)*h,x1:a,x2:b})}return{data:out,tEnd}}
function nice(min,max,n=6){const raw=Math.max(1e-9,(max-min)/n),pow=10**Math.floor(Math.log10(raw)),r=raw/pow,st=(r<1.5?1:r<3?2:r<7?5:10)*pow,start=Math.ceil(min/st)*st,a=[];for(let v=start;v<=max+.2*st;v+=st)a.push(v);return a}
function path(a,x,y,ky){return a.map((q,i)=>(i?"L":"M")+x(q.x1).toFixed(2)+","+y(q[ky]).toFixed(2)).join(" ")}
function drawPhase(q,sim){
 clear(phase);const W=760,H=620,M={l:70,r:25,t:25,b:55},pw=W-M.l-M.r,ph=H-M.t-M.b;
 const xs=sim.data.map(d=>d.x1),vs=sim.data.map(d=>d.x2);let R1=Math.max(1,Math.abs(Math.min(...xs)),Math.abs(Math.max(...xs))),R2=Math.max(q.wn,Math.abs(Math.min(...vs)),Math.abs(Math.max(...vs)));R1*=1.15;R2*=1.15;
 const x=v=>M.l+(v+R1)/(2*R1)*pw,y=v=>M.t+(R2-v)/(2*R2)*ph;
 for(const a of nice(-R1,R1,6)){phase.appendChild(E("line",{x1:x(a),y1:M.t,x2:x(a),y2:H-M.b,class:"grid"}));phase.appendChild(E("text",{x:x(a),y:H-M.b+20,"text-anchor":"middle",class:"tick"},fmt(a,1)))}
 for(const a of nice(-R2,R2,6)){phase.appendChild(E("line",{x1:M.l,y1:y(a),x2:W-M.r,y2:y(a),class:"grid"}));phase.appendChild(E("text",{x:M.l-8,y:y(a)+4,"text-anchor":"end",class:"tick"},fmt(a,1)))}
 const nx=11,ny=9;for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const X=-R1+2*R1*i/(nx-1),V=-R2+2*R2*j/(ny-1),dX=V,dV=-q.wn*q.wn*X-2*q.z*q.wn*V,n=Math.hypot(dX/R1,dV/R2)||1,L=14;phase.appendChild(E("line",{x1:x(X)-L*dX/R1/n/2,y1:y(V)+L*dV/R2/n/2,x2:x(X)+L*dX/R1/n/2,y2:y(V)-L*dV/R2/n/2,class:"field"}))}
 const pts=sim.data.map(d=>({x1:d.x1,x2:d.x2}));phase.appendChild(E("path",{d:path(pts,x,y,"x2"),class:"trajectory"}));phase.appendChild(E("circle",{cx:x(q.x1),cy:y(q.x2),r:5,class:"start-dot"}));phase.appendChild(E("circle",{cx:x(0),cy:y(0),r:4,class:"origin-dot"}));
 phase.appendChild(E("line",{x1:M.l,y1:y(0),x2:W-M.r,y2:y(0),class:"axis"}));phase.appendChild(E("line",{x1:x(0),y1:M.t,x2:x(0),y2:H-M.b,class:"axis"}));phase.appendChild(E("text",{x:M.l+pw/2,y:H-12,"text-anchor":"middle",class:"axislabel"},"x₁"));phase.appendChild(E("text",{x:18,y:M.t+ph/2,"text-anchor":"middle",class:"axislabel",transform:`rotate(-90 18 ${M.t+ph/2})`},"x₂"));
}
function drawTime(sim){
 clear(time);const W=1000,H=460,M={l:70,r:25,t:20,b:55},pw=W-M.l-M.r,ph=H-M.t-M.b,vals=sim.data.flatMap(d=>[d.x1,d.x2]);let ymin=Math.min(0,...vals),ymax=Math.max(0,...vals),pad=.12*Math.max(.5,ymax-ymin);ymin-=pad;ymax+=pad;
 const x=t=>M.l+t/sim.tEnd*pw,y=v=>M.t+(ymax-v)/(ymax-ymin)*ph;
 for(let i=0;i<=6;i++){const t=sim.tEnd*i/6;time.appendChild(E("line",{x1:x(t),y1:M.t,x2:x(t),y2:H-M.b,class:"grid"}));time.appendChild(E("text",{x:x(t),y:H-M.b+20,"text-anchor":"middle",class:"tick"},fmt(t,2)))}
 nice(ymin,ymax,6).forEach(v=>{time.appendChild(E("line",{x1:M.l,y1:y(v),x2:W-M.r,y2:y(v),class:Math.abs(v)<1e-9?"zero":"grid"}));time.appendChild(E("text",{x:M.l-8,y:y(v)+4,"text-anchor":"end",class:"tick"},fmt(v,1)))});
 const pth=(key)=>sim.data.map((d,i)=>(i?"L":"M")+x(d.t).toFixed(2)+","+y(d[key]).toFixed(2)).join(" ");time.appendChild(E("path",{d:pth("x1"),class:"x1-line"}));time.appendChild(E("path",{d:pth("x2"),class:"x2-line"}));time.appendChild(E("line",{x1:M.l,y1:H-M.b,x2:W-M.r,y2:H-M.b,class:"axis"}));time.appendChild(E("line",{x1:M.l,y1:M.t,x2:M.l,y2:H-M.b,class:"axis"}));time.appendChild(E("text",{x:M.l+pw/2,y:H-12,"text-anchor":"middle",class:"axislabel"},"time t (s)"))
}
function render(){const q=p(),es=eig(q),sim=simulate(q);$("wnVal").textContent=fmt(q.wn,1)+" rad/s";$("zetaVal").textContent=fmt(q.z,2);$("x10Val").textContent=fmt(q.x1,1);$("x20Val").textContent=fmt(q.x2,1);$("stabilityStat").textContent=stability(q);$("eig1Stat").textContent=eigText(es[0]);$("eig2Stat").textContent=eigText(es[1]);$("traceDetStat").textContent=`${fmt(-2*q.z*q.wn,2)} / ${fmt(q.wn*q.wn,2)}`;$("matrixA").innerHTML=`ẋ = A x<br>A = ⎡ 0 &nbsp;&nbsp; 1 ⎤<br>&nbsp;&nbsp;&nbsp;&nbsp;⎣ ${fmt(-q.wn*q.wn,2)} &nbsp;&nbsp; ${fmt(-2*q.z*q.wn,2)} ⎦`;$("eigenBox").innerHTML=`λ₁ = ${eigText(es[0])}<br>λ₂ = ${eigText(es[1])}`;$("stabilityMessage").innerHTML=`<strong>${stability(q)}:</strong> ${regime(q)}. The eigenvalue real parts are ${q.z>0?"negative, so modes decay":q.z<0?"positive, so modes grow":"zero, so there is no exponential decay"}.`;drawPhase(q,sim);drawTime(sim)}
[wn,zeta,x10,x20].forEach(e=>e.addEventListener("input",render));document.querySelectorAll("[data-z]").forEach(b=>b.addEventListener("click",()=>{zeta.value=b.dataset.z;render()}));render();
})();