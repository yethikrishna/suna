export type NavSubLink = {
  href: string;
  name: string;
  description?: string;
};

export type NavMenuColumn = {
  title: string;
  links: NavSubLink[];
};

export type NavMenu = {
  columns: NavMenuColumn[];
  footer: {
    text: string;
    linkLabel: string;
    href: string;
  };
};

export type NavLink =
  | { id: number; name: string; href: string }
  | { id: number; name: string; href: NavSubLink[] }
  | { id: number; name: string; menu: NavMenu };

import { CANONICAL_ORIGIN } from '@/lib/site-metadata';

export const productMenu: NavMenu = {
  columns: [
    {
      title: 'Platform',
      links: [
        {
          name: 'Agent Computer',
          href: '/agent-computer',
          description: 'An isolated cloud computer for every session',
        },
        {
          name: 'Company as Code',
          href: '/company-as-code',
          description: 'Agents, skills and memory as git files you own',
        },
        {
          name: 'Self-hosted',
          href: '/self-hosted',
          description: 'Your VPC, on-prem, or fully air-gapped',
        },
        {
          name: 'Security',
          href: '/security',
          description: 'Isolation, credentials, permissions and audit',
        },
        {
          name: 'Enterprise',
          href: '/enterprise',
          description: 'SSO, RBAC, audit trails and approval gates',
        },
      ],
    },
    {
      title: 'Capabilities',
      links: [
        {
          name: 'Integrations',
          href: '/integrations',
          description: '3,000+ apps through one scoped token',
        },
        {
          name: 'Automations',
          href: '/automations',
          description: 'Cron schedules and signed webhooks',
        },
        {
          name: 'Channels',
          href: '/channels',
          description: 'Slack threads that start real sessions',
        },
        {
          name: 'Agents & Skills',
          href: '/agents-and-skills',
          description: 'A workforce that compounds what it learns',
        },
      ],
    },
  ],
  footer: {
    text: 'Kortix CLI: build and ship your company from the terminal',
    linkLabel: 'Read the docs →',
    href: '/docs',
  },
};

export const companyMenu: NavMenu = {
  columns: [
    {
      title: 'Company',
      links: [
        { name: 'About', href: '/about', description: 'Why we are building Kortix' },
        { name: 'Careers', href: '/careers', description: 'Join the team building it' },
      ],
    },
  ],
  footer: {
    text: 'Kortix is developed in the open',
    linkLabel: 'Read the source →',
    href: 'https://github.com/kortix-ai/suna',
  },
};

export const siteConfig = {
  url: CANONICAL_ORIGIN,
  nav: {
    links: [
      { id: 1, name: 'Product', menu: productMenu },
      { id: 3, name: 'Company', menu: companyMenu },
      { id: 4, name: 'Pricing', href: '/pricing' },
      { id: 6, name: 'Docs', href: '/docs' },
    ] as NavLink[],
  },
  hero: {
    description: 'Kortix – the open AI command center for your company.',
  },
  footerLinks: [
    {
      title: 'Product',
      links: [
        { id: 4, title: 'Support', url: '/support' },
        { id: 5, title: 'Contact', url: 'mailto:hey@kortix.com' },
        { id: 13, title: 'Status', url: 'https://status.kortix.com' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { id: 7, title: 'Documentation', url: '/docs' },
        { id: 8, title: 'Discord', url: 'https://discord.com/invite/RvFhXUdZ9H' },
        { id: 9, title: 'GitHub', url: 'https://github.com/kortix-ai/suna' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { id: 10, title: 'Privacy Policy', url: '/legal?tab=privacy' },
        { id: 11, title: 'Terms of Service', url: '/legal?tab=terms' },
        { id: 12, title: 'License', url: 'https://github.com/kortix-ai/suna/blob/main/LICENSE' },
      ],
    },
  ],
};

export type SiteConfig = typeof siteConfig;
