/* Slideshows: click right/left of the image, PREV/NEXT, swipe, or the model thumbnails */
document.querySelectorAll('.show').forEach(show=>{
  const pics=[...show.querySelectorAll('.frame > picture')];
  if(pics.length<2)return;
  const num=show.querySelector('.num');
  const row=show.closest('.row');
  const thumbs=row?[...row.querySelectorAll('.thumb')]:[];
  let i=0;
  const dissolve=show.classList.contains('hero')||show.classList.contains('fade');
  const set=n=>{
    i=(n+pics.length)%pics.length;
    if(dissolve){pics.forEach((p,k)=>{p.hidden=false;p.classList.toggle('on',k===i)})}
    else pics.forEach((p,k)=>p.hidden=k!==i);
    if(num)num.textContent=String(i+1).padStart(2,'0')+' / '+String(pics.length).padStart(2,'0');
    const capEl=show.querySelector('.cap');if(capEl&&show.dataset.caps){try{const txt=JSON.parse(show.dataset.caps)[i];if(capEl.innerHTML!==txt){if(show.classList.contains('ready')){capEl.classList.add('swap');setTimeout(()=>{capEl.innerHTML=txt;capEl.classList.remove('swap')},700)}else capEl.innerHTML=txt}}catch(e){}}
    thumbs.forEach((t,k)=>t.classList.toggle('on',k===i));
    const nx=pics[(i+1)%pics.length].querySelector('img');if(nx)nx.loading='eager';
  };
  show.querySelectorAll('.counter button').forEach(b=>b.addEventListener('click',()=>set(i+ +b.dataset.d)));
  thumbs.forEach(t=>t.addEventListener('click',()=>{set(+t.dataset.go);if(matchMedia('(max-width:900px)').matches)show.scrollIntoView({behavior:'smooth',block:'start'})}));
  const frame=show.querySelector('.frame');
  let sx=0,sy=0,swiped=false;
  frame.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY;swiped=false},{passive:true});
  frame.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5){swiped=true;set(i+(dx<0?1:-1))}},{passive:true});
  frame.addEventListener('click',e=>{if(swiped){swiped=false;return}const img=e.target.closest('img');if(!img)return;const r=img.getBoundingClientRect();set(i+(e.clientX<r.left+r.width*.3?-1:1))});
  /* HOME: auto-advance, and the index links preview their page's photo */
  const auto=+show.dataset.auto||0;
  if(auto&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    let held=false;
    let last=Date.now();
    const go=n=>{last=Date.now();set(n)};
    show.addEventListener('click',()=>{last=Date.now()},true);
    show.addEventListener('touchend',()=>{last=Date.now()},{passive:true,capture:true});
    setInterval(()=>{if(!held&&!document.hidden&&Date.now()-last>=auto-50)go(i+1)},auto);
    document.querySelectorAll('[data-slide]').forEach(a=>{
      a.addEventListener('mouseenter',()=>{held=true;set(+a.dataset.slide)});
      a.addEventListener('mouseleave',()=>{held=false});
      a.addEventListener('focus',()=>{held=true;set(+a.dataset.slide)});
      a.addEventListener('blur',()=>{held=false});
    });
  }
  show.tabIndex=0;
  show.addEventListener('keydown',e=>{if(e.key==='ArrowRight')set(i+1);if(e.key==='ArrowLeft')set(i-1)});
  set(0);
  show.classList.add('ready');
});

/* ---------- quiet motion across the site ---------- */
(()=>{
  /* phones: a touch brightens the Instagram photo under the finger.
     Holding it for 2.5 seconds opens the post on Instagram (a thin line fills up while you hold). */
  const touchOnly=matchMedia('(hover: none)').matches;
  const HOLD=2500;
  document.querySelectorAll('.home-ig .ig-post').forEach(a=>{
    let t,start=0,sx=0,sy=0,moved=false;
    a.addEventListener('touchstart',e=>{
      clearTimeout(t);const p=e.touches[0];sx=p.clientX;sy=p.clientY;moved=false;start=Date.now();
      a.classList.add('lit','holding');
    },{passive:true});
    a.addEventListener('touchmove',e=>{
      const p=e.touches[0];
      if(!moved&&Math.hypot(p.clientX-sx,p.clientY-sy)>10){moved=true;a.classList.remove('holding')}
    },{passive:true});
    const end=e=>{
      const held=!moved&&Date.now()-start>=HOLD;
      a.classList.remove('holding');
      clearTimeout(t);t=setTimeout(()=>a.classList.remove('lit'),900);
      if(e.type==='touchend'&&held){e.preventDefault();window.open(a.href,'_blank','noopener')}
    };
    a.addEventListener('touchend',end);a.addEventListener('touchcancel',end,{passive:true});
    a.addEventListener('contextmenu',e=>{if(touchOnly)e.preventDefault()});
    a.addEventListener('click',e=>{if(touchOnly)e.preventDefault()});   /* a short tap only brightens */
  });
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* photos fade in once they have loaded */
  document.querySelectorAll('img.ph').forEach(img=>{
    if(img.complete&&img.naturalWidth)return;
    img.classList.add('wait');
    const done=()=>img.classList.remove('wait');
    img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});
  });
  /* the header gets a hairline once the page scrolls */
  const top=document.querySelector('.top');
  const onScroll=()=>top&&top.classList.toggle('scrolled',scrollY>8);
  addEventListener('scroll',onScroll,{passive:true});onScroll();
  /* PAGE TOP */
  document.querySelectorAll('.to-top').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();scrollTo({top:0,behavior:still?'auto':'smooth'})}));
  if(still||!('IntersectionObserver' in window))return;
  /* sections and Instagram posts rise gently into view */
  const items=[...document.querySelectorAll('main > .row:not(.first), .home-ig .ig-head, .ig-post, .foot')];
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px',threshold:.06});
  items.forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.top<innerHeight*.92)return; /* already on screen: leave it */
    el.classList.add('reveal');
    if(el.classList.contains('ig-post')){const k=[...el.parentNode.children].indexOf(el);el.style.transitionDelay=(k%6)*90+'ms'}
    io.observe(el);
  });
  /* internal links fade the page out before leaving */
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    if(a.target&&a.target!=='_self')return;
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:)/i.test(href))return;
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(()=>{location.href=a.href},320);
  });
  addEventListener('pageshow',()=>document.body.classList.remove('leaving'));
})();
