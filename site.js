import { portraitScene, shapeScene } from './particles.js';

const root = document.documentElement;
const hero = document.querySelector('.hero');
const nav = document.querySelector('.navigation');
const menu = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');
const progressBar = document.querySelector('.scroll-progress');
const motionButton = document.querySelector('.motion-toggle');
const qualityButton = document.querySelector('.quality-toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const phone = matchMedia('(pointer: coarse) and (max-width: 700px), (pointer: coarse) and (max-height: 520px)');
const compactNav = matchMedia('(max-width: 900px)');
const finePointer = matchMedia('(pointer: fine)');
const narrative = { progress: 0, pointer: 0 };
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
let motion = !reduced.matches;
let mobileLive = false;
try {
  const saved = sessionStorage.getItem('farhan-motion');
  if (saved === 'off') motion = false;
} catch { /* The default still works when storage is unavailable. */ }

root.classList.add('js');

function setMenu(open, restoreFocus = false) {
  if (!menu) return;
  menu.setAttribute('aria-expanded', String(open));
  menu.firstElementChild.textContent = open ? 'Close' : 'Menu';
  menu.lastElementChild.textContent = open ? '×' : '☰';
  links.classList.toggle('is-open', open);
  if (open) nav.dataset.hidden = 'false';
  if (restoreFocus) menu.focus();
}

menu?.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
links?.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
compactNav.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
});
document.addEventListener('pointerdown', event => {
  if (nav && !nav.contains(event.target)) setMenu(false);
});
nav?.addEventListener('focusin', () => { nav.dataset.hidden = 'false'; });

const destinations = new Map();
for (const link of links?.querySelectorAll('a[href^="#"]') ?? []) {
  const section = document.getElementById(link.hash.slice(1));
  if (section) destinations.set(section, link);
}
const sections = [...document.querySelectorAll('main > section[id]')];
const revealTargets = new Map();
const titles = new Map();
const artwork = [...document.querySelectorAll('.work-art')];
const impact = document.querySelector('.impact-value');
let scrollFrame = 0;
let previousY = scrollY;
let travel = 0;

function updateScroll() {
  scrollFrame = 0;
  const y = Math.max(0, scrollY);
  const max = Math.max(1, root.scrollHeight - innerHeight);
  if (progressBar) progressBar.style.transform = `scaleX(${clamp(y / max)})`;
  if (hero) {
    const heroHeight = hero.offsetHeight;
    narrative.progress = clamp(y / heroHeight);
    const exit = clamp((y / heroHeight - .25) / .75);
    hero.style.setProperty('--hero-y', `${-65 * exit}px`);
    hero.style.setProperty('--hero-opacity', String(1 - .65 * exit));
  }

  if (nav) {
    const delta = y - previousY;
    if (Math.abs(delta) > .5) {
      previousY = y;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (y < 100 || nav.querySelector(':focus-visible') || menu?.getAttribute('aria-expanded') === 'true') {
        nav.dataset.hidden = 'false';
        travel = 0;
      } else if (travel > 28 || travel < -8) {
        nav.dataset.hidden = String(travel > 28);
        travel = 0;
      }
    }
    const active = sections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= innerHeight * .34 && rect.bottom > innerHeight * .34;
    });
    for (const [section, link] of destinations) {
      if (section === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  for (const art of artwork) {
    if (!motion) { art.style.removeProperty('clip-path'); continue; }
    const top = art.getBoundingClientRect().top;
    if (top > innerHeight * 1.4 || top < -art.offsetHeight) continue;
    const remaining = 1 - clamp((.95 - top / innerHeight) / .55);
    art.style.clipPath = `inset(${6 * remaining}% ${3 * remaining}%)`;
  }
  if (impact) {
    const top = impact.getBoundingClientRect().top / innerHeight;
    impact.style.letterSpacing = motion ? `${-.08 + .035 * clamp((1 - top) / .65)}em` : '';
  }
}

function queueScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
}

window.addEventListener('scroll', queueScroll, { passive: true });
window.addEventListener('resize', queueScroll, { passive: true });
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch') narrative.pointer = event.clientX / innerWidth - .5;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { narrative.pointer = 0; });

function revealOnce(selector, registry, threshold, keyframes, duration, easing) {
  const observer = new IntersectionObserver(entries => {
    if (!motion) return;
    for (const entry of entries) {
      if (!entry.isIntersecting || registry.has(entry.target)) continue;
      observer.unobserve(entry.target);
      registry.set(entry.target, entry.target.animate(keyframes, { duration, easing }));
    }
  }, { rootMargin: `0px 0px -${threshold}% 0px` });
  const elements = [...document.querySelectorAll(selector)];
  return enabled => {
    observer.disconnect();
    if (enabled) {
      for (const element of elements) if (!registry.has(element)) observer.observe(element);
    } else {
      for (const animation of registry.values()) animation.cancel();
    }
  };
}

const ease = 'cubic-bezier(.22,1,.36,1)';
const observeReveals = revealOnce('[data-reveal]', revealTargets, 6, [
  { transform: 'translateY(32px)' }, { transform: 'translateY(0)' },
], 850, ease);
const observeTitles = revealOnce('.chapter h2', titles, 9, [
  { transform: 'translateY(14px)', filter: 'blur(7px)', opacity: .65 },
  { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 },
], 750, ease);

const introAnimations = [];
if (hero && motion && scrollY < innerHeight * .35 && (!location.hash || location.hash === '#top')) {
  introAnimations.push(
    hero.querySelector('.hero-name').animate([
      { transform: 'translateY(104%)', filter: 'blur(5px)' }, { transform: 'translateY(0)', filter: 'blur(0)' },
    ], { duration: 1250, easing: ease }),
    hero.querySelector('.hero-description').animate([
      { transform: 'translateY(8px)', filter: 'blur(3px)' }, { transform: 'translateY(0)', filter: 'blur(0)' },
    ], { duration: 750, delay: 150, easing: ease, fill: 'backwards' }),
  );
}

let wheelFrame = 0;
let wheelTarget = scrollY;
let wheelTime = 0;
function stopWheel() {
  cancelAnimationFrame(wheelFrame);
  wheelFrame = 0;
}
function glide(time) {
  const ratio = 1 - Math.pow(.87, (time - wheelTime) / 16.67);
  const position = scrollY;
  const delta = wheelTarget - position;
  if (Math.abs(delta) < 1) {
    window.scrollTo({ top: wheelTarget, behavior: 'instant' });
    wheelFrame = 0;
    return;
  }
  const step = Math.sign(delta) * Math.min(Math.abs(delta), Math.max(1, Math.abs(delta) * ratio));
  window.scrollTo({ top: position + step, behavior: 'instant' });
  wheelTime = time;
  wheelFrame = requestAnimationFrame(glide);
}
window.addEventListener('wheel', event => {
  if (!motion || !finePointer.matches || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  if (event.target.closest('.image-dialog, .nav-links.is-open')) return;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const start = wheelFrame ? wheelTarget : scrollY;
  wheelTarget = clamp(start + event.deltaY * scale, 0, root.scrollHeight - innerHeight);
  if (!event.cancelable) return;
  event.preventDefault();
  if (!wheelFrame) { wheelTime = performance.now(); wheelFrame = requestAnimationFrame(glide); }
}, { passive: false });
for (const event of ['pointerdown', 'keydown', 'hashchange', 'resize']) window.addEventListener(event, stopWheel);

const scramblers = new WeakMap();
const scrambleControls = [];
const scrambleObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    if (motion) scramblers.get(entry.target)?.play();
    scrambleObserver.unobserve(entry.target);
  }
}, { threshold: .5 });

for (const element of document.querySelectorAll('[data-signal]')) {
  let label = element.textContent;
  const wrapper = document.createElement('span');
  wrapper.className = 'signal-text';
  const spoken = document.createElement('span');
  spoken.className = 'sr-only';
  const size = document.createElement('span');
  size.className = 'signal-size';
  const live = document.createElement('span');
  live.className = 'signal-live';
  size.setAttribute('aria-hidden', 'true');
  live.setAttribute('aria-hidden', 'true');
  wrapper.append(spoken, size, live);
  element.replaceChildren(wrapper);
  let frame = 0;
  let lastStart = -Infinity;
  const reset = () => { cancelAnimationFrame(frame); live.textContent = label; };
  const play = (force = false) => {
    const now = performance.now();
    if (!motion || document.hidden || (!force && now - lastStart < 1000)) return;
    reset();
    lastStart = now;
    let lastDraw = 0;
    const tick = time => {
      if (!motion || document.hidden) { reset(); return; }
      const progress = clamp((time - now) / 550);
      if (time - lastDraw > 32) {
        live.textContent = Array.from(label, (character, index) => /\s/.test(character) || index < label.length * progress
          ? character : '01/·—'[(index + Math.floor(time / 50)) % 5]).join('');
        lastDraw = time;
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
      else reset();
    };
    frame = requestAnimationFrame(tick);
  };
  const set = value => { label = value; spoken.textContent = value; size.textContent = value; reset(); };
  set(label);
  const trigger = element.closest('a,button,summary') ?? element;
  trigger.addEventListener('pointerenter', () => play());
  trigger.addEventListener('focusin', () => play());
  const controls = { set, play, reset };
  scramblers.set(element, controls);
  scrambleControls.push(controls);
  scrambleObserver.observe(element);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const control of scrambleControls) control.reset();
});

const shapes = ['Structure', 'Ripples', 'Constellation'];
const disciplines = {
  about: [
    ['Understand how places work.', 'I’m learning to use spatial data to read patterns in the places people live.', 'Explore my planning skills', '#skills'],
    ['Make space for questions.', 'I teach and mentor students through QnA teaching and private tutoring.', 'Explore my teaching work', '#work'],
    ['Make ideas easier to see.', 'I use Canva and Adobe Illustrator for visual communication, and I’m learning basic video editing.', 'Explore my design skills', '#skills'],
  ],
  impact: [
    ['Learn by competing.', 'Taking part in CUET competitions gives me another way to learn alongside my studies.', 'See my education', '#education'],
    ['Pass on what I learn.', 'Through tutoring and QnA teaching, I help students work through their questions.', 'See my teaching experience', '#work'],
    ['Bring different skills together.', 'My interests in design and spatial analysis sit alongside practical experience working in a team.', 'See my technical and creative skills', '#skills'],
  ],
};

const scenes = [...document.querySelectorAll('.signal-panel')].map(panel => {
  const state = { selected: panel.dataset.panel === 'about' ? 0 : 1, pulse: 0 };
  const visual = panel.querySelector('.signal-visual');
  const fallback = visual.querySelector('.signal-fallback');
  const label = scramblers.get(visual.querySelector('.signal-shape'));
  const counter = panel.querySelector('[data-signal-index]');
  const buttons = [...panel.querySelectorAll('.signal-options button')];
  const story = panel.querySelector('.signal-story');
  const link = story.querySelector('a');
  const title = story.querySelector('h3');
  const description = story.querySelector('p');

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    if (state.selected === index) { state.pulse = 1; return; }
    state.selected = index;
    state.pulse = 1;
    const [heading, copy, callToAction, href] = disciplines[panel.dataset.panel][index];
    for (const [position, control] of buttons.entries()) control.setAttribute('aria-pressed', String(position === index));
    title.textContent = heading;
    description.textContent = copy;
    link.firstChild.textContent = `${callToAction} `;
    link.href = href;
    fallback.dataset.shape = shapes[index].toLowerCase();
    counter.textContent = `0${index + 1} / 03`;
    label.set(shapes[index]);
    label.play(true);
  }));
  return shapeScene(visual, state, panel.dataset.panel === 'about' ? 5.1 : 6);
});
const setPortrait = hero ? portraitScene(hero.querySelector('.hero-art'), narrative) : null;

function applyMotion() {
  root.dataset.motion = motion ? 'on' : 'off';
  if (motionButton) {
    motionButton.hidden = false;
    motionButton.setAttribute('aria-pressed', String(motion));
    motionButton.setAttribute('aria-label', motion ? 'Motion on — pause animations' : 'Motion off — enable animations');
    motionButton.firstElementChild.textContent = motion ? 'Ⅱ' : '▷';
    motionButton.lastElementChild.textContent = motion ? 'Motion on' : 'Motion off';
  }
  if (qualityButton) {
    qualityButton.hidden = !phone.matches || !motion;
    qualityButton.setAttribute('aria-pressed', String(mobileLive));
    qualityButton.textContent = mobileLive ? 'Disable live effects' : 'Enable live effects';
  }
  const liveEffects = motion && (!phone.matches || mobileLive);
  setPortrait?.(liveEffects);
  for (const setScene of scenes) setScene(liveEffects);
  observeReveals(motion);
  observeTitles(motion);
  if (!motion) {
    stopWheel();
    for (const animation of introAnimations) animation.cancel();
    for (const control of scrambleControls) control.reset();
  }
  queueScroll();
}

motionButton?.addEventListener('click', () => {
  motion = !motion;
  try { sessionStorage.setItem('farhan-motion', motion ? 'on' : 'off'); } catch { /* Current tab state still updates. */ }
  applyMotion();
});
qualityButton?.addEventListener('click', () => { mobileLive = !mobileLive; applyMotion(); });
phone.addEventListener('change', applyMotion);
reduced.addEventListener('change', event => { motion = !event.matches; applyMotion(); });

const skillSets = {
  spatial: ['Spatial analysis & data', 'Read the spatial context', 'Practice mapping in ArcGIS Pro', 'Explore data in SPSS'],
  design: ['Design & media', 'Set the visual direction', 'Create with Canva and Illustrator', 'Practice editing short video'],
  office: ['Office & productivity', 'Organize information in Excel', 'Write and format in Word', 'Review and present the result'],
};
for (const details of document.querySelectorAll('[data-skill]')) {
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    const [label, ...steps] = skillSets[details.dataset.skill];
    document.querySelector('[data-skill-label]').textContent = label;
    document.querySelector('[data-skill-steps]').replaceChildren(...steps.map((step, index) => {
      const item = document.createElement('li');
      item.textContent = step;
      item.className = 'arrive';
      item.style.setProperty('--delay', `${index * 70}ms`);
      return item;
    }));
  });
}

let playingCard;

function closeVideo(restoreFocus = false) {
  if (!playingCard) return;
  const poster = playingCard.querySelector('.video-poster');
  playingCard.querySelector('iframe').remove();
  playingCard.querySelector('.video-close').hidden = true;
  poster.hidden = false;
  if (restoreFocus) poster.querySelector('.video-play').focus();
  playingCard = undefined;
}

for (const card of document.querySelectorAll('.video-card')) {
  const media = card.querySelector('[data-video-id]');
  const poster = card.querySelector('.video-poster');
  const play = poster.querySelector('.video-play');
  const close = card.querySelector('.video-close');

  play.hidden = false;
  play.addEventListener('click', () => {
    closeVideo();
    const player = document.createElement('iframe');
    player.src = `https://www.youtube-nocookie.com/embed/${media.dataset.videoId}?autoplay=1`;
    player.title = card.querySelector('h3').textContent;
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    poster.hidden = true;
    close.hidden = false;
    media.append(player);
    playingCard = card;
    close.focus({ preventScroll: true });
  });

  close.addEventListener('click', () => closeVideo(true));
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape' && playingCard === card) closeVideo(true);
  });
}

for (const gallery of document.querySelectorAll('.gallery')) {
  const filters = gallery.querySelectorAll('[data-filter]');
  if (!filters.length) continue;
  const cards = gallery.querySelectorAll('[data-category]');
  const count = gallery.querySelector('[data-gallery-count]');
  const label = count.dataset.galleryCount || 'portrait';

  for (const button of filters) button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    let shown = 0;
    for (const control of filters) control.setAttribute('aria-pressed', String(control === button));
    for (const card of cards) {
      card.hidden = filter !== 'all' && card.dataset.category !== filter;
      if (!card.hidden) shown += 1;
    }
    if (playingCard?.hidden) closeVideo();
    count.textContent = `${String(shown).padStart(2, '0')} ${label}${shown === 1 ? '' : 's'}`;
    queueScroll();
  });
}

const dialog = document.querySelector('.image-dialog');
if (dialog?.showModal) {
  const large = dialog.querySelector('img');
  const caption = dialog.querySelector('p');
  let opener;
  for (const link of document.querySelectorAll('[data-gallery-image]')) link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    large.src = link.href;
    large.alt = link.querySelector('img').alt;
    caption.textContent = link.nextElementSibling.textContent;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { large.removeAttribute('src'); opener?.focus(); });
}

applyMotion();
