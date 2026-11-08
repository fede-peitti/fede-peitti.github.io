import {
  COMMANDS,
  NEEDS_INDEX,
  bootFooter,
  bootHeader,
  bootLines,
  buildContext,
  complete,
  createShell,
  exec,
  historyStep,
  motd,
  offlineAnswer,
  parseArgv,
  pipelineStages,
  prompt,
  stageLine,
  stripThinking,
  wrapText,
  type Line,
  type ShellState,
  type TermIndex,
} from '../lib/terminal';

export interface TerminalController {
  destroy: () => void;
}

interface pipoTheme {
  get: () => string;
  set: (theme: string) => string;
  toggle: () => string;
}

let modelDownUntil = 0;
let modelFailures = 0;

const modelDown = () => Date.now() < modelDownUntil;

const THROTTLE_COOLDOWN_MS = 60_000;

const FIRST_BYTE_MS = 8_000;
const STREAM_MS = 20_000;

function noteModelFailure(status?: number) {
  if (status === 503) modelDownUntil = Infinity;
  else if (status === 429) modelDownUntil = Date.now() + THROTTLE_COOLDOWN_MS;
  else if (++modelFailures >= 2) modelDownUntil = Infinity;
}

export interface DemoStep {
  cmd: string;
  out: string[];
}

export interface TerminalOptions {
  boot?: boolean;
  demo?: DemoStep[];
  exitHref?: string;
}

const INDEX_URL = '/terminal.json';

export function initTerminal(
  root: ParentNode = document,
  options: TerminalOptions = {}
): TerminalController | null {
  const { boot = true, demo = [], exitHref = '/' } = options;
  const shellEl = root.querySelector<HTMLElement>('[data-terminal]');
  if (!shellEl) return null;
  if (shellEl.dataset.terminalReady === 'true') return null;
  shellEl.dataset.terminalReady = 'true';

  const screen = shellEl.querySelector<HTMLElement>('[data-terminal-screen]');
  const input = shellEl.querySelector<HTMLInputElement>('[data-terminal-input]');
  const promptEl = shellEl.querySelector<HTMLElement>('[data-terminal-prompt]');
  const keybar = shellEl.querySelector<HTMLElement>('[data-terminal-keybar]');
  const form = shellEl.querySelector<HTMLFormElement>('[data-terminal-form]');
  const latestBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-scroll-end]');
  const clearBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-input-clear]');
  if (!screen || !input || !promptEl) return null;

  const state: ShellState = createShell(null);
  let indexPromise: Promise<TermIndex | null> | null = null;
  let busy = false;
  let skipBoot: (() => void) | null = null;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  let columns = 80;
  let resizeObserver: ResizeObserver | null = null;
  const viewportHost = shellEl.closest<HTMLElement>('.main--bare');
  const SCROLL_EPSILON = 24;
  let followOutput = true;
  let viewportRaf = 0;

  function measureColumns() {
    const style = getComputedStyle(screen!);
    const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const contentWidth = Math.max(1, screen!.clientWidth - horizontalPadding);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) context.font = style.font;
    const cell = context
      ? context.measureText('0000000000').width / 10
      : parseFloat(style.fontSize) * 0.6;
    columns = Math.max(24, Math.floor(contentWidth / Math.max(1, cell)));
    return columns;
  }

  const isNarrow = () => measureColumns() < 70;
  const displayPrompt = () => {
    const full = prompt(state);
    return columns < 48 && !state.chatMode ? full.replace(/^pipo@kernel:/, 'pipo:') : full;
  };

  function lineEl(line: Line): HTMLElement {
    const el = document.createElement('div');
    el.className = line.tone ? `term-line term-${line.tone}` : 'term-line';
    if (line.prefix) {
      const badge = document.createElement('span');
      badge.className = 'term-ok';
      badge.textContent = line.prefix;
      el.append(badge, document.createTextNode(line.text));
      return el;
    }
    if (line.href) {
      const a = document.createElement('a');
      a.className = 'term-link';
      a.href = line.href;
      a.textContent = line.text;
      if (/^https?:/i.test(line.href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      el.appendChild(a);
    } else {
      el.textContent = line.text === '' ? '​' : line.text;
    }
    return el;
  }

  function writeLine(line: Line): HTMLElement {
    const el = lineEl(line);
    screen!.appendChild(el);
    return el;
  }

  function fitLines(lines: Line[]): Line[] {
    const width = measureColumns();
    return lines.flatMap((line) => {
      if (line.tone === 'art' || line.text.length <= width) return [line];
      const wrapped = wrapText(line.text, width);
      return wrapped.map((text, index) => ({
        ...line,
        text,
        href: index === 0 ? line.href : undefined,
      }));
    });
  }

  const write = (lines: Line[]) => fitLines(lines).forEach(writeLine);

  function echoCommand(text: string) {
    const el = document.createElement('div');
    el.className = 'term-line term-echo';
    const ps1 = document.createElement('span');
    ps1.className = 'term-ps1';
    ps1.textContent = `${displayPrompt()} `;
    const cmd = document.createElement('span');
    cmd.textContent = text;
    el.append(ps1, cmd);
    screen!.appendChild(el);
  }

  function atScrollEnd() {
    return screen!.scrollHeight - screen!.scrollTop - screen!.clientHeight <= SCROLL_EPSILON;
  }

  function syncScrollAffordance() {
    const atEnd = atScrollEnd();
    if (atEnd) followOutput = true;
    latestBtn?.toggleAttribute('hidden', atEnd || screen!.scrollHeight <= screen!.clientHeight);
  }

  function scrollToEnd(force = true) {
    if (!force && !followOutput) {
      syncScrollAffordance();
      return;
    }
    screen!.scrollTop = screen!.scrollHeight;
    screen!.scrollLeft = 0;
    followOutput = true;
    syncScrollAffordance();
  }

  function setBusy(next: boolean) {
    busy = next;
    input!.disabled = next;
    shellEl!.classList.toggle('is-busy', next);
    screen!.setAttribute('aria-busy', String(next));
    screen!.setAttribute('aria-live', next ? 'off' : 'polite');
    keybar?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = next;
    });
    if (!next && !coarsePointer) input!.focus({ preventScroll: true });
  }

  const refreshPrompt = () => {
    measureColumns();
    promptEl!.textContent = displayPrompt();
  };

  function loadIndex(): Promise<TermIndex | null> {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL)
        .then((res) => (res.ok ? (res.json() as Promise<TermIndex>) : null))
        .then((data) => {
          state.index = data;
          return data;
        })
        .catch(() => null);
    }
    return indexPromise;
  }

  let audioCtx: AudioContext | null = null;
  let soundEnabled = false;

  function playClick() {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') void audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700 + Math.random() * 200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.03);
    } catch {
      // Audio unavailable
    }
  }

  function playBell() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') void audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Audio xunavailable
    }
  }

  function runEffect(effect: NonNullable<ReturnType<typeof exec>['effect']>) {
    switch (effect.type) {
      case 'clear':
        while (screen!.firstChild) screen!.removeChild(screen!.firstChild);
        break;
      case 'navigate':
        if (/^https?:/i.test(effect.href)) window.open(effect.href, '_blank', 'noopener,noreferrer');
        else window.setTimeout(() => window.location.assign(effect.href), reduced ? 0 : 260);
        break;
      case 'exit':
        window.setTimeout(() => window.location.assign(exitHref), reduced ? 0 : 420);
        break;
      case 'theme':
        applyTheme(effect.mode);
        break;
      case 'sound':
        if (effect.mode === 'bell') {
          playBell();
        } else if (effect.mode === 'on') {
          soundEnabled = true;
          playClick();
        } else if (effect.mode === 'off') {
          soundEnabled = false;
        } else if (effect.mode === 'toggle') {
          soundEnabled = !soundEnabled;
          if (soundEnabled) playClick();
        }
        write([{ text: `sound → ${soundEnabled ? 'ON (click feedback)' : 'OFF'}`, tone: 'ok' }]);
        scrollToEnd();
        break;
      case 'copy':
        if (navigator.clipboard) {
          const text = effect.text || screen!.innerText;
          void navigator.clipboard.writeText(text);
          write([{ text: 'Copied transcript to clipboard.', tone: 'ok' }]);
          scrollToEnd();
        }
        break;
      case 'custom':
        window.dispatchEvent(new CustomEvent(effect.eventName, { detail: effect.detail }));
        break;
      case 'ask':
        void answer(effect.question);
        break;
    }
  }

  
  function applyTheme(mode: 'light' | 'dark' | 'toggle') {
    const api = (window as unknown as { __fpTheme?: pipoTheme }).__fpTheme;

    if (!api) {
      write([{ text: 'theme: the theme switch is unavailable on this page.', tone: 'err' }]);
      return;
    }

    const next = mode === 'toggle' ? api.toggle() : api.set(mode);
    write([{ text: `theme → ${next}`, tone: 'ok' }]);
    scrollToEnd();
  }

  async function answer(question: string) {
    setBusy(true);
    const status = writeLine({ text: 'searching…', tone: 'dim' });
    scrollToEnd();

    const index = await loadIndex();
    if (!index) {
      status.remove();
      write([{ text: 'ask: knowledge index unavailable — try reloading.', tone: 'err' }, { text: '' }]);
      setBusy(false);
      scrollToEnd(false);
      return;
    }

    let answered = false;
    if (!answered) {
      status.remove();
      write(offlineAnswer(index, question));
    }

    write([{ text: '' }]);
    setBusy(false);
    scrollToEnd(false);
  }

  function syncClearButton() {
    if (clearBtn) clearBtn.hidden = !input!.value;
  }

  async function submit(raw: string) {
    echoCommand(raw);
    input!.value = '';
    syncClearButton();

    const name = parseArgv(raw.trim())[0] ?? '';
    const needsIndex = state.chatMode || NEEDS_INDEX.has(name) || !COMMANDS[name];
    if (needsIndex && !state.index) {
      setBusy(true);
      await loadIndex();
      setBusy(false);
    }

    const { lines, effect } = exec(state, raw, new Date(), measureColumns());
    write(lines);
    if (lines.length) write([{ text: '' }]);
    refreshPrompt();
    if (effect) runEffect(effect);
    scrollToEnd();
  }

  function completeInput() {
    const { value, options } = complete(state, input!.value);
    input!.value = value;
    syncClearButton();
    if (options.length) {
      echoCommand(input!.value);
      write([{ text: options.join('   '), tone: 'dim' }, { text: '' }]);
      scrollToEnd();
    }
  }

  function moveHistory(direction: -1 | 1) {
    input!.value = historyStep(state, direction, input!.value);
    syncClearButton();
    input!.focus({ preventScroll: true });
    window.requestAnimationFrame(() => input!.setSelectionRange(input!.value.length, input!.value.length));
  }

  function clearScreen() {
    while (screen!.firstChild) screen!.removeChild(screen!.firstChild);
    screen!.scrollLeft = 0;
    followOutput = true;
    syncScrollAffordance();
    if (!coarsePointer) input!.focus({ preventScroll: true });
  }

  function scrollHistoryBy(direction: -1 | 1) {
    screen!.scrollBy({ top: direction * Math.max(1, screen!.clientHeight * 0.82), behavior: 'auto' });
    followOutput = atScrollEnd();
    syncScrollAffordance();
  }

  function onScreenScroll() {
    followOutput = atScrollEnd();
    syncScrollAffordance();
  }

  function onLatestClick() {
    scrollToEnd();
    latestBtn?.blur();
  }

  function onShellWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) return;
    if (booting) skipBoot?.();
    if (demoRunning) takeOver();
  }

  function onFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!busy) void submit(input!.value);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (busy) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      completeInput();
      return;
    }
    if (event.shiftKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      scrollHistoryBy(event.key === 'PageUp' ? -1 : 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveHistory(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      echoCommand(`${input!.value}^C`);
      input!.value = '';
      syncClearButton();
      scrollToEnd();
      return;
    }
    if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
      event.preventDefault();
      clearScreen();
      return;
    }
    if (event.ctrlKey && (event.key === 'u' || event.key === 'U')) {
      event.preventDefault();
      input!.value = '';
      syncClearButton();
    }
    playClick();
  }

  const onInput = () => {
    syncClearButton();
    playClick();
  };
  const onClearClick = (event: MouseEvent) => {
    event.preventDefault();
    input!.value = '';
    syncClearButton();
    input!.focus({ preventScroll: true });
  };
  const onInputFocus = () => {
    if (viewportHost && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
  };
  const onTouchStart = () => {
    if (viewportHost && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
  };

  function onKeybarClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    const action = button?.dataset.terminalAction;
    if (!button || !action || busy) return;
    if (action === 'command') {
      void submit(button.dataset.terminalCommand ?? '');
    } else if (action === 'ask') {
      input!.value = input!.value.startsWith('ask ') ? input!.value : 'ask ';
      syncClearButton();
      input!.focus({ preventScroll: true });
    } else if (action === 'tab') {
      completeInput();
      input!.focus({ preventScroll: true });
    } else if (action === 'history-up') {
      moveHistory(-1);
    } else if (action === 'history-down') {
      moveHistory(1);
    } else if (action === 'clear') {
      clearScreen();
    }
  }

  function onShellClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target?.closest('a, button, [data-terminal-bar]')) return;
    if (coarsePointer) return;
    if (window.getSelection()?.toString()) return;
    input!.focus({ preventScroll: true });
  }

  const bar = shellEl.querySelector<HTMLElement>('[data-terminal-bar]');
  const minBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-min]');
  const closeBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-close]');
  const zoomBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-zoom]');
  const themeBtn = shellEl.querySelector<HTMLButtonElement>('[data-terminal-theme]');
  const reopenBtn =
    shellEl.parentElement?.querySelector<HTMLButtonElement>('[data-terminal-reopen]') ?? null;

  function setMinimised(next: boolean) {
    shellEl!.classList.toggle('term--min', next);
    minBtn?.setAttribute('aria-expanded', String(!next));
    minBtn?.setAttribute('aria-label', next ? 'Restore the terminal' : 'Minimise the terminal');
    minBtn?.setAttribute('title', next ? 'Restore the terminal' : 'Minimise the terminal');
    if (next) minBtn?.focus({ preventScroll: true });
    else if (!coarsePointer) input!.focus({ preventScroll: true });
  }

  function setClosed(next: boolean) {
    shellEl!.classList.toggle('term--closed', next);
    if (reopenBtn) reopenBtn.hidden = !next;
    if (next) reopenBtn?.focus({ preventScroll: true });
    else {
      setMinimised(false);
      if (!coarsePointer) input!.focus({ preventScroll: true });
    }
  }

  const fullscreenSupported = typeof shellEl.requestFullscreen === 'function';

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void shellEl!.requestFullscreen().catch(() => {});
  }

  function syncFullscreen() {
    const on = document.fullscreenElement === shellEl;
    shellEl!.classList.toggle('term--full', on);
    zoomBtn?.setAttribute('aria-label', on ? 'Leave full screen' : 'Fill the screen');
    zoomBtn?.setAttribute('title', on ? 'Leave full screen' : 'Fill the screen');
  }

  function onBarClick(event: MouseEvent) {
    if ((event.target as HTMLElement)?.closest('a, button')) return;
    if (shellEl!.classList.contains('term--min')) setMinimised(false);
  }

  const onMin = () => setMinimised(!shellEl!.classList.contains('term--min'));
  const onClose = () => setClosed(true);
  const onReopen = () => setClosed(false);

  function syncViewportHeight() {
    if (!viewportHost) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    viewportHost.style.setProperty('--terminal-viewport-height', `${Math.max(1, Math.round(height))}px`);
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  }

  function onViewportResize() {
    syncViewportHeight();
    if (followOutput) {
      window.cancelAnimationFrame(viewportRaf);
      viewportRaf = window.requestAnimationFrame(() => scrollToEnd(false));
    }
  }

  minBtn?.addEventListener('click', onMin);
  closeBtn?.addEventListener('click', onClose);
  reopenBtn?.addEventListener('click', onReopen);
  bar?.addEventListener('click', onBarClick);

  if (zoomBtn) {
    if (fullscreenSupported) {
      zoomBtn.addEventListener('click', toggleFullscreen);
      document.addEventListener('fullscreenchange', syncFullscreen);
    } else {
      zoomBtn.disabled = true;
      zoomBtn.tabIndex = -1;
      zoomBtn.setAttribute('aria-hidden', 'true');
      zoomBtn.removeAttribute('title');
    }
  }

  function syncThemeButton() {
    if (!themeBtn) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    themeBtn.textContent = dark ? '☀' : '☾';
    const label = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
  }

  const onThemeClick = () => applyTheme('toggle');
  themeBtn?.addEventListener('click', onThemeClick);
  document.addEventListener('fp:theme-change', syncThemeButton);
  syncThemeButton();

  const bootIndex = {
    ...(JSON.parse(shellEl.dataset.terminalBoot ?? '{}') as TermIndex),
    fs: {},
    chunks: [],
  } as TermIndex;

  let bootRaf = 0;
  let bootTimer = 0;
  let booting = true;

  function printBanner() {
    write(motd(bootIndex, new Date(), measureColumns()));
    refreshPrompt();
    booting = false;
    if (!coarsePointer) input!.focus({ preventScroll: true });
    scrollToEnd();
  }

  const STAGE_MS = 150;
  const REPORT_MS = 110;

  function runBoot() {
    const narrow = isNarrow();
    const stages = pipelineStages();
    const report = bootFooter();

    if (reduced) {
      const wrap = buildBootShell();
      for (const line of bootLines(narrow)) wrap.log.appendChild(lineEl(line));
      printBanner();
      return;
    }

    const wrap = buildBootShell();
    for (const line of bootHeader()) wrap.log.appendChild(lineEl(line));
    const rows = stages.map((stage, i) => {
      const el = lineEl({ text: stageLine(stage, i, stages.length, 0, narrow) });
      wrap.log.appendChild(el);
      return el;
    });
    scrollToEnd();

    const barsMs = stages.length * STAGE_MS;
    let phase = 0;
    let last = 0;
    let elapsed = 0;
    let settled = 0;
    let reported = 0;

    const paintStages = () => {
      const active = Math.floor(elapsed / STAGE_MS);
      for (let i = settled; i < Math.min(active + 1, stages.length); i++) {
        const fraction = i < active ? 1 : (elapsed % STAGE_MS) / STAGE_MS;
        rows[i].textContent = stageLine(stages[i], i, stages.length, fraction, narrow);
      }
      settled = Math.min(active, stages.length);
    };

    const paintReport = () => {
      const want = Math.min(report.length, Math.floor((elapsed - barsMs) / REPORT_MS) + 1);
      while (reported < want) wrap.log.appendChild(lineEl(report[reported++]));
    };

    const spin = (ts: number) => {
      if (!last) last = ts;
      const dt = ts - last;
      last = ts;
      elapsed += dt;

      paintStages();
      if (elapsed >= barsMs) paintReport();
      scrollToEnd();

      if (reported >= report.length) return finishBoot();
      bootRaf = requestAnimationFrame(spin);
    };
    bootRaf = requestAnimationFrame(spin);

    function finishBoot() {
      window.clearTimeout(bootTimer);
      cancelAnimationFrame(bootRaf);
      bootRaf = 0;
      document.removeEventListener('keydown', onSkip, true);
      shellEl!.removeEventListener('pointerdown', onSkip, true);
      printBanner();
    }

    function onSkip() {
      if (!booting) return;
      stages.forEach((stage, i) => {
        rows[i].textContent = stageLine(stage, i, stages.length, 1, narrow);
      });
      while (reported < report.length) wrap.log.appendChild(lineEl(report[reported++]));
      finishBoot();
    }

    document.addEventListener('keydown', onSkip, true);
    shellEl!.addEventListener('pointerdown', onSkip, true);
    skipBoot = onSkip;
  }

  function buildBootShell() {
    const wrap = document.createElement('div');
    wrap.className = 'term-boot';

    const log = document.createElement('div');
    log.className = 'term-boot-log';

    wrap.appendChild(log);
    screen!.appendChild(wrap);

    return { log };
  }

  let demoTimer = 0;
  let demoRunning = false;

  function runDemo() {
    demoRunning = true;
    let step = 0;
    let char = 0;
    let phase: 'typing' | 'output' = 'typing';

    const tick = () => {
      if (!demoRunning) return;
      const current = demo[step % demo.length];
      if (phase === 'typing') {
        if (char < current.cmd.length) {
          input!.value = current.cmd.slice(0, ++char);
          demoTimer = window.setTimeout(tick, 55);
          return;
        }
        phase = 'output';
        demoTimer = window.setTimeout(tick, 300);
        return;
      }
      echoCommand(current.cmd);
      input!.value = '';
      for (const line of current.out) writeLine({ text: line, tone: 'dim' });
      writeLine({ text: '' });
      scrollToEnd();
      step += 1;
      char = 0;
      phase = 'typing';
      if (step % demo.length === 0) {
        demoTimer = window.setTimeout(() => {
          if (!demoRunning) return;
          while (screen!.firstChild) screen!.removeChild(screen!.firstChild);
          tick();
        }, 2200);
        return;
      }
      demoTimer = window.setTimeout(tick, 1200);
    };

    demoTimer = window.setTimeout(tick, 400);
  }

  function takeOver() {
    if (!demoRunning) return;
    demoRunning = false;
    window.clearTimeout(demoTimer);
    input!.value = '';
    document.removeEventListener('keydown', takeOver, true);
    shellEl!.removeEventListener('pointerdown', takeOver, true);
    writeLine({ text: '— ready. type `help`, or `ask` a question —', tone: 'ok' });
    writeLine({ text: '' });
    scrollToEnd();
    void loadIndex();
  }

  form?.addEventListener('submit', onFormSubmit);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('input', onInput);
  input.addEventListener('focus', onInputFocus);
  input.addEventListener('touchstart', onTouchStart, { passive: true });
  clearBtn?.addEventListener('click', onClearClick);
  keybar?.addEventListener('click', onKeybarClick);
  shellEl.addEventListener('click', onShellClick);
  shellEl.addEventListener('wheel', onShellWheel, { capture: true, passive: true });
  screen.addEventListener('scroll', onScreenScroll, { passive: true });
  latestBtn?.addEventListener('click', onLatestClick);
  window.addEventListener('resize', onViewportResize);
  window.visualViewport?.addEventListener('resize', onViewportResize);
  window.visualViewport?.addEventListener('scroll', onViewportResize, { passive: true });
  syncViewportHeight();
  syncScrollAffordance();
  syncClearButton();
  measureColumns();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      const wasFollowing = followOutput;
      refreshPrompt();
      if (wasFollowing) scrollToEnd(false);
      else syncScrollAffordance();
    });
    resizeObserver.observe(screen);
  }

  if (boot) {
    runBoot();
    window.setTimeout(() => void loadIndex(), 120);
  } else {
    booting = false;
    refreshPrompt();
    if (demo.length && !reduced) {
      document.addEventListener('keydown', takeOver, true);
      shellEl.addEventListener('pointerdown', takeOver, true);
      runDemo();
    } else if (demo.length) {
      for (const stepDef of demo) {
        echoCommand(stepDef.cmd);
        for (const line of stepDef.out) writeLine({ text: line, tone: 'dim' });
        writeLine({ text: '' });
      }
      scrollToEnd();
    }
  }

  (window as unknown as Record<string, unknown>).__terminal = {
    submit: (line: string) => submit(line),
    state,
    text: () => screen.textContent ?? '',
    booting: () => booting,
    skipBoot: () => skipBoot?.(),
    demoing: () => demoRunning,
    takeOver: () => takeOver(),
    minimised: () => shellEl.classList.contains('term--min'),
    closed: () => shellEl.classList.contains('term--closed'),
    modelDown: () => modelDown(),
    modelDownUntil: () => modelDownUntil,
  };

  return {
    destroy() {
      window.clearTimeout(bootTimer);
      window.clearTimeout(demoTimer);
      demoRunning = false;
      document.removeEventListener('keydown', takeOver, true);
      shellEl.removeEventListener('pointerdown', takeOver, true);
      if (bootRaf) cancelAnimationFrame(bootRaf);
      window.cancelAnimationFrame(viewportRaf);
      resizeObserver?.disconnect();
      resizeObserver = null;
      form?.removeEventListener('submit', onFormSubmit);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onInputFocus);
      input.removeEventListener('touchstart', onTouchStart);
      clearBtn?.removeEventListener('click', onClearClick);
      keybar?.removeEventListener('click', onKeybarClick);
      shellEl.removeEventListener('click', onShellClick);
      shellEl.removeEventListener('wheel', onShellWheel, true);
      screen.removeEventListener('scroll', onScreenScroll);
      latestBtn?.removeEventListener('click', onLatestClick);
      window.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('scroll', onViewportResize);
      viewportHost?.style.removeProperty('--terminal-viewport-height');
      minBtn?.removeEventListener('click', onMin);
      closeBtn?.removeEventListener('click', onClose);
      reopenBtn?.removeEventListener('click', onReopen);
      bar?.removeEventListener('click', onBarClick);
      zoomBtn?.removeEventListener('click', toggleFullscreen);
      themeBtn?.removeEventListener('click', onThemeClick);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('fp:theme-change', syncThemeButton);
      delete (window as unknown as Record<string, unknown>).__terminal;
      shellEl.dataset.terminalReady = '';
    },
  };
}
