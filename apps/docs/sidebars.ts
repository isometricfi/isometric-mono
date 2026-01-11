import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Quick Start',
      items: [
        'quick-start/index',
        'quick-start/account-setup',
        'quick-start/write',
        'quick-start/buy',
        'quick-start/portfolio',
        'quick-start/history',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: ['concepts/options-basics', 'concepts/strategies'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/collateral-system',
        'architecture/contract-standardization',
        'architecture/settlement',
        'architecture/authentication',
        'architecture/fees',
      ],
    },
  ],
};


export default sidebars;
