import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      items: [
        'getting-started/index',
        'getting-started/connect-and-account',
        'getting-started/deposit',
        'getting-started/withdraw',
      ],
    },
    {
      type: 'category',
      label: 'Trading',
      items: [
        'trading/buy-an-option',
        'trading/write-an-option',
        'trading/portfolio',
        'trading/history',
        'trading/settlement',
        'trading/fees',
      ],
    },
    {
      type: 'category',
      label: 'Strategies',
      items: [
        'strategies/options-explained',
        'strategies/write-or-buy',
      ],
    },
    'faq',
  ],
  technicalSidebar: [
    'technical/index',
    'technical/mechanics',
    'technical/price-oracle',
  ],
};

export default sidebars;
