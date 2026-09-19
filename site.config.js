/**
 * Everything about the site that is not code: its address, its name, who runs
 * it. The build (seo/vite-plugin-site.js) reads this and writes it into every
 * page's meta tags and structured data, the sitemap, robots.txt, llms.txt and
 * the legal page — so it only ever has to be changed here.
 *
 * Before publishing, replace every value in [square brackets].
 */
export default {
  /** The published address, no trailing slash. */
  url: 'https://[your-domain.com]',

  name: 'Fruit Fly Slot Machine',
  shortName: 'Fruit Fly Slots',
  tagline: 'A Drosophila CT scan plays a one-armed bandit, on its own.',
  description:
    'A real fruit fly CT scan plays a slot machine while 60,000 real neurons from the '
    + 'MaleCNS connectome light up beside it. It picks its own stakes, learns in its '
    + 'mushroom body that the machine is bad — and keeps playing anyway.',
  keywords: [
    'fruit fly', 'Drosophila melanogaster', 'connectome', 'MaleCNS', 'FlyEM',
    'neuroscience simulation', 'brain simulation in the browser', 'mushroom body',
    'dopamine', 'reward learning', 'gambling', 'slot machine', 'three.js', 'WebGL',
  ],
  language: 'en',
  locale: 'en_US',
  themeColor: '#e1d6c1',

  author: {
    name: 'Ryhox',
    url: 'https://github.com/bedchem',
  },
  repository: 'https://github.com/bedchem/fruit-fly-slot-machine',

  /**
   * Who is responsible for the site, for the privacy notice: GDPR art. 13 asks
   * for the controller's identity and a way to reach them. A private,
   * non-commercial site in Italy needs no postal address or VAT number — those
   * only come in if it is ever run as an economic activity (D.Lgs. 70/2003,
   * art. 7). The email can be an address used only for this site.
   */
  operator: {
    name: 'Pokyh',
    email: 'contact@pokyh.com',
  },

  /** Who hosts the site: named in the privacy notice as a data processor. */
  host: {
    name: '[Hosting provider, e.g. Netlify, Inc.]',
    privacyUrl: '[https://link-to-their-privacy-policy]',
  },
};
