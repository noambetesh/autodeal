import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data', 'db.json');
const SETTINGS = path.join(ROOT, 'data', 'settings.json');
const PORT = Number(process.env.PORT || 8787);
const origin = process.env.ALLOWED_ORIGIN || '*';

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
};
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};
const load = () => readJson(DATA, {listings: [], searches: [], history: [], pricebook: []});
const save = db => writeJson(DATA, db);
const loadSettings = () => {
  const local = readJson(SETTINGS, {});
  return {
    ...local,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || local.telegramBotToken || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || local.telegramChatId || '',
    leviApiUrl: process.env.LEVI_API_URL || local.leviApiUrl || '',
    leviApiKey: process.env.LEVI_API_KEY || local.leviApiKey || ''
  };
};
const publicSettings = () => {
  const s = loadSettings();
  return {
    telegramConfigured: !!(s.telegramBotToken && s.telegramChatId),
    leviAuthorizedApiConfigured: !!(s.leviApiUrl && s.leviApiKey),
    yad2PublicImport: true
  };
};

function json(res, code, data) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}
const asNumber = value => Number(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;
const median = values => {
  const sorted = values.filter(Number.isFinite).filter(Boolean).sort((a,b) => a-b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const first = (...values) => values.find(v => v !== undefined && v !== null && v !== '') ?? '';
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    if (!(key in obj)) continue;
    const value = obj[key];
    if (value && typeof value === 'object') {
      const nested = first(value.id, value.value, value.name, value.url, value.src);
      if (nested !== '') return nested;
    } else if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}
function imageFrom(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFrom(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    return imageFrom(first(value.url, value.src, value.imageUrl, value.image_url, value.original, value.large, value.medium, value.thumbnail));
  }
  return '';
}
function absoluteUrl(value, base = 'https://www.yad2.co.il') {
  if (!value) return '';
  try { return new URL(String(value), base).toString(); }
  catch { return ''; }
}
function collectObjects(value, out, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 12) return;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out, depth + 1);
    return;
  }
  out.push(value);
  for (const child of Object.values(value)) collectObjects(child, out, depth + 1);
}

function normalize(raw = {}, sourceBase = 'https://www.yad2.co.il') {
  const brandObj = first(raw.brand, raw.manufacturer, raw.make);
  const make = typeof brandObj === 'object'
    ? text(first(brandObj.name, brandObj.label, brandObj.title))
    : text(first(raw.make, raw.manufacturer_name, raw.manufacturerName, raw.brand_name, raw.brandName, raw.manufacturer, raw.brand));
  const modelObj = first(raw.model, raw.modelInfo);
  const model = typeof modelObj === 'object'
    ? text(first(modelObj.name, modelObj.label, modelObj.title))
    : text(first(raw.model, raw.model_name, raw.modelName, raw.vehicleModel));
  const title = text(first(raw.title, raw.name, raw.vehicleTitle));
  const imageValue = first(raw.imageUrl, raw.image_url, raw.image, raw.images, raw.photos, raw.pictures, raw.mainImage, raw.coverImage, raw.thumbnail);
  const sourceUrl = absoluteUrl(first(raw.sourceUrl, raw.url, raw.link, raw.itemUrl, raw.canonicalUrl), sourceBase);
  const id = text(first(raw.id, raw.itemId, raw.adNumber, raw.token, raw.uuid, raw.sku, raw.productID, sourceUrl || `ad-${Date.now()}-${Math.random().toString(36).slice(2,8)}`));
  const manufacturerId = text(first(raw.manufacturerId, raw.manufacturer_id, raw.manufacturerID, raw.brandId, raw.brand_id, typeof raw.manufacturer === 'object' ? raw.manufacturer.id : ''));
  const modelId = text(first(raw.modelId, raw.model_id, raw.modelID, typeof raw.model === 'object' ? raw.model.id : ''));
  return {
    id,
    make: make || title.split(/\s+/)[0] || '',
    model: model || title.split(/\s+/).slice(1, 3).join(' ') || '',
    trim: text(first(raw.trim, raw.subModel, raw.sub_model, raw.version, raw.level, raw.subTitle)),
    year: asNumber(first(raw.year, raw.modelYear, raw.year_on_road, raw.productionYear)),
    price: asNumber(first(raw.price, raw.priceValue, raw.amount, raw.offers?.price)),
    mileage: asNumber(first(raw.mileage, raw.kilometers, raw.km, raw.odometer)),
    hand: asNumber(first(raw.hand, raw.ownerNumber, raw.owners, raw.owner_count)),
    location: text(first(raw.location, raw.city, raw.area, raw.address?.addressLocality)),
    seller: text(first(raw.seller, raw.sellerType, raw.ownerType, 'מוכר פרטי')),
    fuel: text(first(raw.fuel, raw.fuelType, raw.engineType)),
    status: text(first(raw.status, 'חדש')),
    sourceUrl,
    imageUrl: absoluteUrl(imageFrom(imageValue), sourceBase),
    published: text(first(raw.published, raw.createdAt, raw.date, 'עכשיו')),
    manufacturerId,
    modelId
  };
}

function marketMedian(db, listing) {
  return median(db.listings
    .filter(x => String(x.make).toLowerCase() === String(listing.make).toLowerCase())
    .filter(x => String(x.model).toLowerCase() === String(listing.model).toLowerCase())
    .filter(x => !listing.year || !x.year || Math.abs((+x.year || 0) - (+listing.year || 0)) <= 1)
    .map(x => +x.price));
}
function score(listing) {
  const ref = +listing.leviPrice || +listing.yad2Price || +listing.referencePrice || +listing.marketMedian || 0;
  if (!ref || !listing.price) return 60;
  const diff = (ref - listing.price) / ref;
  return Math.max(0, Math.min(100, Math.round(72 + diff * 180 - (+listing.mileage || 0) / 12000 + (+listing.year - 2020) * 1.5)));
}

async function fetchLeviPrice(listing) {
  const s = loadSettings();
  if (!s.leviApiUrl || !s.leviApiKey) return {price: 0, source: ''};
  try {
    const response = await fetch(s.leviApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${s.leviApiKey}`,
        'x-api-key': s.leviApiKey
      },
      body: JSON.stringify({
        make: listing.make,
        model: listing.model,
        trim: listing.trim,
        year: listing.year,
        mileage: listing.mileage,
        hand: listing.hand
      })
    });
    if (!response.ok) return {price: 0, source: ''};
    const data = await response.json();
    return {price: asNumber(first(data.referencePrice, data.price, data.value)), source: 'לוי יצחק - API מורשה'};
  } catch {
    return {price: 0, source: ''};
  }
}

async function fetchYad2Price(listing) {
  if (!listing.manufacturerId || !listing.modelId || !listing.year) return {price: 0, min: 0, max: 0, sourceUrl: ''};
  const url = `https://www.yad2.co.il/price-list/feed?manufacturer=${encodeURIComponent(listing.manufacturerId)}&model=${encodeURIComponent(listing.modelId)}&min-year=${listing.year}&max-year=${listing.year}`;
  try {
    const response = await fetch(url, {headers: {'user-agent': 'Mozilla/5.0 AutoDeal/2.0', 'accept-language': 'he-IL,he;q=0.9'}});
    if (!response.ok) return {price: 0, min: 0, max: 0, sourceUrl: url};
    const html = await response.text();
    const prices = [...html.matchAll(/(?:₪|&#8362;|\u20aa)\s*([0-9]{1,3}(?:,[0-9]{3})+)/gi)]
      .map(match => asNumber(match[1]))
      .filter(p => p >= 1000 && p <= 5000000);
    if (!prices.length) return {price: 0, min: 0, max: 0, sourceUrl: url};
    const unique = [...new Set(prices)].sort((a,b) => a-b);
    return {price: median(unique), min: unique[0], max: unique[unique.length - 1], sourceUrl: url};
  } catch {
    return {price: 0, min: 0, max: 0, sourceUrl: url};
  }
}

async function enrichPrices(db, listing) {
  const levi = await fetchLeviPrice(listing);
  const yad2 = await fetchYad2Price(listing);
  const manual = db.pricebook.find(x =>
    String(x.make).toLowerCase() === String(listing.make).toLowerCase() &&
    String(x.model).toLowerCase() === String(listing.model).toLowerCase() &&
    +x.year === +listing.year
  );
  listing.leviPrice = levi.price || (manual?.source === 'לוי יצחק' ? +manual.referencePrice : 0);
  listing.leviSource = listing.leviPrice ? (levi.source || 'לוי יצחק - הוזן ידנית') : '';
  listing.yad2Price = yad2.price || 0;
  listing.yad2PriceMin = yad2.min || 0;
  listing.yad2PriceMax = yad2.max || 0;
  listing.yad2PriceUrl = yad2.sourceUrl || '';
  listing.marketMedian = marketMedian(db, listing);
  listing.referencePrice = listing.leviPrice || listing.yad2Price || (manual ? +manual.referencePrice : 0) || listing.marketMedian || 0;
  listing.referenceSource = listing.leviPrice ? listing.leviSource : listing.yad2Price ? 'מחירון יד2' : manual ? (manual.source || 'מחירון שהוזן ידנית') : listing.marketMedian ? 'חציון שוק' : '';
  listing.score = score(listing);
  return listing;
}

async function telegram(message) {
  const s = loadSettings();
  if (!s.telegramBotToken || !s.telegramChatId) return {ok: false, error: 'not_configured'};
  try {
    const response = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({chat_id: s.telegramChatId, text: message, disable_web_page_preview: false})
    });
    const data = await response.json();
    return {ok: !!data.ok, error: data.description || ''};
  } catch (error) {
    return {ok: false, error: error.message};
  }
}
async function discoverChat(token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await response.json();
  const msg = [...(data.result || [])].reverse().find(x => x.message?.chat?.id || x.channel_post?.chat?.id);
  return msg ? {ok: true, chatId: String(msg.message?.chat?.id || msg.channel_post?.chat?.id)} : {ok: false, error: 'no_chat_found'};
}

function parseJsonScripts(html) {
  const values = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(match[1])); } catch {}
  }
  for (const match of html.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(match[1])); } catch {}
  }
  return values;
}
function likelyListing(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const hasPrice = asNumber(first(obj.price, obj.priceValue, obj.amount, obj.offers?.price)) > 0;
  const hasIdentity = !!first(obj.id, obj.itemId, obj.adNumber, obj.token, obj.url, obj.link, obj.title, obj.name);
  const hasVehicleData = !!first(obj.model, obj.modelName, obj.manufacturer, obj.make, obj.brand, obj.year, obj.mileage);
  return hasPrice && hasIdentity && hasVehicleData;
}
async function fetchYad2(url) {
  const parsed = new URL(url);
  if (!/(^|\.)yad2\.co\.il$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/vehicles/')) throw Error('not_yad2_url');
  const response = await fetch(parsed, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Safari/537.36 AutoDeal/2.0',
      'accept-language': 'he-IL,he;q=0.9,en;q=0.5',
      'accept': 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });
  if (!response.ok) throw Error(`yad2_http_${response.status}`);
  const html = await response.text();
  if (/captcha|verify you are human|access denied|robot check/i.test(html)) throw Error('yad2_blocked');
  const objects = [];
  for (const value of parseJsonScripts(html)) collectObjects(value, objects);
  const listings = [];
  const seen = new Set();
  for (const obj of objects) {
    if (!likelyListing(obj)) continue;
    const listing = normalize(obj, parsed.toString());
    if (!listing.price || (!listing.make && !listing.model)) continue;
    const key = listing.sourceUrl || listing.id;
    if (seen.has(key)) continue;
    seen.add(key);
    listings.push(listing);
  }
  return listings;
}

async function importListings(items, notify = true) {
  const db = load();
  let created = 0, updated = 0, dropped = 0;
  for (const raw of items || []) {
    const listing = await enrichPrices(db, normalize(raw, raw.sourceUrl || 'https://www.yad2.co.il'));
    const old = db.listings.find(x => x.id === listing.id || (listing.sourceUrl && x.sourceUrl === listing.sourceUrl));
    if (old) {
      if (listing.price && old.price && listing.price < old.price) {
        db.history.push({car: `${listing.make} ${listing.model}`, oldPrice: old.price, newPrice: listing.price, date: new Date().toISOString()});
        dropped++;
        if (notify) await telegram(`ירידת מחיר 🚗\n${listing.make} ${listing.model}\n${old.price.toLocaleString('he-IL')} ₪ ← ${listing.price.toLocaleString('he-IL')} ₪\n${listing.sourceUrl}`);
      }
      Object.assign(old, listing);
      updated++;
    } else {
      db.listings.unshift(listing);
      created++;
      if (notify) await telegram(`נמצאה מודעה חדשה 🚗\n${listing.make} ${listing.model} ${listing.year}\nמחיר: ${listing.price.toLocaleString('he-IL')} ₪\n${listing.sourceUrl}`);
    }
  }
  save(db);
  return {created, updated, dropped, total: db.listings.length};
}
function matches(listing, search) {
  return (!search.make || listing.make.toLowerCase().includes(String(search.make).toLowerCase())) &&
    (!search.model || listing.model.toLowerCase().includes(String(search.model).toLowerCase())) &&
    (!search.maxPrice || listing.price <= search.maxPrice) &&
    (!search.maxMileage || !listing.mileage || listing.mileage <= search.maxMileage) &&
    (!search.yearMin || listing.year >= search.yearMin) &&
    (!search.yearMax || listing.year <= search.yearMax);
}
async function runSearch(search, notify = true) {
  let fetched = 0;
  let providerError = '';
  if (search.sourceUrl) {
    try {
      const list = await fetchYad2(search.sourceUrl);
      fetched = list.length;
      if (list.length) await importListings(list, notify);
    } catch (error) {
      providerError = error.message;
    }
  }
  return {listings: load().listings.filter(item => matches(item, search)), fetched, providerError};
}
async function poll() {
  const db = load();
  for (const search of db.searches.filter(x => x.active !== false)) {
    try {
      await runSearch(search, true);
      search.lastRun = new Date().toISOString();
      search.lastError = '';
    } catch (error) {
      search.lastError = error.message;
    }
  }
  save(db);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok: true, service: 'AutoDeal Server v2'});
    if (req.method === 'GET' && url.pathname === '/api/integrations/status') return json(res, 200, publicSettings());
    if (req.method === 'GET' && url.pathname === '/api/listings') return json(res, 200, {listings: load().listings});
    if (req.method === 'GET' && url.pathname === '/api/history') return json(res, 200, {history: load().history});
    if (req.method === 'GET' && url.pathname === '/api/searches') return json(res, 200, {searches: load().searches});

    if (req.method === 'POST' && url.pathname === '/api/integrations/telegram') {
      const payload = await body(req), s = loadSettings();
      s.telegramBotToken = String(payload.botToken || s.telegramBotToken || '');
      s.telegramChatId = String(payload.chatId || s.telegramChatId || '');
      writeJson(SETTINGS, s);
      return json(res, 200, {ok: true, ...publicSettings()});
    }
    if (req.method === 'POST' && url.pathname === '/api/integrations/telegram/discover-chat') {
      const payload = await body(req);
      const result = await discoverChat(String(payload.botToken || ''));
      if (result.ok) {
        const s = loadSettings();
        s.telegramBotToken = payload.botToken;
        s.telegramChatId = result.chatId;
        writeJson(SETTINGS, s);
      }
      return json(res, result.ok ? 200 : 400, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/integrations/levi') {
      const payload = await body(req), s = loadSettings();
      s.leviApiUrl = String(payload.apiUrl || '');
      s.leviApiKey = String(payload.apiKey || '');
      writeJson(SETTINGS, s);
      return json(res, 200, {ok: true, ...publicSettings()});
    }
    if (req.method === 'POST' && url.pathname === '/api/yad2/import') {
      const payload = await body(req);
      const list = await fetchYad2(String(payload.url || ''));
      const result = await importListings(list, payload.notify !== false);
      return json(res, 200, {ok: true, found: list.length, ...result});
    }
    if (req.method === 'POST' && url.pathname === '/api/searches') {
      const payload = await body(req), db = load();
      const search = {...payload, id: String(payload.id || `s-${Date.now()}`), active: payload.active !== false};
      const old = db.searches.find(x => x.id === search.id);
      old ? Object.assign(old, search) : db.searches.push(search);
      save(db);
      return json(res, 200, {ok: true, search});
    }
    if (req.method === 'POST' && url.pathname === '/api/search/run') {
      const payload = await body(req);
      return json(res, 200, {ok: true, ...await runSearch(payload, true)});
    }
    if (req.method === 'POST' && url.pathname === '/api/pricebook/import') {
      const payload = await body(req), db = load();
      for (const raw of payload.items || []) {
        const item = {make: String(raw.make || ''), model: String(raw.model || ''), year: +raw.year, referencePrice: +raw.referencePrice, source: String(raw.source || 'מחירון שהוזן ידנית')};
        const old = db.pricebook.find(x => x.make.toLowerCase() === item.make.toLowerCase() && x.model.toLowerCase() === item.model.toLowerCase() && +x.year === item.year);
        old ? Object.assign(old, item) : db.pricebook.push(item);
      }
      save(db);
      return json(res, 200, {ok: true, count: db.pricebook.length});
    }
    if (req.method === 'POST' && url.pathname === '/api/telegram/test') return json(res, 200, await telegram('AutoDeal מחובר בהצלחה ✅'));
    return json(res, 404, {ok: false, error: 'not_found'});
  } catch (error) {
    return json(res, 400, {ok: false, error: error.message || 'server_error'});
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`AutoDeal v2 listening on 0.0.0.0:${PORT}`));
setInterval(() => poll().catch(console.error), Math.max(5, Number(process.env.POLL_MINUTES || 15)) * 60000);
