(() => {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const slider = $('damping');
  const poleSvg = $('polePlot');
  const responseSvg = $('responsePlot');
  const buttons = [...document.querySelectorAll('button[data-c]')];
  const cc = 4, tEnd = 12;

  const el = (tag, attrs={}, text='') => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v));
    if (text) n.textContent = text;
    return n;
  };
  const clear = s => { while (s.firstChild) s.removeChild(s.firstChild); };
  const fmt = (v,n=2) => (Math.abs(v)<1e-10?0:v).toFixed(n);

  function poles(c){
    const d=c*c-16;
    if(d<0){ const a=-c/2,b=Math.sqrt(-d)/2; return [{re:a,im:b},{re:a,im:-b}]; }
    if(Math.abs(d)<1e-10) return [{re:-2,im:0},{re:-2,im:0}];
    const q=Math.sqrt(d); return [{re:(-c+q)/2,im:0},{re:(-c-q)/2,im:0}];
  }

  function regime(c){
    if(c===0) return 'Undamped';
    if(c<4) return 'Underdamped';
    if(c===4) return 'Critically damped';
    return 'Overdamped';
  }

  function xOf(t,c){
    if(c===0) return 1-Math.cos(2*t);
    if(c<4){
      const w=Math.sqrt(4-c*c/4);
      return 1-Math.exp(-c*t/2)*(Math.cos(w*t)+(c/(2*w))*Math.sin(w*t));
    }
    if(c===4) return 1-(1+2*t)*Math.exp(-2*t);
    const p=poles(c), r1=p[0].re, r2=p[1].re;
    const A=r2/(r1-r2), B=-r1/(r1-r2);
    return 1+A*Math.exp(r1*t)+B*Math.exp(r2*t);
  }

  function data(c){
    const a=[]; for(let i=0;i<=900;i++){ const t=tEnd*i/900; a.push({t,x:xOf(t,c)}); } return a;
  }
  const critical=data(4);

  function settling(d,c){
    if(c===0) return null;
    let last=-1; d.forEach((p,i)=>{ if(Math.abs(p.x-1)>.02) last=i; });
    return last>=d.length-1 ? Infinity : d[last+1].t;
  }

  function axes(svg,W,H,pad,x0,x1,y0,y1,xt,yt,xlab,ylab){
    const X=v=>pad.l+(v-x0)/(x1-x0)*(W-pad.l-pad.r);
    const Y=v=>pad.t+(y1-v)/(y1-y0)*(H-pad.t-pad.b);
    xt.forEach(v=>{ svg.appendChild(el('line',{x1:X(v),y1:pad.t,x2:X(v),y2:H-pad.b,class:'grid'})); svg.appendChild(el('text',{x:X(v),y:H-pad.b+20,'text-anchor':'middle',class:'ticktext'},String(v))); });
    yt.forEach(v=>{ svg.appendChild(el('line',{x1:pad.l,y1:Y(v),x2:W-pad.r,y2:Y(v),class:'grid'})); svg.appendChild(el('text',{x:pad.l-8,y:Y(v)+4,'text-anchor':'end',class:'ticktext'},String(v))); });
    if(x0<=0&&x1>=0) svg.appendChild(el('line',{x1:X(0),y1:pad.t,x2:X(0),y2:H-pad.b,class:'axis'}));
    if(y0<=0&&y1>=0) svg.appendChild(el('line',{x1:pad.l,y1:Y(0),x2:W-pad.r,y2:Y(0),class:'axis'}));
    svg.appendChild(el('text',{x:(pad.l+W-pad.r)/2,y:H-12,'text-anchor':'middle',class:'axislabel'},xlab));
    svg.appendChild(el('text',{x:17,y:(pad.t+H-pad.b)/2,'text-anchor':'middle',class:'axislabel',transform:`rotate(-90 17 ${(pad.t+H-pad.b)/2})`},ylab));
    return {X,Y};
  }

  function drawPoles(c){
    clear(poleSvg); const W=700,H=520,p={l:62,r:25,t:25,b:56};
    const m=axes(poleSvg,W,H,p,-8,1,-2.7,2.7,[-8,-6,-4,-2,0],[-2,-1,0,1,2],'Re(s)','Im(s)');
    const path=pts=>pts.map((q,i)=>`${i?'L':'M'}${m.X(q.re).toFixed(1)},${m.Y(q.im).toFixed(1)}`).join(' ');
    const top=[],bot=[],b1=[],b2=[];
    for(let i=0;i<=100;i++){ let c0=4*i/100,q=poles(c0); top.push(q[0]); bot.push(q[1]); let c1=4+4*i/100,r=poles(c1); b1.push(r[0]); b2.push(r[1]); }
    [top,bot,b1,b2].forEach(a=>poleSvg.appendChild(el('path',{d:path(a),class:'pole-track'})));
    poleSvg.appendChild(el('circle',{cx:m.X(-2),cy:m.Y(0),r:7,class:'critical-dot'}));
    poleSvg.appendChild(el('text',{x:m.X(-2)+10,y:m.Y(0)-11,class:'critical-label'},'critical: −2'));
    poleSvg.appendChild(el('text',{x:m.X(-.1),y:m.Y(2.18),'text-anchor':'end',class:'imag-note'},'undamped: ±j2'));
    poles(c).forEach((q,i)=>{ const x=m.X(q.re),y=m.Y(q.im),s=8; poleSvg.appendChild(el('line',{x1:x-s,y1:y-s,x2:x+s,y2:y+s,class:'pole'})); poleSvg.appendChild(el('line',{x1:x-s,y1:y+s,x2:x+s,y2:y-s,class:'pole'})); if(!(c===4&&i===1)) poleSvg.appendChild(el('text',{x:x+11,y:y-11,class:'pole-label'},`p${i+1}`)); });
  }

  function drawResponse(c,d){
    clear(responseSvg); const W=700,H=520,p={l:62,r:25,t:25,b:56};
    const m=axes(responseSvg,W,H,p,0,12,-.15,2.15,[0,2,4,6,8,10,12],[0,.5,1,1.5,2],'time t (s)','displacement x(t)');
    const path=a=>a.map((q,i)=>`${i?'L':'M'}${m.X(q.t).toFixed(1)},${m.Y(q.x).toFixed(1)}`).join(' ');
    responseSvg.appendChild(el('line',{x1:m.X(0),y1:m.Y(1),x2:m.X(12),y2:m.Y(1),class:'steady-line'}));
    responseSvg.appendChild(el('path',{d:path(critical),class:'reference-line'}));
    responseSvg.appendChild(el('path',{d:path(d),class:'response-line'}));
    responseSvg.appendChild(el('text',{x:m.X(11.7),y:m.Y(1)-8,'text-anchor':'end',class:'imag-note'},'xₛₛ = 1'));
  }

  function insight(c){
    const p=poles(c), r=regime(c), title=$('insightTitle'), text=$('insightText'), eq=$('insightEquation');
    if(r==='Undamped'){
      title.textContent='The poles sit on the imaginary axis.';
      text.textContent='With no negative real part, the oscillation does not decay in this ideal model.';
      eq.textContent='p = ±j2  →  sustained oscillation';
    } else if(r==='Underdamped'){
      title.textContent='The poles are a complex-conjugate pair.';
      text.textContent='The negative real part produces decay; the imaginary part produces oscillation. Increasing c moves the pair toward the critical point.';
      eq.textContent=`p = ${fmt(p[0].re)} ± j${fmt(Math.abs(p[0].im))}  →  decaying oscillation`;
    } else if(r==='Critically damped'){
      title.textContent='The two poles meet at s = −2.';
      text.textContent='This is the boundary between oscillatory and non-oscillatory motion. For fixed m and k, it is the fastest non-oscillatory return.';
      eq.textContent='p₁ = p₂ = −2  →  fastest non-oscillatory return';
    } else {
      const slow=Math.max(p[0].re,p[1].re);
      title.textContent='Extra damping creates a slow real pole.';
      text.textContent='Past critical damping, one pole moves farther left while the other moves back toward the imaginary axis. The latter becomes the slow mode.';
      eq.textContent=`slow pole = ${fmt(slow)}  →  slower non-oscillatory response`;
    }
  }

  function update(){
    const c=+slider.value, d=data(c), p=poles(c), ts=settling(d,c), r=regime(c);
    $('cValue').textContent=`c = ${fmt(c)}`;
    $('regimeBadge').textContent=r;
    $('poleStat').textContent=c<4?`${fmt(p[0].re)} ± j${fmt(Math.abs(p[0].im))}`:c===4?'−2.00 (double)':`${fmt(p[0].re)}, ${fmt(p[1].re)}`;
    $('responseStat').textContent=r==='Undamped'?'Sustained oscillation':r==='Underdamped'?'Decaying oscillation':r==='Critically damped'?'Fast, no oscillation':'Slow, no oscillation';
    $('slowPoleStat').textContent=c===0?'0 — no decay':`${fmt(Math.abs(Math.max(p[0].re,p[1].re)))} s⁻¹`;
    $('settlingStat').textContent=c===0?'Does not settle':ts===Infinity?'> 12 s':`${fmt(ts)} s`;
    buttons.forEach(b=>b.classList.toggle('active',Math.abs(+b.dataset.c-c)<1e-9));
    drawPoles(c); drawResponse(c,d); insight(c);
  }

  slider.addEventListener('input',update);
  buttons.forEach(b=>b.addEventListener('click',()=>{ slider.value=b.dataset.c; update(); }));
  update();
})();
