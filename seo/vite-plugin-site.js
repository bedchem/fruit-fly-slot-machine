/**
 * Everything a search engine or an AI assistant reads about this site, built
 * from site.config.js and seo/content.js so none of it can drift apart:
 *
 *   every HTML page   <title>, description, canonical, Open Graph, Twitter card,
 *                     icons, manifest and JSON-LD structured data (<!--site:head-->)
 *   about.html        the long-form write-up, rendered from seo/about.md, and the FAQ
 *   /robots.txt       everyone welcome, AI crawlers named explicitly
 *   /sitemap.xml      the indexable pages
 *   /llms.txt         the llmstxt.org summary for AI agents
 *   /llms-full.txt    the whole write-up and FAQ as Markdown, one fetch
 *   /site.webmanifest, /humans.txt
 *
 * In dev the generated files are served by middleware; in a build they are
 * emitted into dist/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import site from '../site.config.js';
import { PAGES, FAQ } from './content.js';
import { EDIT_SUBJECT } from '../src/game/tiktokEdits.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..');
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => site.url + p;
const authors = site.authors?.length ? site.authors : [site.author];
/** "a", "a and b", "a, b and c" */
const listNames = (names) => (names.length < 3 ? names.join(' and ')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const authorNames = listNames(authors.map(({ name }) => name));
const authorId = (author) => `${site.url}/#author-${encodeURIComponent(author.name.toLowerCase())}`;

/** Placeholders usable in any HTML page or in about.md. */
function fill(text, page) {
  const vars = {
    'SITE.url': site.url,
    'SITE.name': site.name,
    'SITE.tagline': site.tagline,
    'SITE.repository': site.repository,
    'SITE.author': authorNames,
    'SITE.authorUrl': authors[0].url,
    'SITE.operator.name': site.operator.name,
    'SITE.operator.email': site.operator.email,
    'SITE.host.name': site.host.name,
    'SITE.host.privacyUrl': site.host.privacyUrl,
    'SITE.editSubject': EDIT_SUBJECT,
    'BUILD.date': today(),
    'BUILD.year': String(new Date().getFullYear()),
    'PAGE.url': page ? abs(page.path) : site.url,
  };
  return text.replace(/%([A-Za-z.]+)%/g, (m, k) => (k in vars ? vars[k] : m));
}

function aboutMarkdown() {
  return fill(fs.readFileSync(path.join(ROOT, 'seo/about.md'), 'utf8'));
}

// ---------------------------------------------------------------- structured data

const ORGS = {
  janelia: { '@type': 'ResearchOrganization', name: 'HHMI Janelia Research Campus', url: 'https://www.janelia.org' },
  google: { '@type': 'Organization', name: 'Google Research', url: 'https://research.google' },
  cambridge: { '@type': 'CollegeOrUniversity', name: 'University of Cambridge', url: 'https://www.cam.ac.uk' },
  lmb: { '@type': 'ResearchOrganization', name: 'MRC Laboratory of Molecular Biology', url: 'https://www2.mrc-lmb.cam.ac.uk' },
};
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

function jsonLd(page) {
  const url = abs(page.path);
  const people = authors.map((author) => ({
    '@type': 'Person',
    '@id': authorId(author),
    name: author.name,
    url: author.url,
    sameAs: [author.url],
  }));
  const peopleRefs = authors.map((author) => ({ '@id': authorId(author) }));
  const website = {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.name,
    description: site.description,
    inLanguage: site.language,
    publisher: peopleRefs,
  };
  const app = {
    '@type': ['WebApplication', 'CreativeWork'],
    '@id': `${site.url}/#app`,
    name: site.name,
    url: `${site.url}/`,
    description: site.description,
    image: abs('/og-image.jpg'),
    screenshot: abs('/og-image.jpg'),
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Neuroscience simulation',
    operatingSystem: 'Any (runs in a web browser)',
    browserRequirements: 'Requires JavaScript and WebGL',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    inLanguage: site.language,
    keywords: site.keywords.join(', '),
    author: peopleRefs,
    creator: peopleRefs,
    codeRepository: site.repository,
    about: [
      { '@type': 'Taxon', name: 'Drosophila melanogaster', alternateName: 'common fruit fly', sameAs: 'https://en.wikipedia.org/wiki/Drosophila_melanogaster' },
      { '@type': 'Thing', name: 'Connectome', sameAs: 'https://en.wikipedia.org/wiki/Connectome' },
      { '@type': 'Thing', name: 'Mushroom body', sameAs: 'https://en.wikipedia.org/wiki/Mushroom_bodies' },
      { '@type': 'Thing', name: 'Dopamine', sameAs: 'https://en.wikipedia.org/wiki/Dopamine' },
    ],
    isBasedOn: [
      {
        '@type': 'Dataset',
        name: 'MaleCNS v1.0',
        description: 'The connectome of the complete central nervous system of a male Drosophila melanogaster.',
        url: 'https://male-cns.janelia.org/',
        creator: [ORGS.janelia, ORGS.google, ORGS.cambridge, ORGS.lmb],
        license: CC_BY,
      },
      {
        '@type': '3DModel',
        name: 'Drosophila adult fruit fly CT scan',
        url: 'https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117',
        creator: { '@type': 'Person', name: 'etainproject' },
        license: CC_BY,
      },
      {
        '@type': '3DModel',
        name: 'Pillar Slots',
        url: 'https://sketchfab.com/3d-models/pillar-slots-91e255e5a95745f4857607b388421ee1',
        creator: { '@type': 'Person', name: 'local.yany' },
        license: CC_BY,
      },
    ],
  };
  const webpage = {
    '@type': page.path === '/about.html' ? ['WebPage', 'TechArticle'] : 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    inLanguage: site.language,
    isPartOf: { '@id': `${site.url}/#website` },
    about: { '@id': `${site.url}/#app` },
    primaryImageOfPage: abs('/og-image.jpg'),
    dateModified: today(),
    ...(page.path === '/about.html' ? {
      headline: 'How the Fly Lab experiments work',
      author: peopleRefs,
      image: abs('/og-image.jpg'),
    } : {}),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.name, item: `${site.url}/` },
        ...(page.path === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: page.title.split(' | ')[0], item: url }]),
      ],
    },
  };
  const graph = [website, ...people, app, webpage];
  if (page.path === '/about.html') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: FAQ.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }
  // "</" must not appear raw inside a script element
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
}

// ---------------------------------------------------------------- <head>

function head(page) {
  const url = abs(page.path);
  const img = abs('/og-image.jpg');
  const robots = page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="keywords" content="${esc(site.keywords.join(', '))}" />`,
    `<meta name="author" content="${esc(authorNames)}" />`,
    `<meta name="creator" content="${esc(authorNames)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="theme-color" content="${site.themeColor}" />`,
    `<meta name="color-scheme" content="light" />`,
    // icons and install
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    // for AI agents: where the plain-text version lives
    `<link rel="alternate" type="text/markdown" href="${abs('/llms-full.txt')}" title="Full text for AI assistants" />`,
    `<link rel="author" href="${abs('/humans.txt')}" />`,
    // Open Graph
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${esc(site.name)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${site.locale}" />`,
    `<meta property="og:image" content="${img}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc('A translucent orange fruit fly CT scan sitting on a bar stool, pulling the lever of a slot machine')}" />`,
    // Twitter / X
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc('A fruit fly CT scan pulling the lever of a slot machine')}" />`,
    // structured data
    `<script type="application/ld+json">\n${jsonLd(page)}\n</script>`,
  ].join('\n    ');
}

function faqHtml() {
  return FAQ.map(({ q, a }) => `<details class="faq"><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join('\n');
}

function footer() {
  return [
    `<p>© ${new Date().getFullYear()} ${esc(authorNames)} · <a href="/">Fly Lab</a> · <a href="/about.html">How it works</a> · <a href="/legal.html">Legal &amp; privacy</a> · <a href="${site.repository}" rel="noopener">Source code</a></p>`,
    '<p>Connectome: MaleCNS v1.0, FlyEM/HHMI Janelia, University of Cambridge, MRC LMB, Google Research (CC BY 4.0). Fly scan © etainproject, cabinet © local.yany (CC BY 4.0).</p>',
  ].join('\n');
}

// ---------------------------------------------------------------- generated files

const AI_AGENTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Amazonbot',
  'meta-externalagent', 'DuckAssistBot', 'MistralAI-User', 'CCBot',
];

function robots() {
  return [
    '# Everyone is welcome here: search engines and AI assistants alike.',
    '# A plain-text summary for AI agents is at /llms.txt, the full text at /llms-full.txt.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# AI crawlers and assistants, named so there is no doubt',
    ...AI_AGENTS.map((a) => `User-agent: ${a}`),
    'Allow: /',
    '',
    `Sitemap: ${abs('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function sitemap() {
  const urls = PAGES.filter((p) => !p.noindex).map((p) => [
    '  <url>',
    `    <loc>${abs(p.path)}</loc>`,
    `    <lastmod>${today()}</lastmod>`,
    `    <changefreq>${p.changefreq}</changefreq>`,
    `    <priority>${p.priority}</priority>`,
    '  </url>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function llms() {
  return [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    'An interactive neuroscience piece in the browser. The anatomy is real: 60,000 neurons drawn at their measured',
    'positions from MaleCNS v1.0, the complete connectome of a male Drosophila melanogaster (HHMI Janelia FlyEM,',
    'Google Research, University of Cambridge, MRC LMB), with a rate model running over 151.9 million measured synapses.',
    'The fly picks its own stakes (1–5 credits) from its internal state, its mushroom body learns from PAM and PPL1',
    'dopamine that the machine is bad, and it keeps playing. When it runs out of credit it behaves as if it were dying.',
    'There is no money, no betting and no tracking; everything runs client-side.',
    '',
    '## Pages',
    '',
    `- [Watch it play](${abs('/')}): the live piece, a 3D fly at a slot machine with its simulated brain beside it`,
    `- [How it works](${abs('/about.html')}): what is real, the brain model, mushroom-body learning, how it bets, sources, FAQ`,
    `- [Full text](${abs('/llms-full.txt')}): everything above as one Markdown document`,
    '',
    '## Sources',
    '',
    '- [MaleCNS v1.0](https://male-cns.janelia.org/): the connectome (CC BY 4.0)',
    '- [HHMI Janelia FlyEM](https://www.janelia.org/project-team/flyem): the team that mapped it',
    '',
    '## Optional',
    '',
    `- [Source code](${site.repository}): React, three.js, React Three Fiber`,
    `- [Legal notice and privacy](${abs('/legal.html')})`,
    '',
  ].join('\n');
}

function llmsFull() {
  const faq = FAQ.map(({ q, a }) => `### ${q}\n\n${a}`).join('\n\n');
  return [
    aboutMarkdown().trim(),
    '',
    '## Frequently asked questions',
    '',
    faq,
    '',
    '## Links',
    '',
    `- Watch it play: ${abs('/')}`,
    `- How it works: ${abs('/about.html')}`,
    `- Source code: ${site.repository}`,
    ...authors.map((author) => `- Author: ${author.name} (${author.url})`),
    '',
  ].join('\n');
}

function manifest() {
  return JSON.stringify({
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    lang: site.language,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: site.themeColor,
    theme_color: site.themeColor,
    categories: ['education', 'science', 'entertainment'],
    icons: [
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  }, null, 2);
}

function humans() {
  return [
    '/* TEAM */',
    `  Made by: ${authorNames}`,
    ...authors.map((author) => `  Profile: ${author.url}`),
    '',
    '/* THANKS */',
    '  Connectome: MaleCNS v1.0 — FlyEM/HHMI Janelia, University of Cambridge, MRC LMB, Google Research',
    '  Fruit fly CT scan: etainproject',
    '  Slot machine model: local.yany',
    '',
    '/* SITE */',
    `  Last update: ${today()}`,
    '  Language: English',
    '  Standards: HTML5, CSS3, WebGL',
    '  Components: React, three.js, React Three Fiber, drei',
    `  Source: ${site.repository}`,
    '',
  ].join('\n');
}

const GENERATED = {
  'robots.txt': ['text/plain', robots],
  'sitemap.xml': ['application/xml', sitemap],
  'llms.txt': ['text/markdown', llms],
  'llms-full.txt': ['text/markdown', llmsFull],
  'site.webmanifest': ['application/manifest+json', manifest],
  'humans.txt': ['text/plain', humans],
};

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/**
 * Middleware answering page requests for addresses that are not a page under
 * `root`: a folder missing its slash is redirected, the rest get `page()`
 * with a 404 status. Everything else passes through.
 */
function notFound(root, page) {
  return async (req, res, next) => {
    if (!wantsPage(req)) return next();
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (isFile(path.join(root, url.endsWith('/') ? `${url}index.html` : url))) return next();
    if (!url.endsWith('/') && isFile(path.join(root, url, 'index.html'))) {
      res.statusCode = 301;
      res.setHeader('Location', `${url}/${req.url.slice(url.length)}`);
      return res.end();
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(await page());
  };
}

/** A browser asking for a page (not a script, an image or a data file). */
function wantsPage(req) {
  return (req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept ?? '').includes('text/html');
}

// ---------------------------------------------------------------- the plugin

export default function sitePlugin() {
  return {
    name: 'site-seo',

    buildStart() {
      const loose = JSON.stringify(site).match(/\[[^\]"]*\]/g);
      if (loose) {
        this.warn(`site.config.js still has placeholders: ${[...new Set(loose)].join(', ')} — fill them in before publishing.`);
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // pages live in folders now (/casino/index.html), so match on the
        // path from the project root rather than the bare file name
        const file = path.relative(ROOT, ctx.filename).split(path.sep).join('/');
        const page = PAGES.find((p) => p.file === file) ?? {
          file, path: `/${file}`, title: `Not found | ${site.name}`, description: site.description, noindex: true,
        };
        return fill(html, page)
          .replace('<!--site:head-->', head(page))
          .replace('<!--site:about-->', marked.parse(aboutMarkdown()))
          .replace('<!--site:faq-->', faqHtml())
          .replace('<!--site:footer-->', footer());
      },
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].replace(/^\//, '');
        const entry = GENERATED[name];
        if (!entry) return next();
        res.setHeader('Content-Type', `${entry[0]}; charset=utf-8`);
        res.end(entry[1]());
      });
      // After Vite's static files, before its HTML: a page that exists goes on
      // to Vite, a folder without its slash is redirected, and anything else
      // gets the site's 404 — the same answers nginx gives in production.
      return () => {
        server.middlewares.use(notFound(ROOT, async () => {
          const raw = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
          return server.transformIndexHtml('/404.html', raw);
        }));
      };
    },

    configurePreviewServer(server) {
      const dist = path.join(ROOT, 'dist');
      return () => {
        server.middlewares.use(notFound(dist, () => fs.readFileSync(path.join(dist, '404.html'))));
      };
    },

    generateBundle() {
      for (const [fileName, [, make]] of Object.entries(GENERATED)) {
        this.emitFile({ type: 'asset', fileName, source: make() });
      }
    },
  };
}
