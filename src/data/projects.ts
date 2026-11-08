export type ProjectLink = {
  label: string;
  href: string;
  icon: string;
};

export type Project = {
  slug: string;
  publicationId?: string;
  title: string;
  shortTitle: string;
  area: string;
  summary: string;
  year: string;
  status: string;
  tags: string[];
  featured?: boolean;
  links: ProjectLink[];
};

export const projects: Project[] = [
  {
    slug: 'slug',
    publicationId: 'publicationId',
    title: 'title',
    shortTitle: 'shortTitle',
    area: 'area',
    year: 'year',
    status: 'status',
    featured: true,
    tags: ['tag A', 'tag B', 'tag C'],
    summary:
      'summary',
    links: [
      /** 
      { label: 'Research', icon: 'link', href: '/research/xxx/' },
      { label: 'Publication', icon: 'file', href: '/publications/xxxx/' },
      { label: 'Post', icon: 'pencil', href: '/posts/xxx/' },
      { label: 'Docs', icon: 'book', href: 'https://...' },
      { label: 'Code', icon: 'code', href: 'https://...' },
      {
        label: 'Data',
        icon: 'database',
        href: 'https://...',
      },
      {
        label: 'Latest slides',
        icon: 'slides',
        href: 'https://...',
      },
      */
    ],
  }
];

export const featuredProjects = projects.filter((project) => project.featured);
