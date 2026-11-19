import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://pavel-samuta.github.io';
const xml = fs.readFileSync('sitemap.xml', 'utf8');
const urls = [...xml.matchAll(/<loc>\s*([^<]+)<\/loc>/g)].map(m => m[1].trim());
if (urls.length !== 98 || new Set(urls).size !== 98) {
  throw Error('Unexpected sitemap: expected 98 unique URLs, got ' + urls.length);
}
const isEnglish = p => p.startsWith('/en/');
const esc = s => String(s).replace(/&(?!(?:amp|quot|lt|gt|#\d+);)/g,'&amp;').replace(/"/g,'&quot;');
const tidy = s => s.replace(/\s+/g,' ').trim();
const clipped = (str, max) => {
  if (str.length <= max) return str;
  let s = str.slice(0,max-1);
  const n = s.lastIndexOf(' ');
  if (n > max*0.65) s = s.slice(0,n);
  return s.replace(/[ ,:;.\-]+$/,'')+'.';
};
const shortTitle = (s,en) => {
  if (s.length <= 65) return s;
  const suffix = en ? ' | Pavel Samuta' : ' | Павел Самута';
  let bare = s.replace(/\s*\|\s*(?:Pavel Samuta|Павел Самута)\s*$/i,'');
  const max = 65 - suffix.length;
  if (bare.length > max) {
    let a = bare.slice(0,max+1);
    const n = a.lastIndexOf(' ');
    bare = n>24 ? a.slice(0,n) : a.slice(0,max);
  }
  return bare.replace(/[\s|,:;\-]+$/,'')+suffix;
};
const footer = en => en
  ? '<footer><div class="wrap">Pavel Samuta · Independent mechanical engineering · Belarus · <a href="/en/">Home</a> · <a href="/en/problems/">Engineering services</a> · <a href="mailto:pavelsamuta@gmail.com">Email</a></div></footer>'
  : '<footer><div class="wrap">ИП Самута Павел Александрович · УНП 291716262 · Беларусь · <a href="/services/">Услуги</a> · <a href="/contacts/">Контакты</a></div></footer>';
const schema = (p,title,url) => {
  let type='WebPage';
  if (/\/guides\/[^/]+\//.test(p)) type='TechArticle';
  else if (/\/articles\/[^/]+\//.test(p)) type='Article';
  else if (/\/engineering-data\/[^/]+\//.test(p)) type='Dataset';
  else if (/\/projects\/[^/]+\//.test(p)) type='CreativeWork';
  else if (/calculator\//.test(p)) type='SoftwareApplication';
  else if (/\/(?:reverse-engineering|obsolete-spare-parts|industrial-localization|manufacturing-localization|supplier-technical-review|supplier-technical-assessment|factory-acceptance-test|fat-equipment-acceptance|technical-documentation-recovery|design-documentation-recovery|critical-spare-parts|services|cnc-3d-modeling)\//.test(p)) type='Service';
  else if (/\/engineering-data\/$/.test(p)||/\/guides\/$/.test(p)) type='CollectionPage';
  const x={'@context':'https://schema.org','@type':type,'name':title,'url':url};
  if (type==='Article'||type==='TechArticle') x.author={'@type':'Person','name':'Pavel Samuta'};
  if (type==='Service') x.provider={'@type':'Person','name':'Pavel Samuta'};
  if (type==='SoftwareApplication') x.applicationCategory='EngineeringApplication';
  return '<script type="application/ld+json">'+JSON.stringify(x).replace(/</g,'\\u003c')+'</script>';
};
const checks={checked:0,modified:0,og_added:0,footer_added:0,menu_added:0,ld_added:0,analytics_added:0,title_shortened:0,description_shortened:0,skipped:[]};
const changed=[];
for (const url of urls) {
  const page = new URL(url).pathname;
  const rel = path.join('.' + page,'index.html');
  if (!fs.existsSync(rel)) throw Error('Missing '+rel);
  let html=fs.readFileSync(rel,'utf8'),old=html;
  checks.checked++;
  if (page==='/instant-quote-dfm/' || /<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) { checks.skipped.push(page); continue; }
  const en=isEnglish(page);
  const titleMatch=html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleMatch) throw Error('Missing title: '+page);
  let title=tidy(titleMatch[1]);
  const descMatch=html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  let desc=descMatch ? descMatch[1] : '';
  const newTitle=shortTitle(title,en);
  if (newTitle !== title) {
    html=html.replace(titleMatch[0],'<title>'+newTitle+'</title>');
    title=newTitle;checks.title_shortened++;
  }
  if (desc.length>165) {
    const newDesc=clipped(desc,160);
    html=html.replace(descMatch[0],descMatch[0].replace(desc,newDesc));
    desc=newDesc;checks.description_shortened++;
  }
  if (!/property=["']og:title["']/i.test(html)) {
    const tags = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Pavel Samuta Engineering">',
      '<meta property="og:locale" content="'+(en?'en_US':'ru_RU')+'">',
      '<meta property="og:url" content="'+esc(url)+'">',
      '<meta property="og:title" content="'+esc(title)+'">',
      '<meta property="og:description" content="'+esc(desc)+'">',
      '<meta property="og:image" content="'+BASE+'/assets/logo-steel.webp">',
      '<meta property="og:image:alt" content="Samuta Engineering and Technology">',
      '<meta name="twitter:card" content="summary">',
      '<meta name="twitter:title" content="'+esc(title)+'">',
      '<meta name="twitter:description" content="'+esc(desc)+'">',
      '<meta name="twitter:image" content="'+BASE+'/assets/logo-steel.webp">'
    ].join('');
    html=html.replace(/<\/head>/i,tags+'</head>');
    checks.og_added++;
  }
  if (!/name=["']twitter:card["']/i.test(html)) {
    html=html.replace(/<\/head>/i,'<meta name="twitter:card" content="summary"></head>');
  }
  if (!/application\/ld\+json/i.test(html)) {
    html=html.replace(/<\/head>/i,schema(page,title,url)+'</head>');
    checks.ld_added++;
  }
  if (!/src=["']\/assets\/analytics\.js["']/i.test(html)) {
    html=html.replace(/<\/head>/i,'<script src="/assets/analytics.js" defer></script></head>');
    checks.analytics_added++;
  }
  if (/<nav\b/i.test(html) && !/class=["'][^"']*mobile-menu-toggle/i.test(html)) {
    html=html.replace(/(<nav\b[^>]*>)/i,'$1<button type="button" class="mobile-menu-toggle" aria-label="'+(en?'Open menu':'Открыть меню')+'" aria-expanded="false">☰</button>');
    checks.menu_added++;
  }
  if (!/<footer(?:\s|>)/i.test(html)) {
    html=html.replace(/<\/body>/i,footer(en)+'</body>');
    checks.footer_added++;
  }
  if (html!==old) {fs.writeFileSync(rel,html);changed.push(page);checks.modified++;}
}
for (const url of urls) {
  const page=new URL(url).pathname;
  if (checks.skipped.includes(page)) continue;
  const html=fs.readFileSync(path.join('.'+page,'index.html'),'utf8');
  for (const [name,re] of Object.entries({openGraph:/property=["']og:title["']/i,footer:/<footer(?:\s|>)/i,analytics:/src=["']\/assets\/analytics\.js["']/i,schema:/application\/ld\+json/i})) {
    if (!re.test(html)) throw Error('Audit failed '+name+' at '+page);
  }
  if (/<nav\b/i.test(html) && !/class=["'][^"']*mobile-menu-toggle/i.test(html)) throw Error('Missing menu at '+page);
}
console.log(JSON.stringify({counts:checks,changed},null,2));
