const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const touch=matchMedia("(hover:none)").matches;

const nav=document.getElementById("nav");
const railFill=document.getElementById("rail-fill");
addEventListener("scroll",()=>{
  const y=scrollY; nav.classList.toggle("scrolled",y>20);
  const h=document.documentElement.scrollHeight-innerHeight;
  if(railFill) railFill.style.width=(h>0?(y/h*100):0)+"%";
},{passive:true});

const copyBtn=document.getElementById("copy-btn");
copyBtn&&copyBtn.addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(document.getElementById("install-cmd").textContent.trim());
    copyBtn.classList.add("ok");
    copyBtn.innerHTML='<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6 11.5 2.5 8l1-1L6 9.5 12.5 3l1 1z"/></svg>copied';
    setTimeout(()=>{copyBtn.classList.remove("ok");copyBtn.innerHTML='<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h7a1 1 0 011 1v1h1a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-1H4a1 1 0 01-1-1V3a1 1 0 011-1Zm2 3v7h6V5H6Z"/></svg>copy';},1600);
  }catch(e){}
});

(function headline(){
  document.querySelectorAll(".h1 .ln > span").forEach((s,i)=>{
    if(reduced){s.style.transform="none";return;}
    setTimeout(()=>{s.style.transition="transform .85s var(--ease2)";s.style.transform="none";},80+i*130);
  });
  const em=document.querySelector(".h1 em"); if(em) setTimeout(()=>em.classList.add("draw"),420);
})();

/* ── PHYSICS HERO: features fall, the gate passes or rejects ── */
(function physics(){
  const stage=document.getElementById("stage");
  const canvas=document.getElementById("physics");
  const dropBtn=document.getElementById("drop");
  const mergedEl=document.getElementById("merged");
  const rejectedEl=document.getElementById("rejected");
  if(!canvas||!window.Matter){ if(canvas)canvas.style.display="none"; if(dropBtn)dropBtn.style.display="none"; return; }
  const M=Matter, ctx=canvas.getContext("2d");
  let W=0,H=0,dpr=Math.min(devicePixelRatio||1,2);
  const engine=M.Engine.create(); engine.gravity.y=1;
  const world=engine.world;
  const NAMES=["auth","billing","webhooks","search","upload","profile","api","cache","oauth","export"];
  const STATE={
    falling:{fill:"#1b1c22",stroke:"#3a3d46",text:"#c8cdd6"},
    passed:{fill:"rgba(245,166,35,.12)",stroke:"#f5a623",text:"#f5a623"},
    failed:{fill:"rgba(214,87,69,.12)",stroke:"#d65745",text:"#e6897c"}
  };
  const tiles=[]; let walls=[], gateBody=null, gw=0;
  let flash={t:0,type:"pass"}, merged=0, rejected=0, nameIdx=0;

  function size(){
    const r=stage.getBoundingClientRect(); W=r.width; H=r.height;
    canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+"px"; canvas.style.height=H+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0); rebuildStatics();
  }
  function rebuildStatics(){
    walls.forEach(w=>M.World.remove(world,w)); if(gateBody)M.World.remove(world,gateBody);
    const opt={isStatic:true,restitution:.2,friction:.7}, t=40;
    walls=[
      M.Bodies.rectangle(W/2,H+t/2,W+t*2,t,opt),
      M.Bodies.rectangle(-t/2,H/2,t,H*2,opt),
      M.Bodies.rectangle(W+t/2,H/2,t,H*2,opt),
    ];
    M.World.add(world,walls);
    gw=Math.min(W*0.8,400);
    gateBody=M.Bodies.rectangle(W/2,H-46,gw,12,{isStatic:true,friction:.85,restitution:.05,chamfer:{radius:6}});
    M.World.add(world,gateBody);
  }
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function spawnFeature(x){
    const label=NAMES[nameIdx++%NAMES.length];
    const w=Math.max(58,Math.min(W*0.22,label.length*9+34)), h=34;
    const b=M.Bodies.rectangle(x,-28,w,h,{restitution:.3,friction:.5,frictionAir:.018,chamfer:{radius:8},density:.0015});
    M.Body.setAngularVelocity(b,(Math.random()-.5)*.05);
    const tile={body:b,w,h,label,state:"falling",removeAt:0}; M.World.add(world,b); tiles.push(tile);
    trim();
  }
  const CAP=14;
  function trim(){ while(tiles.length>CAP){ const old=tiles.shift(); M.World.remove(world,old.body); } }
  function judge(tile){
    if(tile.state!=="falling") return;
    flash={t:performance.now(),type:"pass"};
    if(Math.random()<0.78){
      tile.state="passed"; merged++; if(mergedEl)mergedEl.textContent=merged;
      tile.removeAt=performance.now()+2600;
    }else{
      tile.state="failed"; rejected++; if(rejectedEl)rejectedEl.textContent=rejected;
      flash.type="fail";
      const dir=tile.body.position.x<W/2?1:-1;
      M.Body.setVelocity(tile.body,{x:dir*(5+Math.random()*3),y:-(7+Math.random()*2)});
      M.Body.setAngularVelocity(tile.body,dir*0.2);
      tile.removeAt=performance.now()+1200;
    }
  }
  M.Events.on(engine,"collisionStart",e=>{
    e.pairs.forEach(p=>{
      const other=p.bodyA===gateBody?p.bodyB:(p.bodyB===gateBody?p.bodyA:null);
      if(!other) return;
      const tile=tiles.find(t=>t.body===other);
      if(tile) judge(tile);
    });
  });

  let lastSpawn=0;
  function autoSpawn(t){ if(t-lastSpawn<1900)return; lastSpawn=t; spawnFeature(W*0.32+Math.random()*W*0.36); }

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="rgba(236,230,216,.05)";
    for(let gx=18;gx<W;gx+=26) for(let gy=18;gy<H;gy+=26) ctx.fillRect(gx,gy,1,1);
    if(gateBody){
      const dt=performance.now()-flash.t, hot=dt<340;
      const col=flash.type==="fail"?"#d65745":"#f5a623";
      ctx.save(); ctx.translate(gateBody.position.x,gateBody.position.y);
      roundRect(-gw/2,-6,gw,12,6);
      ctx.fillStyle=hot?(flash.type==="fail"?"rgba(214,87,69,.18)":"rgba(245,166,35,.18)"):"rgba(236,230,216,.06)"; ctx.fill();
      ctx.lineWidth=1.5; ctx.strokeStyle=hot?col:"rgba(236,230,216,.4)"; ctx.stroke();
      ctx.fillStyle=hot?col:"rgba(236,230,216,.35)"; ctx.font="9px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("GATE",0,1); ctx.restore();
    }
    const now=performance.now();
    tiles.forEach(tile=>{
      const b=tile.body, c=STATE[tile.state];
      let alpha=1;
      if(tile.removeAt && now>tile.removeAt-400) alpha=Math.max(0,(tile.removeAt-now)/400);
      ctx.save(); ctx.globalAlpha=alpha; ctx.translate(b.position.x,b.position.y); ctx.rotate(b.angle);
      ctx.shadowColor="rgba(0,0,0,.4)"; ctx.shadowBlur=12; ctx.shadowOffsetY=4;
      roundRect(-tile.w/2,-tile.h/2,tile.w,tile.h,8);
      ctx.fillStyle=c.fill; ctx.fill();
      ctx.shadowColor="transparent"; ctx.shadowBlur=0;
      ctx.lineWidth=1.5; ctx.strokeStyle=c.stroke; ctx.stroke();
      ctx.fillStyle=c.text; ctx.font="600 11px 'JetBrains Mono',monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
      const mark=tile.state==="passed"?"  ✓":(tile.state==="failed"?"  ✗":"");
      ctx.fillText(tile.label+mark,0,1);
      ctx.restore();
    });
  }
  function loop(){
    if(!document.hidden){
      M.Engine.update(engine,1000/60);
      autoSpawn(performance.now());
      const now=performance.now();
      for(let i=tiles.length-1;i>=0;i--){
        const t=tiles[i];
        if(t.state==="falling"){
          const sp=Math.hypot(t.body.velocity.x,t.body.velocity.y);
          if(t.body.position.y>H-58 && sp<0.7) judge(t);
        }
        if(t.removeAt && now>t.removeAt){ M.World.remove(world,t.body); tiles.splice(i,1); continue; }
        if(t.body.position.y>H+160){ M.World.remove(world,t.body); tiles.splice(i,1); }
      }
      draw();
    }
    requestAnimationFrame(loop);
  }
  function staticFallback(){
    size(); tiles.length=0;
    const labels=["auth","billing","webhooks"];
    labels.forEach((l,i)=>{
      const w=l.length*9+34;
      const b=M.Bodies.rectangle(W/2+(i-1)*(w+12),H-70,w,34,{isStatic:true,chamfer:{radius:8}});
      tiles.push({body:b,w,h:34,label:l,state:"passed",removeAt:0}); M.World.add(world,b);
    });
    draw(); if(dropBtn)dropBtn.style.display="none";
  }

  size();
  if(reduced){ staticFallback(); return; }
  spawnFeature(W*0.4); spawnFeature(W*0.55);
  if(dropBtn) dropBtn.addEventListener("click",()=>spawnFeature(W*0.3+Math.random()*W*0.4));
  if(!touch){
    const mouse=M.Mouse.create(canvas); mouse.pixelRatio=dpr;
    const mc=M.MouseConstraint.create(engine,{mouse,constraint:{stiffness:.2,render:{visible:false}}});
    M.World.add(world,mc);
    ["wheel","mousewheel","DOMMouseScroll"].forEach(ev=>{ if(mouse.element&&mouse.mousewheel) mouse.element.removeEventListener(ev,mouse.mousewheel); });
  }
  window.addEventListener("resize",()=>{ dpr=Math.min(devicePixelRatio||1,2); size(); });
  loop();
})();

/* ── live observatory bars ── */
(function obsLive(){
  if(reduced) return;
  const ol1=document.getElementById("ol1"), ol2=document.getElementById("ol2");
  const ot1=document.getElementById("ot1"), ot2=document.getElementById("ot2");
  if(!ol1) return;
  let p1=46,p2=12,s1=58,s2=14;
  setInterval(()=>{
    p1+=Math.random()*7+2; if(p1>=96){p1=22;} ol1.style.width=p1.toFixed(0)+"%";
    p2+=Math.random()*6+2; if(p2>=78){p2=10;} ol2.style.width=p2.toFixed(0)+"%";
    s1+=1; if(ot1) ot1.textContent=s1+"s";
    if(Math.random()<0.5){ s2+=1; if(ot2) ot2.textContent=s2+"s"; }
  },1500);
})();

/* ── live GitHub stars ── */
(function stars(){
  const el=document.getElementById("stars"); if(!el) return;
  const REPO="Ratel-Factory/Ratel-Factory";
  fetch("https://api.github.com/repos/"+REPO).then(r=>r.ok?r.json():null).then(d=>{
    if(d&&typeof d.stargazers_count==="number") el.textContent=d.stargazers_count.toLocaleString();
  }).catch(()=>{});
})();

/* ── GSAP reveals, counters, anatomy ── */
if(window.gsap){
  gsap.registerPlugin(ScrollTrigger);
  if(!reduced){
    gsap.utils.toArray(".reveal").forEach(el=>{
      gsap.to(el,{opacity:1,y:0,duration:.85,ease:"power3.out",scrollTrigger:{trigger:el,start:"top 90%"}});
    });
    gsap.utils.toArray(".count").forEach(el=>{
      const to=parseFloat(el.dataset.to),suf=el.dataset.suffix||"",obj={v:0};
      ScrollTrigger.create({trigger:el,start:"top 92%",once:true,onEnter:()=>gsap.to(obj,{v:to,duration:1.4,ease:"power2.out",onUpdate:()=>{el.textContent=Math.round(obj.v)+suf;}})});
    });
    const viz=document.getElementById("viz");
    const gateLabel=document.getElementById("gate-label");
    const phStage=document.getElementById("ph-stage");
    const steps=gsap.utils.toArray(".ana-step");
    function setStage(step){
      steps.forEach(s=>s.classList.remove("active")); step.classList.add("active");
      viz.querySelectorAll(".nodeG").forEach(n=>n.classList.remove("lit"));
      viz.querySelectorAll(".edge").forEach(e=>e.classList.remove("on"));
      (step.dataset.lit||"").split(",").filter(Boolean).forEach(id=>{const n=document.getElementById(id);if(n)n.classList.add("lit");});
      (step.dataset.edge||"").split(",").filter(Boolean).forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add("on");});
      if(gateLabel) gateLabel.textContent=step.dataset.gate||"GATE · LOCKED";
      if(phStage) phStage.textContent=step.dataset.ph||"";
    }
    steps.forEach(step=>{ ScrollTrigger.create({trigger:step,start:"top center",end:"bottom center",onEnter:()=>setStage(step),onEnterBack:()=>setStage(step)}); });
    setStage(steps[0]);
  } else {
    gsap.utils.toArray(".reveal").forEach(el=>el.style.opacity=1);
    document.querySelectorAll(".ana-step").forEach(s=>s.classList.add("active"));
    document.querySelectorAll("#viz .nodeG").forEach(n=>n.classList.add("lit"));
  }
}
