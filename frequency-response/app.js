(() => {
"use strict";
const $=id=>document.getElementById(id), NS="http://www.w3.org/2000/svg";
const systemType=$("systemType"), gain=$("gain"), tau=$("tau"), wn=$("wn"), zeta=$("zeta"), logw=$("logw");
const bode=$("bodePlot"), sine=$("sinePlot");
function E(tag,a={},t=null){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);if(t!==null)e.textContent=t;return e}
function clear(s){while(s.firstChild)s.removeChild(s.firstChild)}
function fmt(v,d=2){return Number(v).toFixed(d)}
function p(){return{type:systemType.value,K:+gain.value,tau:+tau.value,wn:+wn.value,zeta:+zeta.value,w:Math.pow(10,+logw.value)}}
function frequencyResponse(w,q){if(q.type==="first"){const x=w*q.tau,den=1+x*x;return{re:q.K/den,im:-q.K*x/den}}const re=q.wn*q.wn-w*w, im=2*q.zeta*q.wn*w, den=re*re+im*im;return{re:q.K*q.wn*q.wn*re/den,im:-q.K*q.wn*q.wn*im/den}}
function mp(h){return{mag:Math.hypot(h.re,h.im),phase:Math.atan2(h.im,h.re)*180/Math.PI}}
function logspace(a,b,n){return Array.from({length:n},(_,i)=>Math.pow(10,a+(b-a)*i/(n-1)))}
function path(points,x,y){return points.map((q,i)=>(i?"L":"M")+x(q.x).toFixed(2)+","+y(q.y).toFixed(2)).join(" ")}
function axes(svg,xmin,xmax,ymin,ymax,box,xlab,ylab,xticks,yticks){
 const {l,r,t,b,W,H}=box,pw=W-l-r,ph=H-t-b,x=v=>l+(Math.log10(v)-Math.log10(xmin))/(Math.log10(xmax)-Math.log10(xmin))*pw,y=v=>t+(ymax-v)/(ymax-ymin)*ph;
 xticks.forEach(v=>{svg.appendChild(E("line",{x1:x(v),y1:t,x2:x(v),y2:H-b,class:"grid"}));svg.appendChild(E("text",{x:x(v),y:H-b+20,"text-anchor":"middle",class:"tick"},v>=1?fmt(v,v>=10?0:1):fmt(v,2)))});
 yticks.forEach(v=>{svg.appendChild(E("line",{x1:l,y1:y(v),x2:W-r,y2:y(v),class:"grid"}));svg.appendChild(E("text",{x:l-9,y:y(v)+4,"text-anchor":"end",class:"tick"},fmt(v,0)))});
 svg.appendChild(E("line",{x1:l,y1:H-b,x2:W-r,y2:H-b,class:"axis"}));svg.appendChild(E("line",{x1:l,y1:t,x2:l,y2:H-b,class:"axis"}));
 svg.appendChild(E("text",{x:l+pw/2,y:H-10,"text-anchor":"middle",class:"axislabel"},xlab));
 svg.appendChild(E("text",{x:17,y:t+ph/2,"text-anchor":"middle",class:"axislabel",transform:`rotate(-90 17 ${t+ph/2})`},ylab));
 return{x,y}
}
function drawBode(q){
 clear(bode);const W=1000,H=650,l=70,r=25;const freqs=logspace(-1.5,1.7,500);const data=freqs.map(w=>{const m=mp(frequencyResponse(w,q));return{w,db:20*Math.log10(m.mag),ph:m.phase}});
 let dmin=Math.min(-40,...data.map(d=>d.db)),dmax=Math.max(10,...data.map(d=>d.db));dmin=Math.floor(dmin/10)*10-5;dmax=Math.ceil(dmax/10)*10+5;
 const xt=[.05,.1,.2,.5,1,2,5,10,20,50].filter(x=>x>=freqs[0]&&x<=freqs.at(-1));
 const top={W,H:315,l,r,t:20,b:45}, bot={W,H:650,l,r,t:345,b:25};
 const A=axes(bode,freqs[0],freqs.at(-1),dmin,dmax,top,"ω (rad/s)","Magnitude (dB)",xt,[...Array(Math.ceil((dmax-dmin)/20)+1)].map((_,i)=>Math.ceil(dmin/20)*20+i*20).filter(v=>v<=dmax));
 const B=axes(bode,freqs[0],freqs.at(-1),-190,10,bot,"ω (rad/s)","Phase (deg)",xt,[0,-45,-90,-135,-180]);
 bode.appendChild(E("path",{d:path(data.map(d=>({x:d.w,y:d.db})),A.x,A.y),class:"mag-line"}));
 bode.appendChild(E("path",{d:path(data.map(d=>({x:d.w,y:d.ph})),B.x,B.y),class:"phase-line"}));
 const cur=mp(frequencyResponse(q.w,q));[A,B].forEach((S,i)=>bode.appendChild(E("line",{x1:S.x(q.w),y1:i?345:20,x2:S.x(q.w),y2:i?625:270,class:"selected-line"})));
 bode.appendChild(E("circle",{cx:A.x(q.w),cy:A.y(20*Math.log10(cur.mag)),r:4.5,class:"selected-dot-mag"}));
 bode.appendChild(E("circle",{cx:B.x(q.w),cy:B.y(cur.phase),r:4.5,class:"selected-dot-phase"}));
}
function drawSine(q){
 clear(sine);const W=1000,H=440,M={l:70,r:25,t:20,b:55},pw=W-M.l-M.r,ph=H-M.t-M.b;
 const cur=mp(frequencyResponse(q.w,q)),period=2*Math.PI/q.w,tEnd=3*period;
 const pts=Array.from({length:700},(_,i)=>{const t=tEnd*i/699;return{t,u:Math.sin(q.w*t),y:cur.mag*Math.sin(q.w*t+cur.phase*Math.PI/180)}});
 let ymin=Math.min(-1,...pts.map(a=>a.y)),ymax=Math.max(1,...pts.map(a=>a.y));const pad=.15*(ymax-ymin);ymin-=pad;ymax+=pad;
 const x=t=>M.l+t/tEnd*pw,y=v=>M.t+(ymax-v)/(ymax-ymin)*ph;
 for(let i=0;i<=6;i++){let t=tEnd*i/6;sine.appendChild(E("line",{x1:x(t),y1:M.t,x2:x(t),y2:H-M.b,class:"grid"}));sine.appendChild(E("text",{x:x(t),y:H-M.b+21,"text-anchor":"middle",class:"tick"},fmt(t,tEnd<10?2:1)))}
 [-1,0,1].filter(v=>v>=ymin&&v<=ymax).forEach(v=>{sine.appendChild(E("line",{x1:M.l,y1:y(v),x2:W-M.r,y2:y(v),class:v===0?"zero":"grid"}));sine.appendChild(E("text",{x:M.l-9,y:y(v)+4,"text-anchor":"end",class:"tick"},fmt(v,1)))});
 sine.appendChild(E("path",{d:path(pts.map(a=>({x:a.t,y:a.u})),x,y),class:"input-line"}));sine.appendChild(E("path",{d:path(pts.map(a=>({x:a.t,y:a.y})),x,y),class:"output-line"}));
 sine.appendChild(E("line",{x1:M.l,y1:H-M.b,x2:W-M.r,y2:H-M.b,class:"axis"}));sine.appendChild(E("line",{x1:M.l,y1:M.t,x2:M.l,y2:H-M.b,class:"axis"}));
 sine.appendChild(E("text",{x:M.l+pw/2,y:H-12,"text-anchor":"middle",class:"axislabel"},"time t (s)"));
 sine.appendChild(E("text",{x:M.l+12,y:M.t+18,class:"axislabel"},"blue: input u(t)     green: output y(t)"))
}
function render(){
 const q=p(),cur=mp(frequencyResponse(q.w,q));
 document.querySelectorAll(".first-only").forEach(e=>e.classList.toggle("hidden",q.type!=="first"));document.querySelectorAll(".second-only").forEach(e=>e.classList.toggle("hidden",q.type!=="second"));
 document.querySelector(".first-concept").classList.toggle("hidden",q.type!=="first");document.querySelector(".second-concept").classList.toggle("hidden",q.type!=="second");
 $("gainVal").textContent=fmt(q.K,2);$("tauVal").textContent=fmt(q.tau,2)+" s";$("wnVal").textContent=fmt(q.wn,2)+" rad/s";$("zetaVal").textContent=fmt(q.zeta,2);$("omegaVal").textContent=fmt(q.w,q.w<1?2:1)+" rad/s";
 $("magStat").textContent=fmt(cur.mag,3);$("dbStat").textContent=fmt(20*Math.log10(cur.mag),2)+" dB";$("phaseStat").textContent=fmt(cur.phase,1)+"°";$("periodStat").textContent=fmt(2*Math.PI/q.w,2)+" s";
 $("pointFormula").innerHTML=`At ω = ${fmt(q.w,2)} rad/s: &nbsp; y<sub>ss</sub>(t) = ${fmt(cur.mag,3)} sin(${fmt(q.w,2)}t ${cur.phase<0?"−":"+"} ${fmt(Math.abs(cur.phase),1)}°)`;
 drawBode(q);drawSine(q)
}
[systemType,gain,tau,wn,zeta,logw].forEach(e=>e.addEventListener("input",render));render();
})();