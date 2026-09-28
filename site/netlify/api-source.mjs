import { getStore } from "@netlify/blobs";

const DEFAULT_MAPS = "https://maps.app.goo.gl/qZxyPVoW5e4ZdFVg8?g_st=ic";

function staffPassword() {
  try {
    if (globalThis.Netlify && Netlify.env) {
      const value = Netlify.env.get("ADMIN_PASSWORD");
      if (value) return value;
    }
  } catch (error) {
    /* env helper is optional */
  }
  return process.env.ADMIN_PASSWORD || "";
}

function env(name) {
  try {
    if (globalThis.Netlify && Netlify.env) {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (error) {
    /* optional */
  }
  return process.env[name] || "";
}

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function cleanText(value, limit) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, limit);
}

function cleanPrice(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function cleanId(value, fallback) {
  const raw = String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  return raw || fallback;
}

function cleanImage(value) {
  const text = String(value || "").trim();
  if (/^photos\/[A-Za-z0-9._-]{1,80}$/.test(text)) return text;
  if (/^\/api\/photo\?id=[a-z0-9-]{1,60}$/.test(text)) return text;
  return "";
}

function cleanFoodImages(item) {
  const raw = Array.isArray(item && item.images) && item.images.length
    ? item.images
    : (item && item.image ? [item.image] : []);
  const out = [];
  const seen = Object.create(null);
  raw.forEach(function (value) {
    const cleaned = cleanImage(value);
    if (!cleaned || seen[cleaned] || out.length >= 3) return;
    seen[cleaned] = true;
    out.push(cleaned);
  });
  return out;
}

function cleanLines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 12).map(function (row) {
    const name = cleanText(row && row.name, 40);
    const price = cleanPrice(row && row.price);
    return name && price ? { name: name, price: price } : null;
  }).filter(Boolean);
}

function uniqueIds(items) {
  const seen = new Set();
  items.forEach(function (item) {
    if (!item.id) return;
    const base = item.id;
    let number = 2;
    while (seen.has(item.id)) {
      item.id = (base.slice(0, 36) + "-" + number).slice(0, 40);
      number += 1;
    }
    seen.add(item.id);
  });
}

function cleanMenu(body) {
  if (!body || !Array.isArray(body.food) || !Array.isArray(body.drinks)) {
    throw new Error("The menu could not be read.");
  }
  if (body.food.length > 80 || body.drinks.length > 40) throw new Error("That is too many items.");
  const food = body.food.map(function (item) {
    const name = cleanText(item && item.name, 80);
    if (!name) throw new Error("Each food needs a name and a price.");
    const images = cleanFoodImages(item);
    const cleaned = {
      category: ["Meats", "Dishes", "Fasting"].indexOf(item.category) >= 0 ? item.category : "Dishes",
      id: cleanId(item.id, "item"),
      name: name,
      am: cleanText(item.am, 80),
      image: images[0] || "",
      available: item.available !== false
    };
    if (images.length) cleaned.images = images;
    if (item.feature === true) cleaned.feature = true;
    if (item.share === true) cleaned.share = true;
    if (Array.isArray(item.sizes) && item.sizes.length) {
      const sizes = cleanLines(item.sizes);
      if (!sizes.length) throw new Error(name + " needs a price.");
      cleaned.sizes = sizes;
    } else {
      const price = cleanPrice(item.price);
      if (!price) throw new Error(name + " needs a price.");
      cleaned.price = price;
    }
    return cleaned;
  });
  const drinks = body.drinks.map(function (item) {
    const name = cleanText(item && item.name, 80);
    if (!name) throw new Error("Each drink needs a name and a price.");
    const category = ["Spirits", "Soft drinks"].indexOf(item.category) >= 0 ? item.category : "Spirits";
    const key = Array.isArray(item.rows) ? "rows" : "sizes";
    const lines = cleanLines(item[key]);
    if (!lines.length) throw new Error(name + " needs a price.");
    const cleaned = { category: category, name: name };
    cleaned[key] = lines;
    if (item.id) cleaned.id = cleanId(item.id, "drink");
    return cleaned;
  });
  const infoIn = body.info || {};
  const phones = (Array.isArray(infoIn.phones) ? infoIn.phones : []).slice(0, 2).map(function (phone) {
    return cleanText(phone, 24);
  }).filter(Boolean);
  if (!phones.length) throw new Error("Add a phone number.");
  let maps = String(infoIn.maps || "");
  if (!maps.startsWith("https://") || maps.length > 300) maps = DEFAULT_MAPS;
  let tiktok = cleanText(infoIn.tiktok || "@sheger_kurt", 40);
  if (tiktok && tiktok.charAt(0) !== "@") tiktok = "@" + tiktok;
  const address = cleanText(infoIn.address, 180);
  if (!address) throw new Error("Add the address.");
  uniqueIds(food);
  uniqueIds(drinks);
  const fee = cleanPrice(infoIn.deliveryFee != null ? infoIn.deliveryFee : "100") || "100";
  return {
    info: { address: address, maps: maps, phones: phones, tiktok: tiktok || "@sheger_kurt", deliveryFee: fee },
    food: food,
    drinks: drinks,
    home: cleanHome(body.home)
  };
}

function cleanHomeSrc(value) {
  const text = String(value || "").trim();
  if (/^\/api\/home-media\?id=[a-z0-9-]{1,60}$/.test(text)) return text;
  if (/^home-media\/[A-Za-z0-9._-]{1,80}$/.test(text)) return text;
  return "";
}

function cleanHome(home) {
  const rows = home && Array.isArray(home.media) ? home.media : [];
  const media = rows.slice(0, 24).map(function (row) {
    const id = cleanId(row && row.id, "");
    const type = row && row.type === "video" ? "video" : "photo";
    const src = cleanHomeSrc(row && row.src);
    if (!id || !src) return null;
    return {
      id: id,
      type: type,
      src: src,
      caption: cleanText(row && row.caption, 80)
    };
  }).filter(Boolean);
  return { media: media };
}

function mediaTypeFromBytes(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { type: "photo", contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: "photo", contentType: "image/png" };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { type: "video", contentType: "video/webm" };
  }
  // ISO BMFF: ....ftyp????  (mp4 / mov / m4v)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { type: "video", contentType: "video/mp4" };
  }
  return null;
}

function serveBinary(req, bytes, contentType) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const total = view.byteLength;
  const headers = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  };
  const range = req.headers.get("range") || req.headers.get("Range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(String(range).trim());
    if (match) {
      let start = match[1] === "" ? 0 : Number(match[1]);
      let end = match[2] === "" ? total - 1 : Number(match[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + total, "Accept-Ranges": "bytes" }
        });
      }
      if (end >= total) end = total - 1;
      const slice = view.subarray(start, end + 1);
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + total;
      headers["Content-Length"] = String(slice.byteLength);
      return new Response(slice, { status: 206, headers: headers });
    }
  }
  headers["Content-Length"] = String(total);
  return new Response(view, { status: 200, headers: headers });
}

function authorized(req) {
  const expected = staffPassword();
  if (!expected) return "missing";
  const header = req.headers.get("authorization") || "";
  const token = header.indexOf("Bearer ") === 0 ? header.slice(7) : "";
  return same(token, expected) ? "ok" : "no";
}

function homeMediaExt(contentType, type) {
  if (contentType === "video/webm") return ".webm";
  if (contentType === "image/png") return ".png";
  if (contentType === "video/mp4" || type === "video") return ".mp4";
  return ".jpg";
}

function staticHomeSrc(id, type, contentType) {
  return "home-media/" + id + homeMediaExt(contentType, type);
}

function rewriteHomeMediaSrc(src, type) {
  const text = String(src || "");
  const match = text.match(/^\/api\/home-media\?id=([a-z0-9-]+)$/i);
  if (!match) return text;
  return staticHomeSrc(match[1], type === "video" ? "video" : "photo");
}

function rewritePhotoSrc(value) {
  const match = String(value || "").match(/^\/api\/photo\?id=([a-z0-9-]+)$/i);
  return match ? "photos/" + match[1] + ".jpg" : value;
}

function menuForGitHub(menu) {
  const copy = JSON.parse(JSON.stringify(menu));
  (copy.food || []).forEach(function (item) {
    item.image = rewritePhotoSrc(item.image);
    if (Array.isArray(item.images)) {
      item.images = item.images.map(rewritePhotoSrc).filter(Boolean).slice(0, 3);
      if (item.images.length) item.image = item.images[0];
      else delete item.images;
    }
  });
  if (copy.home && Array.isArray(copy.home.media)) {
    copy.home.media.forEach(function (item) {
      item.src = rewriteHomeMediaSrc(item.src, item.type);
    });
  }
  return copy;
}

function githubConfig() {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO") || "Misge1st/sheger-lounge";
  const branch = env("GITHUB_BRANCH") || "main";
  if (!token) return null;
  return { token: token, repo: repo, branch: branch };
}

function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

async function githubGetSha(cfg, path) {
  const res = await fetch(
    "https://api.github.com/repos/" + cfg.repo + "/contents/" + path + "?ref=" + encodeURIComponent(cfg.branch),
    {
      headers: {
        Authorization: "Bearer " + cfg.token,
        Accept: "application/vnd.github+json",
        "User-Agent": "sheger-lounge"
      }
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error("GitHub read failed (" + res.status + "): " + text.slice(0, 160));
  }
  const data = await res.json();
  return data.sha || null;
}

async function githubPutFile(cfg, path, contentBase64, message) {
  const sha = await githubGetSha(cfg, path);
  const body = {
    message: message,
    content: contentBase64,
    branch: cfg.branch
  };
  if (sha) body.sha = sha;
  const res = await fetch("https://api.github.com/repos/" + cfg.repo + "/contents/" + path, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "sheger-lounge"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("GitHub write failed (" + res.status + "): " + text.slice(0, 160));
  }
  return true;
}

async function syncMenuToGitHub(menu) {
  const cfg = githubConfig();
  if (!cfg) return { ok: false, skipped: true };
  const text = JSON.stringify(menuForGitHub(menu), null, 2) + "\n";
  const encoded = typeof Buffer !== "undefined"
    ? Buffer.from(text, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(text)));
  await githubPutFile(cfg, "site/data/menu.json", encoded, "Update menu from Sheger Lounge staff");
  return { ok: true };
}

async function syncPhotoToGitHub(photoId, bytes) {
  const cfg = githubConfig();
  if (!cfg) return { ok: false, skipped: true };
  const path = "site/photos/" + photoId + ".jpg";
  await githubPutFile(cfg, path, toBase64(bytes), "Update photo " + photoId + " from staff");
  return { ok: true };
}

async function syncHomeMediaToGitHub(mediaId, bytes, ext) {
  const cfg = githubConfig();
  if (!cfg) return { ok: false, skipped: true };
  const path = "site/home-media/" + mediaId + ext;
  await githubPutFile(cfg, path, toBase64(bytes), "Update home media " + mediaId + " from staff");
  return { ok: true };
}

async function loadOrders(store) {
  const data = await store.get("orders", { type: "json" });
  if (!data || !Array.isArray(data.orders)) return { nextId: 1001, orders: [] };
  return { nextId: Number(data.nextId) || 1001, orders: data.orders };
}

function cleanOrder(body, deliveryFee) {
  if (!body || !Array.isArray(body.items) || !body.items.length) throw new Error("Add food to your order.");
  if (body.items.length > 40) throw new Error("That order is too large.");
  const items = body.items.map(function (row) {
    const name = cleanText(row && row.name, 80);
    const size = cleanText(row && row.size, 40);
    const qty = Math.min(99, Math.max(1, Number(row && row.qty) || 0));
    const unit = Number(String(row && row.price || "").replace(/\D/g, ""));
    if (!name || !qty || !unit) throw new Error("Each item needs a name, amount, and price.");
    return {
      key: cleanText(row.key, 80) || cleanId(name + "-" + size, "item"),
      name: name,
      size: size,
      qty: qty,
      price: unit
    };
  });
  const foodTotal = items.reduce(function (sum, row) { return sum + row.price * row.qty; }, 0);
  const fee = Number(String(deliveryFee || "100").replace(/\D/g, "")) || 100;
  const customer = body.customer || {};
  const name = cleanText(customer.name, 80);
  const phone = cleanText(customer.phone, 24);
  const city = cleanText(customer.city, 60);
  const area = cleanText(customer.area, 80);
  const address = cleanText(customer.address, 200);
  const note = cleanText(customer.note, 300);
  if (!name) throw new Error("Add your full name.");
  if (!phone || phone.replace(/\D/g, "").length < 9) throw new Error("Add a phone number.");
  if (!city) throw new Error("Add your city.");
  if (!area) throw new Error("Add your area / sub-city.");
  if (!address) throw new Error("Add the delivery address.");
  const payment = ["cash", "mobile", "other"].indexOf(body.payment) >= 0 ? body.payment : "cash";
  const map = body.map || {};
  const lat = Number(map.lat);
  const lng = Number(map.lng);
  let mapUrl = cleanText(map.url, 300);
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && !mapUrl) {
    throw new Error("Allow your current location.");
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && !mapUrl) {
    mapUrl = "https://www.google.com/maps?q=" + lat + "," + lng;
  }
  return {
    items: items,
    foodTotal: foodTotal,
    deliveryFee: fee,
    total: foodTotal + fee,
    customer: { name: name, phone: phone, city: city, area: area, address: address, note: note },
    map: {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      url: mapUrl
    },
    payment: payment
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const store = getStore("sheger-menu");

  if (path.endsWith("/login") && req.method === "POST") {
    const expected = staffPassword();
    if (!expected) return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    const body = await req.json().catch(function () { return {}; });
    if (!same(String(body.password || ""), expected)) return json({ error: "That password is not right." }, 401);
    return json({ ok: true });
  }

  if (path.endsWith("/menu") && req.method === "GET") {
    const menu = await store.get("menu", { type: "json" });
    if (!menu) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    // Phone browsers need static CDN URLs for video (Netlify Functions strip Content-Length).
    if (menu.home && Array.isArray(menu.home.media)) {
      menu.home.media = menu.home.media.map(function (row) {
        if (!row) return row;
        return Object.assign({}, row, { src: rewriteHomeMediaSrc(row.src, row.type) });
      });
    }
    return json(menu);
  }

  if (path.endsWith("/menu") && req.method === "PUT") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    let body;
    try {
      body = cleanMenu(await req.json());
    } catch (error) {
      return json({ error: error.message || "The menu could not be read." }, 400);
    }
    await store.setJSON("menu", body);
    let github = { ok: false, skipped: true };
    try {
      github = await syncMenuToGitHub(body);
    } catch (error) {
      github = { ok: false, error: error.message || "GitHub sync failed." };
    }
    return json({ ok: true, github: github });
  }

  if (path.endsWith("/photo") && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,60}$/.test(id)) return new Response(null, { status: 404 });
    const bytes = await store.get("photo:" + id, { type: "arrayBuffer" });
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  }

  if (path.endsWith("/photo") && req.method === "POST") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return json({ error: "Choose the dish again, then add the photo." }, 400);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length < 100 || bytes.length > 1200000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return json({ error: "Use a photo from the phone." }, 400);
    }
    const stamp = Date.now().toString();
    const stored = (id + "-" + stamp).slice(0, 60);
    await store.set("photo:" + stored, bytes);
    let github = { ok: false, skipped: true };
    try {
      github = await syncPhotoToGitHub(stored, bytes);
    } catch (error) {
      github = { ok: false, error: error.message || "GitHub photo sync failed." };
    }
    return json({ image: "/api/photo?id=" + stored, github: github });
  }

  if ((/\/home-media\/?$/.test(path) || path.indexOf("/home-media") >= 0) && (req.method === "GET" || req.method === "HEAD")) {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9-]{1,60}$/.test(id)) return new Response(null, { status: 404 });
    const bytes = await store.get("home:" + id, { type: "arrayBuffer" });
    if (!bytes) return new Response(null, { status: 404 });
    const view = new Uint8Array(bytes);
    const kind = mediaTypeFromBytes(view) || { type: "photo", contentType: "application/octet-stream" };
    if (req.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": kind.contentType,
          "Content-Length": String(view.byteLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    return serveBinary(req, view, kind.contentType);
  }

  if ((/\/home-media\/?$/.test(path) || path.indexOf("/home-media") >= 0) && req.method === "POST") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const want = url.searchParams.get("type") === "video" ? "video" : "photo";
    const bytes = new Uint8Array(await req.arrayBuffer());
    const max = want === "video" ? 4500000 : 1200000;
    if (bytes.length < 100 || bytes.length > max) {
      return json({
        error: want === "video"
          ? "Use a short video under about 4 MB."
          : "Use a photo from the phone."
      }, 400);
    }
    const kind = mediaTypeFromBytes(bytes);
    if (!kind || kind.type !== want) {
      return json({
        error: want === "video" ? "Use an MP4 or WebM video." : "Use a photo from the phone."
      }, 400);
    }
    const stored = ("hm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7)).slice(0, 60);
    const ext = homeMediaExt(kind.contentType, kind.type);
    await store.set("home:" + stored, bytes);
    let github = { ok: false, skipped: true };
    try {
      github = await syncHomeMediaToGitHub(stored, bytes, ext);
    } catch (error) {
      github = { ok: false, error: error.message || "GitHub home media sync failed." };
    }
    return json({
      id: stored,
      type: kind.type,
      src: staticHomeSrc(stored, kind.type, kind.contentType),
      github: github
    });
  }

  if (path.endsWith("/orders/count") && req.method === "GET") {
    const data = await loadOrders(store);
    const pending = data.orders.filter(function (order) {
      return order.status === "new" || order.status === "accepted";
    }).length;
    return json({ pending: pending });
  }

  if (path.endsWith("/orders") && req.method === "GET") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const data = await loadOrders(store);
    return json({ orders: data.orders.slice(0, 120) });
  }

  if (path.endsWith("/orders") && req.method === "POST") {
    let payload;
    try {
      const body = await req.json();
      const menu = await store.get("menu", { type: "json" });
      const fee = menu && menu.info ? menu.info.deliveryFee : "100";
      payload = cleanOrder(body, fee);
    } catch (error) {
      return json({ error: error.message || "The order could not be placed." }, 400);
    }
    const data = await loadOrders(store);
    const order = Object.assign({
      id: data.nextId,
      status: "new",
      createdAt: new Date().toISOString()
    }, payload);
    data.nextId += 1;
    data.orders.unshift(order);
    if (data.orders.length > 300) data.orders.length = 300;
    await store.setJSON("orders", data);
    return json({ ok: true, id: order.id });
  }

  if (path.endsWith("/orders") && req.method === "PATCH") {
    const gate = authorized(req);
    if (gate === "missing") return json({ error: "Set ADMIN_PASSWORD in the Netlify site settings, then publish again." }, 503);
    if (gate !== "ok") return json({ error: "That password is not right." }, 401);
    const body = await req.json().catch(function () { return {}; });
    const id = Number(body.id);
    const status = body.status;
    if (!id || ["new", "accepted", "done", "cancelled"].indexOf(status) < 0) {
      return json({ error: "Choose an order status." }, 400);
    }
    const data = await loadOrders(store);
    const order = data.orders.find(function (row) { return row.id === id; });
    if (!order) return json({ error: "That order was not found." }, 404);
    order.status = status;
    await store.setJSON("orders", data);
    return json({ ok: true, order: order });
  }

  return json({ error: "Not found." }, 404);
}
