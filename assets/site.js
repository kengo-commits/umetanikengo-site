/* Slideshows: click right/left of the image, PREV/NEXT, swipe, or the model thumbnails */
document.querySelectorAll('.show').forEach(show=>{
  const pics=[...show.querySelectorAll('.frame > picture')];
  if(pics.length<2)return;
  const num=show.querySelector('.num');
  const row=show.closest('.row');
  const thumbs=row?[...row.querySelectorAll('.thumb')]:[];
  let i=0;
  const set=n=>{
    i=(n+pics.length)%pics.length;
    pics.forEach((p,k)=>p.hidden=k!==i);
    if(num)num.textContent=String(i+1).padStart(2,'0')+' / '+String(pics.length).padStart(2,'0');
    const capEl=show.querySelector('.cap');if(capEl&&show.dataset.caps){try{capEl.innerHTML=JSON.parse(show.dataset.caps)[i]}catch(e){}}
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
    setInterval(()=>{if(!held&&!document.hidden)set(i+1)},auto);
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
});
