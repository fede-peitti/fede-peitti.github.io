export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
export function onVisible(
  el: Element,
  onEnter: () => void,
  onLeave?: () => void,
  options: IntersectionObserverInit = { threshold: 0.01, rootMargin: '0px 0px -4% 0px' }
): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onEnter();
    return () => {};
  }
  let stopped = false;
  const enter = () => {
    if (!stopped) onEnter();
  };
  const checkReached = () => {
    if (stopped || typeof window === 'undefined') return;
    if (el.getBoundingClientRect().top <= window.innerHeight) enter();
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) enter();
      else onLeave?.();
    }
  }, options);
  io.observe(el);
  window.addEventListener('scroll', checkReached, { passive: true });
  window.addEventListener('resize', checkReached);
  window.requestAnimationFrame(checkReached);
  return () => {
    stopped = true;
    io.disconnect();
    window.removeEventListener('scroll', checkReached);
    window.removeEventListener('resize', checkReached);
  };
}
