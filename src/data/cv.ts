export type Position = {
  role: string;
  org: string;
  unit?: string;
  period: string;
  url?: string;
};

export const experience: Position[] = [
  {
    role: 'Scholar',
    org: 'AISAR',
    period: 'Oct 2026 – Present',
    url: 'https://scholarship.aisafety.ar/',
  },
  {
    role: 'Teaching Assistant',
    org: 'Universidad Torcuato Di Tella',
    period: 'Mar 2025 – Present',
    url: 'https://www.utdt.edu/',
  },
  {
    role: 'Analyst',
    org: 'Banco Ciudad de Buenos Aires',
    unit: 'AI + Automation CoE',
    period: 'May 2025 – July 2026',
    url: 'https://bancociudad.com.ar/',
  },
  {
    role: 'Software Developer',
    org: 'Teknoware',
    period: 'Feb 2024 – Apr 2025',
  },
];

export const education: Position[] = [
  {
    role: 'B.Sc. in Digital Technologies',
    org: 'Universidad Torcuato Di Tella',
    period: '2022 – 2025',
    url: 'https://www.utdt.edu/',
  },
];

export type Honor = { title: string; year: string; url?: string };

export type Mentee = {
  name: string;
  detail: string;
  url?: string;
  links?: { label: string; url: string }[];
};

export const reviewing: string[] = [
  'reviewing',
];

export type SoftwareTool = {
  name: string;
  date: string;
  blurb: string;
  license: { name: string; url: string };
  code: string;
  docs?: string;
  paper?: string;
  poster?: string;
  posts?: string[];
  logo?: string;
};

const LICENSE = {
  apache: { name: 'Apache 2.0', url: 'https://opensource.org/license/apache-2-0' },
} as const;


export const software: SoftwareTool[] = [
  /** 
  {
    name: 'name',
    date: '2025-09-19',
    logo: 'xxx',
    blurb: 'blurb',
    license: LICENSE.apache,
    code: 'https://github.com/xxx',
    docs: 'https://...',
    paper: 'https://doi.org/xxx',
    posts: ['xxx'],
  },
  */
];

export type SideProject = { name: string; detail: string; url: string };

export const sideProjects: SideProject[] = [
  /** 
  {
    name: 'name',
    detail:
      'detail',
    url: '/xxx/',
  },
    */
];

export const honors: Honor[] = [];