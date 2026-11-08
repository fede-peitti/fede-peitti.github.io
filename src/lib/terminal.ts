export type Tone = 'out' | 'dim' | 'accent' | 'err' | 'ok' | 'head' | 'art';

export interface Line {
  text: string;
  tone?: Tone;
  href?: string;
  prefix?: string;
}

export interface FsNode {
  title: string;
  body: string;
  href?: string;
  kind: string;
}

export interface Chunk {
  path: string;
  title: string;
  href?: string;
  kind: string;
  text: string;
}

export interface TermIndex {
  generatedAt: string;
  identity: {
    name: string;
    nameZh: string;
    role: string;
    email: string;
    tagline: string;
    philosophy: string;
    bio: string;
    jobTitle: string;
    worksFor: string;
    alumniOf: string[];
    knowsAbout: string[];
    alternateNames: string[];
    socials: { key: string; label: string; href: string }[];
  };
  stats: Record<string, string | number>;
  fs: Record<string, FsNode>;
  chunks: Chunk[];
}

export type Effect =
  | { type: 'clear' }
  | { type: 'navigate'; href: string }
  | { type: 'ask'; question: string }
  | {
      type: 'theme';
      mode: 'light' | 'dark' | 'toggle';
    }
  | { type: 'sound'; mode: 'on' | 'off' | 'toggle' | 'bell' }
  | { type: 'copy'; text?: string }
  | { type: 'custom'; eventName: string; detail?: Record<string, unknown> }
  | { type: 'exit' };

export interface ExecResult {
  lines: Line[];
  effect?: Effect;
}

export interface ShellState {
  cwd: string;
  history: string[];
  histIndex: number;
  chatMode: boolean;
  index: TermIndex | null;
}

export const HOME = '/home/fede';
export const USER = 'fede';
export const HOST = 'personal-site';

/** Dummy launch date. */
const BOOT_ISO = '2026-10-09T00:00:00Z';

export function createShell(index: TermIndex | null = null): ShellState {
  return { cwd: HOME, history: [], histIndex: 0, chatMode: false, index };
}

export const prompt = (state: ShellState) =>
  state.chatMode ? 'ask>' : `${USER}@${HOST}:${shortCwd(state.cwd)}$`;

export const shortCwd = (cwd: string) =>
  cwd === HOME ? '~' : cwd.startsWith(`${HOME}/`) ? `~${cwd.slice(HOME.length)}` : cwd;


export function parseArgv(input: string): string[] {
  const argv: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let started = false;
  for (const ch of input.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      started = true;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) argv.push(cur);
      cur = '';
      started = false;
    } else {
      cur += ch;
      started = true;
    }
  }
  if (started) argv.push(cur);
  return argv;
}

export function resolvePath(cwd: string, arg?: string): string {
  if (!arg || arg === '~') return HOME;
  let base: string[];
  if (arg.startsWith('/')) base = [];
  else if (arg.startsWith('~/')) {
    base = HOME.split('/').filter(Boolean);
    arg = arg.slice(2);
  } else base = cwd.split('/').filter(Boolean);

  for (const part of arg.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return `/${base.join('/')}`;
}

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function directories(index: TermIndex): Set<string> {
  const dirs = new Set<string>(['/', '/home', HOME]);
  for (const path of Object.keys(index.fs)) {
    let dir = parentOf(path);
    while (dir && dir !== '/' && !dirs.has(dir)) {
      dirs.add(dir);
      dir = parentOf(dir);
    }
  }
  return dirs;
}

export interface Entry {
  name: string;
  path: string;
  dir: boolean;
  title?: string;
}

export function listDir(index: TermIndex, path: string, showHidden = false): Entry[] | null {
  const dirs = directories(index);
  if (!dirs.has(path)) return null;
  const seen = new Map<string, Entry>();
  for (const dir of dirs) {
    if (dir !== path && parentOf(dir) === path) {
      seen.set(baseOf(dir), { name: baseOf(dir), path: dir, dir: true });
    }
  }
  for (const [filePath, node] of Object.entries(index.fs)) {
    if (parentOf(filePath) === path) {
      seen.set(baseOf(filePath), {
        name: baseOf(filePath),
        path: filePath,
        dir: false,
        title: node.title,
      });
    }
  }
  return [...seen.values()]
    .filter((e) => showHidden || !e.name.startsWith('.'))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

const STOPWORDS = new Set(
  (
    'a an and are as at be but by do does for from has have how i in is it its of on or so ' +
    'that the their there these this to was what when where which who whom why will with you your ' +
    'tell me can could would should did his him he she they them'
  )
    .split(/\s+/)
    .filter(Boolean)
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+.-]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const EXPANSIONS: Record<string, string[]> = {
  work: ['banco', 'business', 'experience', 'career'],
  works: ['banco', 'business', 'experience', 'career'],
  working: ['banco', 'business', 'experience', 'career'],
  job: ['banco', 'business', 'experience', 'career'],
  employer: ['banco', 'experience'],
  company: ['banco', 'organization'],
  role: ['analyst', 'experience', 'career'],
  career: ['experience', 'education'],
  phd: ['research', 'university', 'education'],
  doctorate: ['research', 'university', 'education'],
  study: ['education', 'university', 'research'],
  studied: ['education', 'university'],
  school: ['education', 'university'],
  university: ['education', 'degree', 'education'],
  advisor: ['research', 'supervisor', 'education'],
  email: ['contact'],
  reach: ['contact', 'email'],
  hire: ['contact', 'experience'],
  award: ['honors', 'achievement'],
  awards: ['honors', 'achievement'],
  prize: ['honors', 'achievement'],
};

function expandQuery(query: string): Map<string, number> {
  const weights = new Map<string, number>();
  for (const term of tokenize(query)) {
    weights.set(term, 1);
    for (const extra of EXPANSIONS[term] ?? []) {
      if (!weights.has(extra)) weights.set(extra, 0.5);
    }
  }
  return weights;
}

export function cleanProse(text: string): string {
  return (
    text
      .split('\n')
      .map((line) =>
        line
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
      )
      .filter((line) => line && !/^[A-Za-z][A-Za-z ]{0,14}:$/.test(line))
      .join('\n')
  );
}

interface Stats {
  df: Map<string, number>;
  tokens: string[][];
  avgLen: number;
}
const statsCache = new WeakMap<TermIndex, Stats>();

function corpusStats(index: TermIndex): Stats {
  const cached = statsCache.get(index);
  if (cached) return cached;
  const tokens = index.chunks.map((c) => tokenize(c.text));
  const df = new Map<string, number>();
  for (const list of tokens) {
    for (const term of new Set(list)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const avgLen = tokens.reduce((sum, t) => sum + t.length, 0) / Math.max(1, tokens.length);
  const stats = { df, tokens, avgLen };
  statsCache.set(index, stats);
  return stats;
}

export interface Hit {
  chunk: Chunk;
  score: number;
}

const KIND_WEIGHT: Record<string, number> = { news: 0.55 };

export function search(index: TermIndex, query: string, limit = 5): Hit[] {
  const weights = expandQuery(query);
  if (!weights.size) return [];
  const { df, tokens, avgLen } = corpusStats(index);
  const N = index.chunks.length;
  const k1 = 1.5;
  const b = 0.75;

  const hits: Hit[] = index.chunks.map((chunk, i) => {
    const docTokens = tokens[i];
    const len = docTokens.length || 1;
    const titleTokens = new Set(tokenize(chunk.title));
    let score = 0;
    for (const [term, weight] of weights) {
      const tf = docTokens.reduce((n, t) => (t === term ? n + 1 : n), 0);
      if (!tf) continue;
      const idf = Math.log(1 + (N - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
      score += weight * idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * len) / avgLen)));
      if (titleTokens.has(term)) score += weight * idf * 0.8;
    }
    return { chunk, score: score * (KIND_WEIGHT[chunk.kind] ?? 1) };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b2) => b2.score - a.score || a.chunk.path.localeCompare(b2.chunk.path))
    .slice(0, limit);
}


const LOGO = [
  '  ███████╗███████╗██████╗ ███████╗',
  '  ██╔════╝██╔════╝██╔══██╗██╔════╝',
  '  █████╗  █████╗  ██║  ██║█████╗',
  '  ██╔══╝  ██╔══╝  ██║  ██║██╔══╝',
  '  ██║     ███████╗██████╔╝███████╗',
  '  ╚═╝     ╚══════╝╚═════╝ ╚══════╝',
];

const stamp = (now: Date) => now.toUTCString().replace('GMT', 'UTC');

export function wrapText(text: string, width = 76): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();
}

export function pickSentences(text: string, query: string, n = 3): string[] {
  const terms = new Set(expandQuery(query).keys());
  if (!terms.size) return [];

  const sentences = cleanProse(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 12 && s.split(/\s+/).length >= 3);

  const scored = sentences.map((sentence, order) => {
    const words = tokenize(sentence);
    const hits = words.filter((w) => terms.has(w)).length;
    return { sentence, order, score: hits === 0 ? 0 : hits / Math.sqrt(words.length || 1) };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, n)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.sentence);
}

export function buildContext(index: TermIndex, question: string, limit = 6): string {
  return search(index, question, limit)
    .map(({ chunk }) => `## ${chunk.title} (${chunk.path.replace(HOME, '~')})\n${chunk.text}`)
    .join('\n\n');
}

export interface Stage {
  key: string;
  label: string;
  detail: string;
  short: string;
}

const STAGES: readonly Stage[] = [
  { key: 'shell', label: 'shell', detail: 'terminal initialized', short: 'ready' },
  { key: 'profile', label: 'profile', detail: 'personal profile loaded', short: 'profile' },
  { key: 'index', label: 'index', detail: 'knowledge index mounted', short: 'index' },
  { key: 'ready', label: 'ready', detail: 'all systems operational', short: 'online' },
];

export const pipelineStages = (): readonly Stage[] => STAGES;

const LABEL_W = Math.max(...STAGES.map((s) => s.label.length));

export function progressBar(fraction: number, width = 20): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function stageLine(
  stage: Stage,
  i: number,
  total: number,
  fraction: number,
  narrow = false
): string {
  const bar = progressBar(fraction, narrow ? 10 : 20);
  const detail = fraction >= 1 ? (narrow ? stage.short : stage.detail) : '';
  const label = stage.label.padEnd(narrow ? stage.label.length : LABEL_W);
  return `  [${i + 1}/${total}] ${label}  ${bar}${detail ? `  ${detail}` : ''}`;
}

export function bootHeader(): Line[] {
  return [
    { text: 'Personal Terminal', tone: 'dim' },
    { text: 'initializing personal workspace', tone: 'dim' },
    { text: '' },
  ];
}

export function bootFooter(): Line[] {
  return [
    { text: '' },
    { prefix: '[  OK  ]', text: ' terminal initialized' },
    { prefix: '[  OK  ]', text: ' personal profile loaded' },
    { prefix: '[  OK  ]', text: ' knowledge index mounted' },
    { text: 'starting shell …', tone: 'dim' },
    { text: '' },
  ];
}

export function bootLines(narrow = false): Line[] {
  return [
    ...bootHeader(),
    ...STAGES.map((stage, i) => ({ text: stageLine(stage, i, STAGES.length, 1, narrow) })),
    ...bootFooter(),
  ];
}

export function motd(
  index: TermIndex,
  now: Date,
  width: number | boolean = false
): Line[] {
  const narrow = typeof width === 'number' ? width < 70 : width;
  const id = index.identity;

  const side = [
    `fede-peitti.com  ·  ${id.name}`,
    id.role,
    id.alumniOf.length ? id.alumniOf.join(' · ') : '',
    '',
    'Personal Terminal',
    'AI · Research · Software',
  ];

  const lines: Line[] = [
    { text: `Last login: ${stamp(now)} from 127.0.0.1`, tone: 'dim' },
    { text: '' },
  ];

  if (narrow) {
    for (const art of LOGO) {
      lines.push({ text: art, tone: 'art' });
    }

    lines.push({ text: '' });

    for (const text of side.filter(Boolean)) {
      lines.push({ text: `  ${text}`, tone: 'head' });
    }
  } else {
    LOGO.forEach((art, i) => {
      lines.push({
        text: `${art.padEnd(40)}${side[i] ?? ''}`,
        tone: 'art',
      });
    });

    for (let i = LOGO.length; i < side.length; i++) {
      if (side[i]) {
        lines.push({ text: `${' '.repeat(40)}${side[i]}`, tone: 'head' });
      }
    }
  }

  lines.push(
    { text: '' },
    {
      text: ' Type `help` for the command list, `ask <question>` to talk to the bot,',
      tone: 'dim',
    },
    {
      text: ' `neofetch` for the system summary, or `theme` to change the lights.',
      tone: 'dim',
    },
    { text: '' }
  );

  return lines;
}

interface Cmd {
  summary: string;
  usage?: string;
  needsIndex?: boolean;
  run: (ctx: Ctx) => ExecResult | Line[];
}

interface Ctx {
  state: ShellState;
  index: TermIndex;
  argv: string[];
  args: string[];
  flags: Set<string>;
  now: Date;
  columns: number;
  narrow: boolean;
}

const err = (text: string): Line[] => [{ text, tone: 'err' }];
const ok = (text: string): Line[] => [{ text, tone: 'ok' }];
const bodyLines = (body: string, tone?: Tone): Line[] =>
  body.split('\n').map((text) => ({ text, tone }));

const fileLines = (index: TermIndex, path: string, tone?: Tone): Line[] => {
  const node = index.fs[path];
  return node ? bodyLines(node.body, tone) : err(`${baseOf(path)}: not available in this index`);
};

function hitLines(hits: Hit[]): Line[] {
  if (!hits.length) return [{ text: 'No matches.', tone: 'dim' }];
  const lines: Line[] = [];
  for (const { chunk } of hits) {
    lines.push({ text: chunk.path.replace(HOME, '~'), tone: 'accent' });
    lines.push({ text: `    ${chunk.title}` });
    if (chunk.href) lines.push({ text: `    open ${chunk.href}`, tone: 'dim', href: chunk.href });
  }
  return lines;
}

export function offlineAnswer(index: TermIndex, question: string): Line[] {
  const hits = search(index, question, 4);
  if (!hits.length) return noAnswer(index, question);

  const terms = new Set(tokenize(question));
  const lines: Line[] = [];
  const cited: Hit[] = [];
  const said = new Set<string>();

  for (const hit of hits.slice(0, 3)) {
    const node = hit.chunk.kind === 'file' ? index.fs[hit.chunk.path] : undefined;
    const source = node?.body ?? hit.chunk.text;
    const lead = cited.length === 0;
    let picked = pickSentences(source, question, lead ? 3 : 1);

    if (lead && node && picked.length < 2) {
      picked = cleanProse(node.body).split('\n').filter(Boolean).slice(0, 4);
    }
    picked = picked.filter((s) => {
      const key = s.toLowerCase().replace(/\W+/g, ' ').trim();
      if (said.has(key)) return false;
      said.add(key);
      return true;
    });
    if (!picked.length) continue;

    cited.push(hit);
    for (const sentence of wrapText(picked.join(lead && node ? '\n' : ' '))) {
      lines.push({ text: sentence });
    }
    lines.push({ text: '' });
  }

  if (!lines.length) {
    const fallback = hits[0];
    cited.push(fallback);
    for (const line of wrapText(fallback.chunk.text)) lines.push({ text: line });
    lines.push({ text: '' });
  }

  lines.push({ text: 'sources', tone: 'dim' });
  for (const { chunk } of cited) {
    const path = chunk.path.replace(HOME, '~');
    const room = 74 - path.length - 5;
    const title = chunk.title.length > room ? `${chunk.title.slice(0, room - 1)}…` : chunk.title;
    lines.push({
      text: `  ${title}  ·  ${path}`,
      tone: 'dim',
      ...(chunk.href ? { href: chunk.href } : {}),
    });
  }
  if (terms.size) {
    lines.push({ text: '', tone: 'dim' });
    lines.push({
      text: `  grep ${[...terms].slice(0, 2).join(' ')}   for every match`,
      tone: 'dim',
    });
  }
  return lines;
}

function noAnswer(index: TermIndex, question: string): Line[] {
  const asked = new Set(tokenize(question));
  const vocabulary = [...index.identity.knowsAbout, ...index.identity.alternateNames];
  const near = vocabulary.find((topic) => tokenize(topic).some((t) => asked.has(t)));
  return [
    { text: 'Nothing in the index matches that.', tone: 'dim' },
    ...(near
      ? [
          {
            text: `Closest topic I do have: ${near} — try \`ask ${near.toLowerCase()}\`.`,
            tone: 'dim' as Tone,
          },
        ]
      : [{ text: 'Try `ls ~` to explore the available content, or `help` to see commands.', tone: 'dim' as Tone }]),
  ];
}


function getSpecificManPage(topic: string, index: TermIndex): Line[] | null {
  const t = topic.trim().toLowerCase();

  if (['fp', 'fede', 'federico', 'fede-peitti', 'peitti'].includes(t)) {
    const id = index.identity;

    return [
      { text: 'FP(1)                 Personal Website Manual                 FP(1)', tone: 'dim' },
      { text: '' },
      { text: 'NAME', tone: 'accent' },
      { text: `    ${id.name} — ${id.jobTitle}, ${id.worksFor}` },
      { text: '' },
      { text: 'SYNOPSIS', tone: 'accent' },
      { text: `    ${id.tagline}` },
      { text: '' },
      { text: 'DESCRIPTION', tone: 'accent' },
      ...bodyLines(`    ${id.bio}`.replace(/(.{86}) /g, '$1\n    ')),
      { text: '' },
      { text: 'SEE ALSO', tone: 'accent' },
      { text: `    ${id.knowsAbout.join(', ')}` },
    ];
  }

  if (['papers', 'paper', 'summaries'].includes(t)) {
    return [
      { text: 'PAPERS(1)              Personal Website Manual              PAPERS(1)', tone: 'dim' },
      { text: '' },
      { text: 'NAME', tone: 'accent' },
      { text: '    papers — technical literature, research topics, and paper analyses' },
      { text: '' },
      { text: 'DESCRIPTION', tone: 'accent' },
      { text: '    Explore research interests and technical analyses available on this website.' },
      { text: '    The catalog depends on the content currently published on the site.' },
      { text: '' },
      { text: 'SEE ALSO', tone: 'accent' },
      { text: '    help(1), ls(1), ask(1)' },
    ];
  }

  if (t === 'git') {
    return [
      { text: 'GIT(1)                 Personal Website Manual                 GIT(1)', tone: 'dim' },
      { text: '' },
      { text: 'NAME', tone: 'accent' },
      { text: '    git — software projects and technical work' },
      { text: '' },
      { text: 'SYNOPSIS', tone: 'accent' },
      { text: '    git [log | tree | status | branch | diff]' },
      { text: '' },
      { text: 'DESCRIPTION', tone: 'accent' },
      { text: '    Explore software projects, development work, and technical milestones.' },
      { text: '    Available subcommands depend on the terminal implementation.' },
      { text: '' },
      { text: 'SEE ALSO', tone: 'accent' },
      { text: '    help(1), ls(1), ask(1)' },
    ];
  }

  return null;
}

export const COMMANDS: Record<string, Cmd> = {
  help: {
    summary: 'list available commands',
    run: () => {
      const groups: [string, string[]][] = [
        [
          'filesystem',
          [
            'ls',
            'cd',
            'pwd',
            'cat',
            'head',
            'tail',
            'wc',
            'sort',
            'uniq',
            'less',
            'tree',
            'find',
            'grep',
            'git',
          ],
        ],
        [
          'content',
          [
            'about',
            'publications',
            'software',
            'talks',
            'posts',
            'research',
            'projects',
            'news',
            'cv',
            'contact',
            'socials',
          ],
        ],
        [
          'system',
          [
            'man',
            'uname',
            'uptime',
            'top',
            'date',
            'cal',
            'curl',
            'env',
            'neofetch',
            'theme',
            'sound',
            'history',
            'clear',
            'echo',
          ],
        ],
        ['navigate', ['open', 'exit']],
        ['chatbot', ['ask', 'chat']],
      ];
      const lines: Line[] = [
        { text: 'fOS shell — a navigable CLI over everything on this site.', tone: 'head' },
        { text: '' },
      ];
      for (const [group, names] of groups) {
        lines.push({ text: `  ${group}`, tone: 'accent' });
        for (const name of names) {
          lines.push({ text: `    ${name.padEnd(14)} ${COMMANDS[name]?.summary ?? ''}` });
        }
        lines.push({ text: '' });
      }
      lines.push(
    {
      text: '  Tab completes, ↑/↓ history, pipes `|` chain filters (`grep`, `head`, `wc`, `sort`).',
      tone: 'dim',
    },
    {
      text: '  Try: `ls ~` · `cat ~/about.md` · `cat ~/news.txt | grep 2025` · `cal`',
      tone: 'dim',
    }
  );
      return lines;
    },
  },

  ls: {
    summary: 'list directory contents',
    usage: 'ls [-l] [-a] [path]',
    needsIndex: true,
    run: ({ index, state, args, flags, columns }) => {
      const path = resolvePath(state.cwd, args[0] ?? '.');
      const entries = listDir(index, path, flags.has('a'));

      if (!entries) {
        return index.fs[path]
          ? [{ text: baseOf(path) }]
          : err(`ls: cannot access '${args[0] ?? path}': No such file or directory`);
      }

      if (!flags.has('l')) {
        if (columns < 60) {
          return entries.map((e) => ({
            text: e.dir ? `${e.name}/` : e.name,
          }));
        }

        return [{
          text: entries.map((e) => (e.dir ? `${e.name}/` : e.name)).join('   '),
        }];
      }

      const formatEntry = (e: Entry) => {
        const file = index.fs[e.path];
        const size = e.dir ? '-' : String(file?.body.length ?? 0).padStart(6);
        const name = e.dir ? `${e.name}/` : e.name;

        return {
          text: columns < 72
            ? `${e.dir ? 'd' : '-'}  ${USER}  ${size}  ${name}`
            : `${e.dir ? 'drwxr-xr-x' : '-rw-r--r--'}  ${USER}  ${size.padStart(6)}  ${name}${e.title && !e.dir ? `  — ${e.title}` : ''}`,
        };
      };

      if (columns < 72) {
        return entries.flatMap((e) => {
          const line = formatEntry(e);
          return [
            line,
            ...(e.title && !e.dir
              ? [{ text: `    — ${e.title}`, tone: 'dim' as Tone }]
              : []),
          ];
        });
      }

      return entries.map(formatEntry);
    },
  },

  cd: {
    summary: 'change the working directory',
    usage: 'cd [path]',
    needsIndex: true,
    run: ({ index, state, args }) => {
      const path = resolvePath(state.cwd, args[0] ?? HOME);

      if (!directories(index).has(path)) {
        return err(`cd: ${args[0] ?? path}: No such file or directory`);
      }

      state.cwd = path;
      return [];
    },
  },

  pwd: {
    summary: 'print the working directory',
    run: ({ state }) => [{ text: state.cwd }],
  },

  cat: {
    summary: 'print a file',
    usage: 'cat <file> [file...]',
    needsIndex: true,
    run: ({ index, state, args }) => {
      if (!args.length) return err('cat: missing operand');

      const lines: Line[] = [];

      for (const [i, arg] of args.entries()) {
        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (i > 0) lines.push({ text: '' });

        if (!node) {
          lines.push(...err(`cat: ${arg}: No such file or directory`));
          continue;
        }

        lines.push(...bodyLines(node.body));

        if (node.href) {
          lines.push(
            { text: '' },
            { text: `→ ${node.href}`, tone: 'accent', href: node.href },
          );
        }
      }

      return lines;
    },
  },

  head: {
    summary: 'output the first part of files',
    usage: 'head [-n lines] <file> [file...]',
    needsIndex: true,
    run: ({ index, state, argv }) => {
      let n = 10;
      const fileArgs: string[] = [];
      const rest = argv.slice(1);

      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-n' && rest[i + 1]) {
          n = Math.max(1, parseInt(rest[i + 1], 10) || 10);
          i++;
        } else if (/^-n\d+$/.test(rest[i])) {
          n = Math.max(1, parseInt(rest[i].slice(2), 10) || 10);
        } else if (/^-\d+$/.test(rest[i])) {
          n = Math.max(1, parseInt(rest[i].slice(1), 10) || 10);
        } else {
          fileArgs.push(rest[i]);
        }
      }

      if (!fileArgs.length) return err('head: missing file operand');

      const lines: Line[] = [];

      for (const [i, arg] of fileArgs.entries()) {
        if (i > 0) lines.push({ text: '' });

        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (!node) {
          lines.push(...err(`head: cannot open '${arg}' for reading: No such file or directory`));
          continue;
        }

        const rawLines = node.body.split('\n');
        lines.push(...bodyLines(rawLines.slice(0, n).join('\n')));
      }

      return lines;
    },
  },

  tail: {
    summary: 'output the last part of files',
    usage: 'tail [-n lines] <file> [file...]',
    needsIndex: true,
    run: ({ index, state, argv }) => {
      let n = 10;
      const fileArgs: string[] = [];
      const rest = argv.slice(1);

      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-n' && rest[i + 1]) {
          n = Math.max(1, parseInt(rest[i + 1], 10) || 10);
          i++;
        } else if (/^-n\d+$/.test(rest[i])) {
          n = Math.max(1, parseInt(rest[i].slice(2), 10) || 10);
        } else if (/^-\d+$/.test(rest[i])) {
          n = Math.max(1, parseInt(rest[i].slice(1), 10) || 10);
        } else {
          fileArgs.push(rest[i]);
        }
      }

      if (!fileArgs.length) return err('tail: missing file operand');

      const lines: Line[] = [];

      for (const [i, arg] of fileArgs.entries()) {
        if (i > 0) lines.push({ text: '' });

        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (!node) {
          lines.push(...err(`tail: cannot open '${arg}' for reading: No such file or directory`));
          continue;
        }

        const rawLines = node.body.split('\n');
        lines.push(...bodyLines(rawLines.slice(-n).join('\n')));
      }

      return lines;
    },
  },

  wc: {
    summary: 'print newline, word, and byte counts',
    usage: 'wc [-l|-w|-c] <file>',
    needsIndex: true,
    run: ({ index, state, args, flags }) => {
      if (!args.length) return err('wc: missing file operand');

      const lines: Line[] = [];

      for (const arg of args) {
        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (!node) {
          lines.push(...err(`wc: ${arg}: No such file or directory`));
          continue;
        }

        const content = node.body;
        const l = content ? content.split('\n').length - (content.endsWith('\n') ? 1 : 0) : 0;
        const w = content.trim() ? content.trim().split(/\s+/).length : 0;
        const c = new TextEncoder().encode(content).length;

        const parts: string[] = [];

        if (flags.has('l')) parts.push(String(l).padStart(7));
        if (flags.has('w')) parts.push(String(w).padStart(7));
        if (flags.has('c') || flags.has('m')) parts.push(String(c).padStart(7));

        if (!parts.length) {
          parts.push(
            String(l).padStart(7),
            String(w).padStart(7),
            String(c).padStart(7),
          );
        }

        lines.push({ text: `${parts.join(' ')} ${arg}` });
      }

      return lines;
    },
  },

  sort: {
    summary: 'sort lines of text files',
    usage: 'sort [-r] <file> [file...]',
    needsIndex: true,
    run: ({ index, state, argv }) => {
      const rest = argv.slice(1);
      const reverse = rest.includes('-r');
      const files = rest.filter((arg) => !arg.startsWith('-'));

      if (!files.length) return err('sort: missing file operand');

      const lines: Line[] = [];

      for (const [i, arg] of files.entries()) {
        if (i > 0) lines.push({ text: '' });

        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (!node) {
          lines.push(...err(`sort: cannot read '${arg}': No such file or directory`));
          continue;
        }

        const raw = node.body.split('\n');
        raw.sort((a, b) => a.localeCompare(b));

        if (reverse) raw.reverse();

        lines.push(...bodyLines(raw.join('\n')));
      }

      return lines;
    },
  },

  uniq: {
    summary: 'remove consecutive duplicate lines',
    usage: 'uniq <file> [file...]',
    needsIndex: true,
    run: ({ index, state, argv }) => {
      const files = argv.slice(1).filter((arg) => !arg.startsWith('-'));
      if (!files.length) return err('uniq: missing file operand');

      const lines: Line[] = [];

      for (const [i, arg] of files.entries()) {
        if (i > 0) lines.push({ text: '' });

        const path = resolvePath(state.cwd, arg);
        const node = index.fs[path];

        if (!node) {
          lines.push(...err(`uniq: cannot read '${arg}': No such file or directory`));
          continue;
        }

        const raw = node.body.split('\n');
        const unique = raw.filter((line, index) => index === 0 || line !== raw[index - 1]);

        lines.push(...bodyLines(unique.join('\n')));
      }

      return lines;
    },
  },

  less: {
    summary: 'display file contents',
    usage: 'less <file>',
    needsIndex: true,
    run: ({ index, state, args }) => {
      if (!args.length) return err('less: missing file operand');

      return COMMANDS.cat.run({
        state,
        index,
        argv: ['cat', ...args],
        args,
        flags: new Set(),
        now: new Date(),
        columns: 80,
        narrow: false,
      });
    },
  },

  more: {
    summary: 'display file contents',
    usage: 'more <file>',
    needsIndex: true,
    run: ({ index, state, args }) => {
      if (!args.length) return err('more: missing file operand');

      return COMMANDS.cat.run({
        state,
        index,
        argv: ['cat', ...args],
        args,
        flags: new Set(),
        now: new Date(),
        columns: 80,
        narrow: false,
      });
    },
  },

  tree: {
  summary: 'show the directory tree',
  usage: 'tree [path]',
  needsIndex: true,
  run: ({ index, state, args }) => {
    const root = resolvePath(state.cwd, args[0] ?? '.');
    if (!directories(index).has(root)) {
      return err(`tree: ${args[0] ?? root}: Not a directory`);
    }

    const lines: Line[] = [{ text: shortCwd(root), tone: 'accent' }];
    let files = 0;
    let dirs = 0;

    const walk = (dir: string, prefix: string) => {
      const entries = listDir(index, dir) ?? [];

      entries.forEach((e, i) => {
        const last = i === entries.length - 1;

        lines.push({
          text: `${prefix}${last ? '└── ' : '├── '}${e.dir ? `${e.name}/` : e.name}`,
        });

        if (e.dir) {
          dirs++;
          walk(e.path, `${prefix}${last ? '    ' : '│   '}`);
        } else {
          files++;
        }
      });
    };

    walk(root, '');
    lines.push(
      { text: '' },
      { text: `${dirs} directories, ${files} files`, tone: 'dim' },
    );

    return lines;
  },
  },

  find: {
    summary: 'find files whose path matches a pattern',
    usage: 'find <pattern>',
    needsIndex: true,
    run: ({ index, args }) => {
      if (!args.length) return err('find: missing pattern');

      const needle = args.join(' ').toLowerCase();
      const found = Object.keys(index.fs)
        .filter((path) => path.toLowerCase().includes(needle))
        .sort();

      return found.length
        ? found.map((path) => ({ text: path.replace(HOME, '~') }))
        : [{ text: 'No files matched.', tone: 'dim' }];
    },
  },

  grep: {
    summary: 'search indexed content for a pattern',
    usage: 'grep <pattern>',
    needsIndex: true,
    run: ({ index, args }) => {
      if (!args.length) return err('grep: missing pattern');
      return hitLines(search(index, args.join(' '), 8));
    },
  },

  whoami: {
    summary: 'print the current user',
    needsIndex: true,
    run: ({ index }) => [
      { text: USER },
      {
        text: `${index.identity.name}${index.identity.nameZh ? ` (${index.identity.nameZh})` : ''} — ${index.identity.role}`,
        tone: 'dim',
      },
    ],
  },

  about: {
    summary: 'a short biography',
    needsIndex: true,
    run: ({ index }) => fileLines(index, `${HOME}/about.txt`),
  },

  contact: {
    summary: 'contact information',
    needsIndex: true,
    run: ({ index }) => fileLines(index, `${HOME}/contact.txt`),
  },

  news: {
    summary: 'recent updates',
    needsIndex: true,
    run: ({ index }) => [
      ...fileLines(index, `${HOME}/news.txt`),
      { text: '' },
      { text: '→ /news/', tone: 'accent', href: '/news/' },
    ],
  },

  publications: {
    summary: 'list publications with direct links',
    needsIndex: true,
    run: ({ index }) => {
      const pubs = Object.entries(index.fs)
        .filter(([p]) => p.startsWith(`${HOME}/publications/`))
        .map(([, node]) => node);
      const lines: Line[] = [{ text: 'PUBLICATIONS', tone: 'head' }, { text: '' }];
      for (const pub of pubs) {
        lines.push({ text: pub.title, tone: 'accent' }, ...bodyLines(pub.body, 'dim'));
        if (pub.href) lines.push({ text: `→ ${pub.href}`, tone: 'accent', href: pub.href });
        lines.push({ text: '' });
      }
      return lines;
    },
  },

  software: {
    summary: 'list open-source research software',
    needsIndex: true,
    run: ({ index }) => {
      const tools = Object.entries(index.fs)
        .filter(([p]) => p.startsWith(`${HOME}/software/`))
        .map(([, node]) => node);
      const lines: Line[] = [{ text: 'RESEARCH SOFTWARE', tone: 'head' }, { text: '' }];
      for (const tool of tools) {
        lines.push({ text: tool.title, tone: 'accent' }, ...bodyLines(tool.body, 'dim'));
        if (tool.href) lines.push({ text: `→ ${tool.href}`, tone: 'accent', href: tool.href });
        lines.push({ text: '' });
      }
      return lines;
    },
  },

  talks: {
    summary: 'list presentations and talks',
    needsIndex: true,
    run: ({ index }) => {
      const talksList = Object.entries(index.fs)
        .filter(([p]) => p.startsWith(`${HOME}/talks/`))
        .map(([, node]) => node);
      const lines: Line[] = [{ text: 'TALKS & PRESENTATIONS', tone: 'head' }, { text: '' }];
      for (const talk of talksList.slice(0, 10)) {
        lines.push({ text: talk.title, tone: 'accent' }, ...bodyLines(talk.body, 'dim'), {
          text: '',
        });
      }
      lines.push({ text: '→ /talks/ for all talks & slides', tone: 'accent', href: '/talks/' });
      return lines;
    },
  },


  research: {
    summary: 'list research focus areas',
    needsIndex: true,
    run: ({ index }) => {
      const rList = Object.entries(index.fs)
        .filter(([p]) => p.startsWith(`${HOME}/research/`))
        .map(([, node]) => node);
      const lines: Line[] = [{ text: 'RESEARCH THEMES', tone: 'head' }, { text: '' }];
      for (const r of rList) {
        lines.push({ text: r.title, tone: 'accent' });
        if (r.href) lines.push({ text: `→ ${r.href}`, tone: 'accent', href: r.href });
        lines.push({ text: '' });
      }
      return lines;
    },
  },

  projects: {
    summary: 'list research and software projects',
    needsIndex: true,
    run: ({ index }) => [
      ...fileLines(index, `${HOME}/projects.txt`),
      { text: '' },
      { text: '→ /projects/', tone: 'accent', href: '/projects/' },
    ],
  },

  socials: {
    summary: 'links to social and scholarly profiles',
    needsIndex: true,
    run: ({ index }) => {
      const lines: Line[] = [{ text: 'SCHOLAR & SOCIAL PROFILES', tone: 'head' }, { text: '' }];
      for (const s of index.identity.socials) {
        lines.push({ text: `  ${s.label.padEnd(16)} ${s.href}`, href: s.href });
      }
      return lines;
    },
  },

  cv: {
    summary: 'experience, education, honors',
    needsIndex: true,
    run: ({ index }) => {
      const lines: Line[] = [];
      for (const name of ['experience', 'education', 'honors']) {
        const node = index.fs[`${HOME}/cv/${name}.txt`];
        if (!node) continue;
        lines.push({ text: node.title.toUpperCase(), tone: 'accent' }, ...bodyLines(node.body), {
          text: '',
        });
      }
      lines.push({ text: '→ /cv/ for the full PDF', tone: 'accent', href: '/cv/' });
      return lines;
    },
  },

  man: {
    summary: 'manual page for a command or topic',
    usage: 'man <topic>',
    needsIndex: true,
    run: ({ index, args }) => {
      if (!args.length) {
        return err(
          'What manual page do you want? Try `man fede`, `man papers`, `man git`, or `man help`.',
        );
      }

      const topic = args.join(' ').toLowerCase();

      const specificMan = getSpecificManPage(topic, index);
      if (specificMan) return specificMan;

      const hits = search(index, topic, 1);
      if (!hits.length) return err(`No manual entry for ${topic}`);

      const node = index.fs[hits[0].chunk.path];

      return node
        ? [
            { text: hits[0].chunk.title.toUpperCase(), tone: 'accent' },
            { text: '' },
            ...bodyLines(node.body),
          ]
        : hitLines(hits);
    },
  },

  which: {
    summary: 'locate a software tool',
    usage: 'which <tool>',
    needsIndex: true,
    run: ({ index, args }) => {
      if (!args.length) return err('which: missing operand');
      const needle = args[0].toLowerCase();
      const path = Object.keys(index.fs).find(
        (p) => p.startsWith(`${HOME}/software/`) && baseOf(p).slice(0, -4) === needle
      );
      if (!path) return err(`which: no ${args[0]} in (~/software)`);
      const node = index.fs[path];
      return [
        { text: path.replace(HOME, '~') },
        ...bodyLines(node.body, 'dim'),
        ...(node.href ? [{ text: `→ ${node.href}`, tone: 'accent' as Tone, href: node.href }] : []),
      ];
    },
  },

  uname: {
    summary: 'print system information',
    usage: 'uname [-a]',
    run: ({ flags }) =>
      flags.has('a')
        ? [{ text: 'fOS 1.0.0 pipo 1.0.0-terminal #1 x86_64 Web' }]
        : [{ text: 'fOS' }],
  },

  uptime: {
    summary: 'how long this shell has been running',
    run: ({ now }) => {
      const elapsed = Math.max(0, now.getTime() - Date.parse(BOOT_ISO));
      const days = Math.floor(elapsed / 86_400_000);
      const time = now.toISOString().slice(11, 19);

      return [
        { text: ` ${time} up ${days} days,  1 user,  load average: 0.42, 0.71, 1.03` },
        { text: ' (session)', tone: 'dim' },
      ];
    },
  },

  date: { summary: 'print the current date', run: ({ now }) => [{ text: stamp(now) }] },

  theme: {
    summary: 'switch between CS & system themes',
    usage: 'theme [light|dark]',
    run: ({ args }) => {
      const mode = (args[0] ?? '').toLowerCase();
      if (!mode) return { lines: [], effect: { type: 'theme', mode: 'toggle' } };
      if (
        mode === 'light' ||
        mode === 'dark' 
      ) {
        return { lines: [], effect: { type: 'theme', mode } };
      }
      return [
        {
          text: `theme: no such theme: ${args[0]} (try light, dark)`,
          tone: 'err',
        },
      ];
    },
  },

  echo: { summary: 'write arguments to output', run: ({ args }) => [{ text: args.join(' ') }] },

  history: {
    summary: 'show command history',
    run: ({ state }) =>
      state.history.length
        ? state.history.map((cmd, i) => ({ text: `${String(i + 1).padStart(4)}  ${cmd}` }))
        : [{ text: 'No history yet.', tone: 'dim' }],
  },

  clear: { summary: 'clear the screen', run: () => ({ lines: [], effect: { type: 'clear' } }) },

  neofetch: {
    summary: 'system summary with the logo',
    needsIndex: true,
    run: ({ index, now, narrow }) => {
      const id = index.identity;
      const s = index.stats;
      const elapsed = Math.max(0, now.getTime() - Date.parse(BOOT_ISO));
      const days = Math.floor(elapsed / 86_400_000);

      const stat = (key: string) => String(s[key] ?? '—');

      const info = [
        `${USER}@${HOST}`,
        '─────────────────────────',
        'OS:        pipOS 1.0.0 x86_64',
        'Host:      Fede Peitti',
        'Kernel:    Web terminal',
        `Uptime:    ${days} days`,
        'Shell:     pipo shell',
        `Role:      ${id.jobTitle}, ${id.worksFor}`,
        `Papers:    ${stat('publications')}`,
        `Talks:     ${stat('talks')}`,
        `Software:  ${stat('software')}`,
      ];

      const lines: Line[] = [];

      if (narrow) {
        for (const art of LOGO) {
          lines.push({ text: art, tone: 'art' });
        }

        lines.push({ text: '' });
        for (const text of info) lines.push({ text });

        return lines;
      }

      const height = Math.max(LOGO.length, info.length);

      for (let i = 0; i < height; i++) {
        lines.push({
          text: `${(LOGO[i] ?? '').padEnd(30)}${info[i] ?? ''}`,
          tone: i < LOGO.length ? 'art' : 'out',
        });
      }

    return lines;
  },
},

  open: {
    summary: 'open a page on the site',
    usage: 'open <path|file>',
    needsIndex: true,
    run: ({ index, state, args }) => {
      if (!args.length) return err('open: missing operand');
      const arg = args[0];
      const node = index.fs[resolvePath(state.cwd, arg)];
      const href = node?.href ?? (arg.startsWith('/') ? arg : null);
      if (!href) return err(`open: ${arg}: nothing to open`);
      return {
        lines: [{ text: `Opening ${href} …`, tone: 'dim' }],
        effect: { type: 'navigate', href },
      };
    },
  },

  exit: {
    summary: 'leave the shell',
    run: ({ state }) => {
      if (state.chatMode) {
        state.chatMode = false;
        return ok('Left chat mode.');
      }
      return { lines: [{ text: 'logout', tone: 'dim' }], effect: { type: 'exit' } };
    },
  },

  ask: {
    summary: 'ask the bot anything about me',
    usage: 'ask <question>',
    needsIndex: true,
    run: ({ args }) => {
      const question = args.join(' ').trim();
      if (!question) return err('ask: what would you like to know? e.g. `ask what is the meaning of life?`');
      return { lines: [], effect: { type: 'ask', question } };
    },
  },

  chat: {
    summary: 'enter interactive chat mode',
    needsIndex: true,
    run: ({ state }) => {
      state.chatMode = true;
      return [
        { text: 'Chat mode. Every line goes to the bot; `exit` returns to the shell.', tone: 'ok' },
      ];
    },
  },

  fortune: {
    summary: 'some insightful quote',
    run: ({ now }) => {
      const quotes = [
        '“We should stop calling errors ‘bugs’ and call them what they are: errors.” — Edsger W. Dijkstra',
        '“Those who can imagine anything, can create the impossible.” — Alan Turing',
        '“Do you believe in UFOs?” — Minori Kushieda',
        ' - ',
      ];
      const idx = Math.abs(now.getTime() % quotes.length);
      return [{ text: quotes[idx], tone: 'ok' }];
    },
  },

  cal: {
    summary: 'display a calendar',
    usage: 'cal [month] [year]',
    run: ({ args, now }) => {
      const year = parseInt(args[1] || args[0], 10) || now.getUTCFullYear();
      const month = args.length === 2 ? parseInt(args[0], 10) - 1 : now.getUTCMonth();
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const header = `${monthNames[month]} ${year}`;
      const pad = Math.max(0, Math.floor((20 - header.length) / 2));
      const lines: Line[] = [
        { text: ' '.repeat(pad) + header, tone: 'head' },
        { text: 'Su Mo Tu We Th Fr Sa', tone: 'accent' },
      ];
      const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      let row = '   '.repeat(firstDay);
      for (let day = 1; day <= daysInMonth; day++) {
        const isToday =
          day === now.getUTCDate() && month === now.getUTCMonth() && year === now.getUTCFullYear();
        const cell = String(day).padStart(2);
        row += isToday ? `[${cell}]` : ` ${cell}`;
        if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
          lines.push({ text: row.trimEnd() });
          row = '';
        }
      }
      return lines;
    },
  },

  env: {
    summary: 'print environment variables',
    run: () => [
      { text: 'USER=fp' },
      { text: 'HOST=pipo' },
      { text: 'SHELL=/bin/fp' },
      { text: 'HOME=/home/fp' },
      { text: 'CUDA_VISIBLE_DEVICES=0,1,2,3' },
      { text: 'NVIDIA_VISIBLE_DEVICES=all' },
      { text: 'PATH=/home/fp/software:/usr/local/bin:/usr/bin:/bin' },
    ],
  },

  sound: {
    summary: 'toggle mechanical keyboard audio clicks',
    usage: 'sound [on|off|bell]',
    run: ({ args }) => {
      const mode = (args[0] ?? 'toggle').toLowerCase();
      if (mode === 'on' || mode === 'off' || mode === 'toggle' || mode === 'bell') {
        return {
          lines: [{ text: `Sound mode: ${mode}`, tone: 'ok' }],
          effect: { type: 'sound', mode },
        };
      }
      return [{ text: 'sound: use `sound on`, `sound off`, or `sound bell`', tone: 'err' }];
    },
  },

  paper: {
    summary: 'explore research papers and technical analyses',
    usage: 'paper [topic]',
    run: ({ args }) => {
      const topic = args.join(' ').trim().toLowerCase();
      const href = '/papers/';

      const title = topic
        ? `Research papers: ${topic}`
        : 'Research Papers';

      return {
        lines: [
          { text: `Opening ${title}…`, tone: 'ok' },
          { text: `→ ${href}`, tone: 'accent', href },
        ],
        effect: { type: 'navigate', href },
      };
    },
  },

  papers: {
    summary: 'browse research papers and technical analyses',
    usage: 'papers',
    run: () => ({
      lines: [
        { text: 'Opening Research Papers…', tone: 'ok' },
        { text: '→ /papers/', tone: 'accent', href: '/papers/' },
      ],
      effect: { type: 'navigate', href: '/papers/' },
    }),
  },

  git: {
    summary: 'academic and professional timeline',
    usage: 'git [log|tree|status|branch|diff]',
    run: ({ args }) => {
      const sub = args[0]?.toLowerCase() || 'log';

      if (sub === 'log' || sub === 'tree' || sub === 'graph') {
        return [
          { text: '* commit HEAD  Business Analyst — AI and Automation @ Banco Ciudad', tone: 'head' },
          { text: '| Author: Federico Peitti', tone: 'dim' },
          { text: '* commit       B.Sc. in Digital Technologies — UTDT', tone: 'accent' },
          { text: '| GPA: 9.75/10 · Graduated December 2025', tone: 'dim' },
          { text: '* commit       Exchange semester — Keio University', tone: 'ok' },
          { text: '| September 2024 – February 2025', tone: 'dim' },
          { text: '* commit       Teaching Assistant — UTDT', tone: 'accent' },
          { text: '| Python, Data Engineering, AI, and programming', tone: 'dim' },
          { text: '' },
          { text: '  Try: `git status` · `git branch` · `git diff`', tone: 'dim' },
        ];
      }

      if (sub === 'status') {
        return [
          { text: 'Working tree status', tone: 'head' },
          { text: '' },
          { text: 'Professional:', tone: 'accent' },
          { text: '  Business Analyst specializing in AI and Automation @ Banco Ciudad' },
          { text: '  Teaching Assistant @ UTDT' },
          { text: '' },
          { text: 'Education:', tone: 'accent' },
          { text: '  B.Sc. Digital Technologies · UTDT · GPA 9.75/10' },
          { text: '' },
          { text: 'No uncommitted changes reported.', tone: 'dim' },
        ];
      }

      if (sub === 'branch') {
        return [
          { text: '* main', tone: 'ok' },
          { text: '  applied-ai' },
          { text: '  natural-language-processing' },
          { text: '  computational-linguistics' },
          { text: '  multi-agent-systems' },
        ];
      }

      if (sub === 'diff') {
        return [
          { text: 'Research interests — current focus', tone: 'head' },
          { text: '' },
          { text: '+ Large Language Models and NLP', tone: 'ok' },
          { text: '+ Computational Linguistics', tone: 'ok' },
          { text: '+ Multi-agent LLM systems', tone: 'ok' },
          { text: '+ AI safety and alignment', tone: 'ok' },
          { text: '+ Social simulations and collective behavior', tone: 'ok' },
        ];
      }

      return err(
        `git: '${sub}' is not a recognized command. Try 'git log', 'git status', 'git branch', or 'git diff'.`,
      );
    },
  },

  sudo: {
    summary: 'execute a command as another user',
    run: ({ argv }) => [
      { text: `${USER} is not in the sudoers file.  This incident will be reported.`, tone: 'err' },
      ...(argv.length > 1 ? [{ text: '(nice try)', tone: 'dim' as Tone }] : []),
    ],
  },
};

export const ALIASES: Record<string, string> = {
  ll: 'ls -l',
  la: 'ls -la',
  cls: 'clear',
  q: 'exit',
  '?': 'help',
  pubs: 'publications',
  blog: 'posts',
  htop: 'top',
  links: 'socials',
  printenv: 'env',
  wget: 'curl',
  weather: 'curl wttr.in',
  status: 'git status',
  log: 'git log',
  gittree: 'git tree'
};

export const NEEDS_INDEX = new Set(
  Object.entries(COMMANDS)
    .filter(([, cmd]) => cmd.needsIndex)
    .map(([name]) => name)
);

export function splitPipeline(input: string): string[] {
  const stages: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && !inSingle) {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === '|' && !inSingle && !inDouble) {
      if (current.trim()) stages.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) stages.push(current.trim());
  return stages;
}

export function applyPipeFilter(
  lines: Line[],
  stageCmd: string,
  _state: ShellState,
  _index: TermIndex | null
): Line[] {
  const argv = parseArgv(stageCmd);
  const name = argv[0]?.toLowerCase();
  const rest = argv.slice(1);

  if (name === 'grep') {
    let ignoreCase = false;
    let invert = false;
    let pattern = '';

    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '-i') ignoreCase = true;
      else if (rest[i] === '-v') invert = true;
      else if (!pattern && !rest[i].startsWith('-')) pattern = rest[i];
    }

    if (!pattern) return lines;

    const pat = ignoreCase ? pattern.toLowerCase() : pattern;
    return lines.filter((line) => {
      const text = ignoreCase ? line.text.toLowerCase() : line.text;
      const match = text.includes(pat);
      return invert ? !match : match;
    });
  }

  if (name === 'head') {
    let n = 10;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '-n' && rest[i + 1]) n = Math.max(1, parseInt(rest[++i], 10) || 10);
      else if (/^-n\d+$/.test(rest[i])) n = Math.max(1, parseInt(rest[i].slice(2), 10) || 10);
      else if (/^-\d+$/.test(rest[i])) n = Math.max(1, parseInt(rest[i].slice(1), 10) || 10);
    }
    return lines.slice(0, n);
  }

  if (name === 'tail') {
    let n = 10;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '-n' && rest[i + 1]) n = Math.max(1, parseInt(rest[++i], 10) || 10);
      else if (/^-n\d+$/.test(rest[i])) n = Math.max(1, parseInt(rest[i].slice(2), 10) || 10);
      else if (/^-\d+$/.test(rest[i])) n = Math.max(1, parseInt(rest[i].slice(1), 10) || 10);
    }
    return lines.slice(-n);
  }

  if (name === 'wc') {
    const l = lines.length;
    const allText = lines.map((l) => l.text).join('\n');
    const w = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    const c = new TextEncoder().encode(allText).length;
    const isL = rest.includes('-l');
    const isW = rest.includes('-w');
    const isC = rest.includes('-c') || rest.includes('-m');
    const parts: string[] = [];
    if (isL) parts.push(String(l).padStart(7));
    if (isW) parts.push(String(w).padStart(7));
    if (isC) parts.push(String(c).padStart(7));
    if (!parts.length)
      parts.push(String(l).padStart(7), String(w).padStart(7), String(c).padStart(7));
    return [{ text: parts.join(' ') }];
  }

  if (name === 'sort') {
    const reverse = rest.includes('-r');
    const sorted = [...lines].sort((a, b) => a.text.localeCompare(b.text));
    return reverse ? sorted.reverse() : sorted;
  }

  if (name === 'uniq') {
    const filtered: Line[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 || lines[i].text !== lines[i - 1].text) {
        filtered.push(lines[i]);
      }
    }
    return filtered;
  }

  return lines;
}

function execSingle(
  state: ShellState,
  cmdLine: string,
  now: Date,
  columns: number,
  narrow: boolean
): ExecResult {
  const rawArgv = parseArgv(cmdLine.replace(/^\/+/, ''));
  const first = rawArgv[0]?.toLowerCase() ?? '';
  const aliasExpansion = ALIASES[first];

  const argv = aliasExpansion
    ? parseArgv(`${aliasExpansion} ${rawArgv.slice(1).join(' ')}`.trim())
    : rawArgv;

  const name = argv[0]?.toLowerCase() ?? '';
  const cmd = COMMANDS[name];

  if (!name) return { lines: [] };

  if (!cmd) {
    const near = Object.keys(COMMANDS).filter((c) => c.startsWith(name[0]));
    return {
      lines: [
        { text: `${name}: command not found`, tone: 'err' },
        ...(near.length
          ? [{ text: `Did you mean: ${near.join(', ')}?`, tone: 'dim' as Tone }]
          : []),
        { text: 'Type `help` for the command list.', tone: 'dim' },
      ],
    };
  }

  if (cmd.needsIndex && !state.index) {
    return {
      lines: [{ text: `${name}: knowledge index unavailable`, tone: 'err' }],
    };
  }

  const rest = argv.slice(1);
  const flags = new Set<string>();
  const args: string[] = [];

  for (const token of rest) {
    if (/^-[a-z]+$/i.test(token)) {
      for (const ch of token.slice(1)) flags.add(ch.toLowerCase());
    } else {
      args.push(token);
    }
  }

  const out = cmd.run({
    state,
    index: state.index as TermIndex,
    argv: [name, ...rest],
    args,
    flags,
    now,
    columns,
    narrow,
  });

  return Array.isArray(out) ? { lines: out } : out;
}

export function exec(
  state: ShellState,
  input: string,
  now: Date = new Date(),
  width: number | boolean = 80
): ExecResult {
  const columns =
    typeof width === 'number'
      ? Math.max(24, Math.floor(width))
      : width
        ? 48
        : 80;

  const narrow = columns < 70;
  const line = input.trim();

  if (!line) return { lines: [] };

  state.history.push(line);
  state.histIndex = state.history.length;

  // In chat mode, bare lines are questions unless they are commands.
  if (state.chatMode && line !== 'exit' && !line.startsWith('/')) {
    return { lines: [], effect: { type: 'ask', question: line } };
  }

  const pipeline = splitPipeline(line);

  if (pipeline.length > 1) {
    const firstResult = execSingle(state, pipeline[0], now, columns, narrow);

    // Navigation and other effects should not be passed through text filters.
    if (firstResult.effect) return firstResult;

    let currentLines = firstResult.lines;

    for (let i = 1; i < pipeline.length; i++) {
      currentLines = applyPipeFilter(
        currentLines,
        pipeline[i],
        state,
        state.index
      );
    }

    return { lines: currentLines };
  }

  return execSingle(state, line, now, columns, narrow);
}

export function complete(
  state: ShellState,
  input: string
): { value: string; options: string[] } {
  const trailingSpace = /\s$/.test(input);
  const argv = parseArgv(input);
  const word = trailingSpace ? '' : (argv[argv.length - 1] ?? '');
  const command = argv[0]?.toLowerCase();

  let options: string[];

  if (argv.length <= 1 && !trailingSpace) {
    const allNames = [...Object.keys(COMMANDS), ...Object.keys(ALIASES)];
    options = [...new Set(allNames)]
      .filter((name) => name.startsWith(word.toLowerCase()))
      .sort();
  } else if (argv.length === 2 && !trailingSpace && command === 'theme') {
    options = [
      'light', 'dark'
    ].filter((option) => option.startsWith(word.toLowerCase())).sort();
  } else if (argv.length === 2 && !trailingSpace && command === 'sound') {
    options = ['on', 'off', 'bell', 'toggle']
      .filter((option) => option.startsWith(word.toLowerCase())).sort();
  } else if (state.index) {
    const slash = word.lastIndexOf('/');
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
    const leaf = slash >= 0 ? word.slice(slash + 1) : word;

    const entries = listDir(
      state.index,
      resolvePath(state.cwd, dirPart || '.'),
      leaf.startsWith('.')
    );

    options = (entries ?? [])
      .filter((entry) => entry.name.startsWith(leaf))
      .map((entry) => `${dirPart}${entry.name}${entry.dir ? '/' : ''}`)
      .sort();
  } else {
    options = [];
  }

  if (options.length === 0) return { value: input, options: [] };

  let common = options[0];
  for (const option of options) {
    while (!option.startsWith(common)) {
      common = common.slice(0, -1);
    }
  }

  const prefix = trailingSpace
    ? input
    : input.slice(0, input.length - word.length);

  const value =
    options.length === 1 && !common.endsWith('/')
      ? `${prefix}${common} `
      : `${prefix}${common}`;

  return { value, options: options.length > 1 ? options : [] };
}

export function historyStep(
  state: ShellState,
  direction: -1 | 1,
  draft: string
): string {
  if (!state.history.length) return draft;

  const next = state.histIndex + direction;

  if (next < 0) {
    state.histIndex = 0;
    return state.history[0];
  }

  if (next >= state.history.length) {
    state.histIndex = state.history.length;
    return '';
  }

  state.histIndex = next;
  return state.history[next];
}