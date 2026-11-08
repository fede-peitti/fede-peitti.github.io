/**
 * Central site
 */

export const site = {
  name: 'Federico Peitti',
  role: 'Research Scholar, AISAR & Teaching Assistant, UTDT',
  shortRole: 'B.Sc. in Digital Technologies',
  tagline: 'placeholder tagline',
  bio: `I am interested in exploring and understanding how technologies can shape human behavior.
   I have a B.Sc. in Digital Technologies from Universidad Torcuato Di Tella.`,
  philosophy: 'Even the saddest endings turn into beautiful memories.',
  url: 'https://pipo.com',
  email: 'fede.peitti@gmail.com',
  description:
    'Personal website.',
};

export const identity = {
  jobTitle: 'Research Scholar at AISAR & Teaching Assistant at UTDT',
  worksFor: { name: 'AISAR', url: 'https://scholarship.aisafety.ar/' },
  alumniOf: [
    { name: 'Universidad Torcuato Di Tella', url: 'https://www.utdt.edu/' },
  ],
  knowsAbout: [
    'Digital Technologies',
    'Artificial Intelligence',
    'AI Safety',
    'Computer Science',
  ],
  alternateNames: [
    'Fede P',
    'Peitti Federico',
    'Peiti Federico',
    'Peitti',
    'Peiti',
    'Federico Peiti',
    'Fede Peitti',
    'Federico Peitti',
    'fptt',
  ],
  twitter: '@fefe_peitti',
};

export type NavItem = { label: string; href: string; footerOnly?: boolean };

export const nav: NavItem[] = [
  // { label: 'Research', href: '/research/' },
  //{ label: 'Projects', href: '/projects/', footerOnly: true },
  //{ label: 'Publications', href: '/publications/' },
  //{ label: 'Software', href: '/software/' },
  //{ label: 'Talks', href: '/talks/' },
  { label: 'Teaching', href: '/teaching/' },
  { label: 'CV', href: '/cv/', footerOnly: true },
  { label: 'Photos', href: '/photos/', footerOnly: true },
  // { label: 'Posts', href: '/posts/' },
  // { label: 'News', href: '/news/' },
  // { label: 'Search', href: '/search/', footerOnly: true },
  // { label: 'Algorithms', href: '/algorithms/', footerOnly: true },
  // { label: 'Papers', href: '/papers/', footerOnly: true },
  { label: 'Terminal', href: '/terminal/', footerOnly: true },
];

export type SocialKey =
  'email' |  'scholar' | 'github' | 'linkedin' ;

export const socials: { key: SocialKey; label: string; href: string }[] = [
  { key: 'email', label: 'Email', href: 'mailto:fede.peitti@gmail.com' },
  /** 
  {
    key: 'scholar',
    label: 'Google Scholar',
    href: 'https://scholar.google.com/citations?user=n2AvFg0AAAAJ&hl=en',
  },
  */
  { key: 'github', label: 'GitHub', href: 'https://github.com/fede-peitti' },
  { key: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/federico-peitti/' },
];

export const socialByKey = Object.fromEntries(socials.map((s) => [s.key, s]));
