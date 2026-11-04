/* Presentation only. Does not read/write student storage or alter app actions. */
(()=>{
 'use strict';
 const body=document.body,hero=document.querySelector('.journey-hero'),content=document.getElementById('content');
 if(!hero||!content)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 let frame=0,heroVisible=true,revealObserver=null;
 const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(update);};
 function update(){frame=0;body.dataset.scrolled=String(window.scrollY>12);if(reduced.matches||!heroVisible)return;const rect=hero.getBoundingClientRect();const travel=Math.max(0,Math.min(22,-rect.top*.07));hero.style.setProperty('--scroll-depth',travel+'px');}
 function resetPointer(){hero.style.setProperty('--pointer-x','0px');hero.style.setProperty('--pointer-y','0px');}
 function reveal(){if(!revealObserver)return;content.querySelectorAll('.panel,.plan-cta').forEach((el,index)=>{if(el.classList.contains('reveal-item'))return;el.classList.add('reveal-item');el.style.setProperty('--reveal-delay',Math.min(index%3*45,90)+'ms');revealObserver.observe(el);});}
 function configure(){if(revealObserver)revealObserver.disconnect();revealObserver=null;body.classList.remove('motion-ready');content.querySelectorAll('.reveal-item').forEach(el=>el.classList.remove('reveal-item','is-visible'));resetPointer();hero.style.setProperty('--scroll-depth','0px');if(!reduced.matches&&typeof IntersectionObserver!=='undefined'){revealObserver=new IntersectionObserver((entries,observer)=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}});},{threshold:0,rootMargin:'0px 0px 35px 0px'});body.classList.add('motion-ready');reveal();}schedule();}
 hero.addEventListener('pointermove',event=>{if(reduced.matches||!fine.matches||event.pointerType==='touch')return;const rect=hero.getBoundingClientRect();hero.style.setProperty('--pointer-x',((event.clientX-rect.left)/rect.width-.5)*15+'px');hero.style.setProperty('--pointer-y',((event.clientY-rect.top)/rect.height-.5)*11+'px');},{passive:true});
 hero.addEventListener('pointerleave',resetPointer,{passive:true});
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else schedule();});
 if(typeof IntersectionObserver!=='undefined'){new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;if(heroVisible)schedule();},{threshold:0}).observe(hero);}
 if(typeof MutationObserver!=='undefined')new MutationObserver(reveal).observe(content,{childList:true});
 reduced.addEventListener('change',configure);fine.addEventListener('change',resetPointer);configure();
})();
