import { startZeroGravity } from './domPhysics';

export interface CommandItem {
  id: string;
  category:
    | 'Actions'
    | 'Navigation'
    | 'Publications'
    | 'Software'
    | 'Research'
    | 'Posts'
    | 'Talks'
    | 'News';
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  href?: string;
  action?: () => void;
  keywords?: string[];
}

const STATIC_ACTIONS: CommandItem[] = [
  {
    id: 'act-theme-toggle',
    category: 'Actions',
    title: 'Toggle Base Theme (Light / Dark)',
    subtitle: 'Switch between light and dark base theme',
    badge: 'Theme',
    action: () => {
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { __fpTheme?: { toggle: () => void } }).__fpTheme
      ) {
        (window as unknown as { __fpTheme: { toggle: () => void } }).__fpTheme.toggle();
      }
    },
    keywords: ['dark', 'light', 'mode', 'theme', 'color', 'toggle', 'base theme'],
  },
  {
    id: 'act-theme-light',
    category: 'Actions',
    title: 'Set Theme: ☀️ Light Mode',
    subtitle: 'Crisp Calico minimalist light theme',
    badge: 'Theme',
    action: () => {
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { __fpTheme?: { set: (t: string) => void } }).__fpTheme
      ) {
        (window as unknown as { __fpTheme: { set: (t: string) => void } }).__fpTheme.set('light');
      }
    },
    keywords: ['light', 'day', 'paper', 'bright', 'white', 'theme'],
  },
  {
    id: 'act-theme-dark',
    category: 'Actions',
    title: 'Set Theme: 🌙 Dark Mode',
    subtitle: 'Deep slate and emerald dark theme',
    badge: 'Theme',
    action: () => {
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { __fpTheme?: { set: (t: string) => void } }).__fpTheme
      ) {
        (window as unknown as { __fpTheme: { set: (t: string) => void } }).__fpTheme.set('dark');
      }
    },
    keywords: ['dark', 'night', 'black', 'slate', 'dim', 'theme'],
  },
  {
    id: 'act-terminal',
    category: 'Actions',
    title: 'Open Web Terminal',
    subtitle: 'Interactive Unix shell',
    badge: 'Shell',
    href: '/terminal/',
    keywords: ['terminal', 'shell', 'bash', 'zsh', 'cli', 'console'],
  },
  {
    id: 'act-cv-download',
    category: 'Actions',
    title: 'Download CV (PDF)',
    subtitle: 'Download complete academic curriculum vitae',
    badge: 'PDF',
    href: '/cv.pdf',
    keywords: ['cv', 'resume', 'pdf', 'download', 'curriculum', 'vitae'],
  },
  {
    id: 'act-copy-email',
    category: 'Actions',
    title: 'Copy Email Address',
    subtitle: 'Copy fede[dot]peitti[at]gmail[dot]com to clipboard',
    badge: 'Contact',
    action: () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText('fede[dot]peitti[at]gmail[dot]com ');
      }
    },
    keywords: ['email', 'copy', 'contact', 'mail', 'reach out'],
  },
  {
    id: 'act-zerog',
    category: 'Actions',
    title: 'Zero-Gravity Physics',
    subtitle: "Gravity effect",
    badge: 'Easter Egg',
    action: () => {
      startZeroGravity();
    },
    keywords: ['gravity', 'physics', 'float', 'black hole', 'easter egg'],
  }
];

const STATIC_NAV: CommandItem[] = [
  {
    id: 'nav-home',
    category: 'Navigation',
    title: 'Home',
    subtitle: 'Overview, research focus, and updates',
    href: '/',
  },
  {
    id: 'nav-research',
    category: 'Navigation',
    title: 'Research Areas',
    subtitle: 'Core themes',
    href: '/research/',
  },
  {
    id: 'nav-publications',
    category: 'Navigation',
    title: 'Publications',
    subtitle: 'Peer-reviewed papers, preprints, and citations',
    href: '/publications/',
  },
  {
    id: 'nav-software',
    category: 'Navigation',
    title: 'Software & Open Source',
    subtitle: 'Chek it out',
    href: '/software/',
  },
  {
    id: 'nav-algorithms',
    category: 'Navigation',
    title: 'Algorithms Hub',
    subtitle: 'Interactive visualizers',
    href: '/algorithms/',
  },
  {
    id: 'nav-papers',
    category: 'Navigation',
    title: 'Paper Summaries',
    subtitle: 'Detailed literature deconstructions & methodology summaries',
    href: '/papers/',
  },
  {
    id: 'nav-teaching',
    category: 'Navigation',
    title: 'Teaching',
    subtitle: 'Courses',
    href: '/teaching/',
  },
  {
    id: 'nav-talks',
    category: 'Navigation',
    title: 'Talks & Presentations',
    subtitle: 'Invited talks, conference presentations, slides',
    href: '/talks/',
  },
  {
    id: 'nav-news',
    category: 'Navigation',
    title: 'Recent News',
    subtitle: 'Academic updates, awards, and milestones',
    href: '/news/',
  },
  {
    id: 'nav-cv',
    category: 'Navigation',
    title: 'Curriculum Vitae',
    subtitle: 'Education, experience, honors, and service',
    href: '/cv/',
  },
  {
    id: 'nav-photos',
    category: 'Navigation',
    title: 'Photos & Life',
    subtitle: 'Visualization of reality',
    href: '/photos/',
  }
];

let searchIndexCache: CommandItem[] | null = null;
let searchIndexPromise: Promise<CommandItem[]> | null = null;

async function fetchSearchIndex(): Promise<CommandItem[]> {
  if (searchIndexCache) return searchIndexCache;
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = (async () => {
    try {
      const res = await fetch('/search.json');
      if (!res.ok) throw new Error('Search index load failed');
      const data = await res.json();
      const dynamicItems: CommandItem[] = (data.items || []).map((item: any, idx: number) => {
        let category: CommandItem['category'] = 'Publications';
        if (item.type === 'Publication') category = 'Publications';
        else if (item.type === 'Software') category = 'Software';
        else if (item.type === 'Research') category = 'Research';
        else if (item.type === 'Post') category = 'Posts';
        else if (item.type === 'Talk') category = 'Talks';
        else if (item.type === 'News') category = 'News';

        return {
          id: `dyn-${item.type.toLowerCase()}-${idx}`,
          category,
          title: item.title,
          subtitle: item.description,
          badge: item.tags?.[0] || item.type,
          href: item.href,
          keywords: [item.search, ...(item.tags || [])],
        };
      });

      searchIndexCache = dynamicItems;
      return dynamicItems;
    } catch {
      return [];
    } finally {
      searchIndexPromise = null;
    }
  })();

  return searchIndexPromise;
}

export function initCommandPalette() {
  const dialog = document.getElementById('command-palette-dialog') as HTMLDialogElement | null;
  const input = document.getElementById('command-palette-input') as HTMLInputElement | null;
  const resultsContainer = document.getElementById('command-palette-results') as HTMLElement | null;
  const emptyState = document.getElementById('command-palette-empty') as HTMLElement | null;
  const backdrop = document.getElementById('command-palette-backdrop') as HTMLElement | null;
  const closeBtn = document.getElementById('command-palette-close') as HTMLElement | null;

  if (!dialog || !input || !resultsContainer) return;

  let activeIndex = 0;
  let currentFilteredItems: CommandItem[] = [];

  function openPalette() {
    if (!dialog) return;
    input!.value = '';
    dialog.showModal();
    input!.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    renderResults('');
    input!.focus();
    void fetchSearchIndex().then(() => {
      if (dialog.open) renderResults(input!.value);
    });
  }

  function closePalette() {
    if (!dialog) return;
    dialog.close();
    input!.setAttribute('aria-expanded', 'false');
    input!.removeAttribute('aria-activedescendant');
    document.body.style.overflow = '';
  }

  function executeItem(item: CommandItem) {
    closePalette();
    if (item.action) {
      item.action();
    } else if (item.href) {
      window.location.href = item.href;
    }
  }

  function scoreItem(item: CommandItem, queryTokens: string[]): number {
    if (queryTokens.length === 0) return 1;
    const titleLower = item.title.toLowerCase();
    const subtitleLower = (item.subtitle || '').toLowerCase();
    const badgeLower = (item.badge || '').toLowerCase();
    const keywordsLower = (item.keywords || []).join(' ').toLowerCase();

    let score = 0;
    for (const token of queryTokens) {
      if (titleLower.startsWith(token)) score += 100;
      else if (titleLower.includes(` ${token}`)) score += 60;
      else if (titleLower.includes(token)) score += 40;
      else if (badgeLower.includes(token)) score += 30;
      else if (keywordsLower.includes(token)) score += 20;
      else if (subtitleLower.includes(token)) score += 10;
      else return 0; 
    }
    return score;
  }

  function renderResults(query: string) {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const allBaseItems = [
      ...STATIC_ACTIONS,
      ...STATIC_NAV,
      ...(searchIndexCache || []),
    ];

    const seen = new Set<string>();
    const uniqueItems: CommandItem[] = [];
    for (const it of allBaseItems) {
      const key = it.href || it.id;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(it);
      }
    }

    let scored = uniqueItems
      .map((it) => ({ item: it, score: scoreItem(it, tokens) }))
      .filter((entry) => entry.score > 0);

    if (tokens.length > 0) {
      scored.sort((a, b) => b.score - a.score);
    }

    currentFilteredItems = scored.map((s) => s.item).slice(0, 30);
    activeIndex = 0;

    resultsContainer!.replaceChildren();

    if (currentFilteredItems.length === 0) {
      input!.removeAttribute('aria-activedescendant');
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    const categories: Record<string, CommandItem[]> = {};
    for (const it of currentFilteredItems) {
      if (!categories[it.category]) categories[it.category] = [];
      categories[it.category].push(it);
    }

    let globalItemIndex = 0;
    for (const [catName, items] of Object.entries(categories)) {
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'palette-group-title';
      sectionHeader.textContent = catName;
      resultsContainer!.appendChild(sectionHeader);

      for (const item of items) {
        const itemIdx = globalItemIndex++;
        const itemEl = document.createElement('div');
        itemEl.className = `palette-item ${itemIdx === activeIndex ? 'is-selected' : ''}`;
        itemEl.id = `palette-item-${itemIdx}`;
        itemEl.role = 'option';
        itemEl.setAttribute('aria-selected', String(itemIdx === activeIndex));

        const contentWrap = document.createElement('div');
        contentWrap.className = 'palette-item-main';

        const titleEl = document.createElement('span');
        titleEl.className = 'palette-item-title';
        titleEl.textContent = item.title;
        contentWrap.appendChild(titleEl);

        if (item.subtitle) {
          const subEl = document.createElement('span');
          subEl.className = 'palette-item-subtitle';
          subEl.textContent = item.subtitle;
          contentWrap.appendChild(subEl);
        }

        itemEl.appendChild(contentWrap);

        if (item.badge) {
          const badgeEl = document.createElement('span');
          badgeEl.className = 'palette-item-badge';
          badgeEl.textContent = item.badge;
          itemEl.appendChild(badgeEl);
        }

        const arrowEl = document.createElement('span');
        arrowEl.className = 'palette-item-arrow';
        arrowEl.textContent = '↵';
        itemEl.appendChild(arrowEl);

        itemEl.addEventListener('mouseenter', () => {
          updateActiveIndex(itemIdx);
        });

        itemEl.addEventListener('click', () => {
          executeItem(item);
        });

        resultsContainer!.appendChild(itemEl);
      }
    }
    input!.setAttribute('aria-activedescendant', 'palette-item-0');
  }

  function updateActiveIndex(nextIdx: number) {
    if (currentFilteredItems.length === 0) return;
    const count = currentFilteredItems.length;
    activeIndex = (nextIdx + count) % count;

    const allItemEls = resultsContainer!.querySelectorAll('.palette-item');
    allItemEls.forEach((el, idx) => {
      const isSelected = idx === activeIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', String(isSelected));
      if (isSelected) {
        input!.setAttribute('aria-activedescendant', el.id);
        (el as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    });
  }

  input.addEventListener('input', () => {
    renderResults(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateActiveIndex(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateActiveIndex(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFilteredItems[activeIndex]) {
        executeItem(currentFilteredItems[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === backdrop) {
      closePalette();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closePalette);
  }

  function onGlobalKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog!.open) closePalette();
      else openPalette();
    } else if (e.key === '/' && !isTyping) {
      e.preventDefault();
      openPalette();
    }
  }

  window.addEventListener('keydown', onGlobalKeyDown);

  document.querySelectorAll('[data-open-command-palette]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPalette();
    });
  });

  return () => {
    window.removeEventListener('keydown', onGlobalKeyDown);
  };
}
