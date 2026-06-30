const cur = document.getElementById('cursor');
const crng = document.getElementById('cring');
let mx = innerWidth/2, my = innerHeight/2, rx = mx, ry = my;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cur.style.left = mx+'px'; cur.style.top = my+'px';
});
(function raf(){
  rx += (mx-rx)*.13; ry += (my-ry)*.13;
  crng.style.left = Math.round(rx)+'px';
  crng.style.top  = Math.round(ry)+'px';
  requestAnimationFrame(raf);
})();
document.querySelectorAll('a,button,[data-h],.co,.wcard').forEach(el => {
  el.addEventListener('mouseenter', () => { cur.classList.add('big'); crng.classList.add('big'); });
  el.addEventListener('mouseleave', () => { cur.classList.remove('big'); crng.classList.remove('big'); });
});

window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('sc', scrollY > 60);
}, {passive:true});

// HERO ANIMATION (index only)
if(typeof HeroAnimation !== 'undefined' && document.getElementById('hr')){
  HeroAnimation.init({
    container : '#hr',
    bgImage   : 'image/baseimg.jpeg',
    topImage  : 'image/austria.jpeg',
    label     : 'Hallstatt, Austria'
  });
}

// CARD GLOW (work + craft)
document.querySelectorAll('.wcard,.craft-card').forEach(c => {
  c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--px', ((e.clientX-r.left)/r.width*100).toFixed(1)+'%');
    c.style.setProperty('--py', ((e.clientY-r.top)/r.height*100).toFixed(1)+'%');
  });
});

// INTERSECTION OBSERVERS
const io1 = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('in');io1.unobserve(e.target);} });
}, {threshold:.1});
const io2 = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('in');io2.unobserve(e.target);} });
}, {threshold:.07});

document.querySelectorAll('.stat').forEach((el,i) => { el.style.transitionDelay=(i*.06)+'s'; io1.observe(el); });
document.querySelectorAll('.rv').forEach(el => io1.observe(el));
document.querySelectorAll('.rvx,.rvp,.rvt').forEach(el => io2.observe(el));

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if(t) { e.preventDefault(); t.scrollIntoView({behavior:'smooth',block:'start'}); }
  });
});

// FOOTER LOADER
fetch('footer.html')
  .then(r => r.text())
  .then(html => {
    document.getElementById('footer-placeholder').outerHTML = html;
  });
