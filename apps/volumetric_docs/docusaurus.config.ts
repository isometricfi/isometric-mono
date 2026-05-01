import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Isometric Docs',
  tagline: 'On-chain Bitcoin options. Self-custody, no KYC, no liquidations.',
  favicon: 'img/logo.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.isometric.fi',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'volumetrichq', // Usually your GitHub org/user name.
  projectName: 'volumetric-mono', // Usually your repo name.

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        htmlLang: 'en-US',
      },
      'zh-Hans': {
        htmlLang: 'zh-Hans',
        label: '简体中文',
      },
    },
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // Docs-only mode: removes /docs prefix
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        sitemap: {
          changefreq: 'weekly',
          priority: 0.7,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/social-card.png',
    metadata: [
      {
        name: 'description',
        content:
          'Documentation for Isometric, on-chain Bitcoin call options. Learn how to deposit BTC, write options to earn premium, or buy options for leveraged BTC exposure.',
      },
      {
        name: 'keywords',
        content:
          'Isometric docs, Bitcoin options, BTC options, on-chain Bitcoin options, BTC call options, write Bitcoin options, buy Bitcoin options, covered calls, BTC yield, self-custody Bitcoin, Internet Computer Bitcoin, ckBTC',
      },
      {name: 'twitter:card', content: 'summary_large_image'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'Isometric Docs'},
    ],
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Isometric',
      logo: {
        alt: 'Isometric Logo',
        src: 'img/logo.svg',
        href: '/',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'docSidebar',
          sidebarId: 'technicalSidebar',
          position: 'left',
          label: 'Technical',
        },
        {
          href: 'https://isometric.fi',
          label: 'Open app',
          position: 'right',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Getting started',
          items: [
            {label: 'Connect an account', to: '/getting-started/connect-and-account'},
            {label: 'Deposit', to: '/getting-started/deposit'},
            {label: 'Withdraw', to: '/getting-started/withdraw'},
          ],
        },
        {
          title: 'Trading',
          items: [
            {label: 'Buy an option', to: '/trading/buy-an-option'},
            {label: 'Write an option', to: '/trading/write-an-option'},
            {label: 'Portfolio', to: '/trading/portfolio'},
            {label: 'History', to: '/trading/history'},
          ],
        },
        {
          title: 'Learn',
          items: [
            {label: 'Options explained', to: '/strategies/options-explained'},
            {label: 'Write or Buy', to: '/strategies/write-or-buy'},
            {label: 'FAQ', to: '/faq'},
          ],
        },
        {
          title: 'Technical',
          items: [
            {label: 'Overview', to: '/technical/'},
            {label: 'Mechanics', to: '/technical/mechanics'},
            {label: 'Price oracle', to: '/technical/price-oracle'},
          ],
        },
        {
          title: 'Isometric',
          items: [
            {label: 'App', href: 'https://isometric.fi'},
            {label: 'Privacy', href: 'https://isometric.fi/privacy'},
            {label: 'Terms', href: 'https://isometric.fi/terms'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Isometric.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
