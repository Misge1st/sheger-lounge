"""Serve the menu and let staff save menu changes."""
import hmac
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
RATINGS = os.path.join(ROOT, "ratings.json")
MENU_FILE = os.path.join(ROOT, "data", "menu.json")
ORDERS_FILE = os.path.join(ROOT, "data", "orders.json")
PHOTOS = os.path.join(ROOT, "photos")
HOME_MEDIA = os.path.join(ROOT, "home-media")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
DEFAULT_MAPS = "https://maps.app.goo.gl/qZxyPVoW5e4ZdFVg8?g_st=ic"
DEFAULT_FEE = 100
LOCK = threading.Lock()
ID_OK = re.compile(r"^[a-z0-9-]{1,40}$")
PHOTO_ID_OK = re.compile(r"^[a-z0-9-]{1,60}$")
HOME_ID_OK = re.compile(r"^[a-z0-9-]{1,60}$")
DISHES = {
    "kurt", "gas-light", "shekla", "senber", "emis-emis", "ariza", "zumbara",
    "normal-kitfo", "special-kitfo", "scrambled-egg", "dulet", "tibs-firfir",
    "quanta-firfir", "musina", "special-yetsom", "combo", "yefisik",
    "yetsom-combo", "atikilt", "shiro", "gomen-tibs", "tegabino", "beyeaynet",
    "gomen-kitfo", "spring-roll",
}


def clean_text(value, limit):
    return str(value or "").replace("<", "").replace(">", "").strip()[:limit]


def clean_price(value):
    digits = re.sub(r"\D", "", str(value or ""))[:9]
    if not digits:
        return ""
    return "{:,}".format(int(digits))


def clean_id(value, fallback):
    raw = re.sub(r"[^a-z0-9-]", "", str(value or "").lower())[:40]
    return raw or fallback


def clean_image(value):
    text = str(value or "").strip()
    if re.fullmatch(r"photos/[A-Za-z0-9._-]{1,80}", text):
        return text
    if re.fullmatch(r"/api/photo\?id=[a-z0-9-]{1,60}", text):
        return text
    return ""


def clean_lines(rows):
    out = []
    if not isinstance(rows, list):
        return out
    for row in rows[:12]:
        if not isinstance(row, dict):
            continue
        name = clean_text(row.get("name"), 40)
        price = clean_price(row.get("price"))
        if name and price:
            out.append({"name": name, "price": price})
    return out


def unique_ids(items):
    seen = set()
    for item in items:
        if "id" not in item:
            continue
        base = item["id"]
        number = 2
        while item["id"] in seen:
            item["id"] = (base[:36] + "-" + str(number))[:40]
            number += 1
        seen.add(item["id"])


def clean_home_src(value):
    text = str(value or "").strip()
    if re.fullmatch(r"/api/home-media\?id=[a-z0-9-]{1,60}", text):
        return text
    if re.fullmatch(r"home-media/[A-Za-z0-9._-]{1,80}", text):
        return text
    return ""


def clean_home(home):
    rows = home.get("media") if isinstance(home, dict) else None
    if not isinstance(rows, list):
        return {"media": []}
    media = []
    for row in rows[:24]:
        if not isinstance(row, dict):
            continue
        item_id = clean_id(row.get("id"), "")
        src = clean_home_src(row.get("src"))
        if not item_id or not src:
            continue
        media.append({
            "id": item_id,
            "type": "video" if row.get("type") == "video" else "photo",
            "src": src,
            "caption": clean_text(row.get("caption"), 80),
        })
    return {"media": media}


def media_kind(raw):
    if not raw or len(raw) < 12:
        return None
    if raw[:2] == b"\xff\xd8":
        return ("photo", "image/jpeg")
    if raw[:4] == b"\x89PNG":
        return ("photo", "image/png")
    if raw[:4] == b"\x1aE\xdf\xa3":
        return ("video", "video/webm")
    if b"ftyp" in raw[4:12]:
        return ("video", "video/mp4")
    return None


def clean_menu(body):
    if not isinstance(body, dict):
        raise ValueError("The menu could not be read.")
    food_in = body.get("food")
    drinks_in = body.get("drinks")
    if not isinstance(food_in, list) or not isinstance(drinks_in, list):
        raise ValueError("The menu could not be read.")
    if len(food_in) > 80 or len(drinks_in) > 40:
        raise ValueError("That is too many items.")
    food = []
    for item in food_in:
        if not isinstance(item, dict):
            raise ValueError("Each food needs a name and a price.")
        name = clean_text(item.get("name"), 80)
        if not name:
            raise ValueError("Each food needs a name and a price.")
        cleaned = {
            "category": item.get("category") if item.get("category") in ("Meats", "Dishes", "Fasting") else "Dishes",
            "id": clean_id(item.get("id"), "item"),
            "name": name,
            "am": clean_text(item.get("am"), 80),
            "image": clean_image(item.get("image")),
            "available": item.get("available") is not False,
        }
        if item.get("feature") is True:
            cleaned["feature"] = True
        if item.get("share") is True:
            cleaned["share"] = True
        if isinstance(item.get("sizes"), list) and item.get("sizes"):
            sizes = clean_lines(item.get("sizes"))
            if not sizes:
                raise ValueError(name + " needs a price.")
            cleaned["sizes"] = sizes
        else:
            price = clean_price(item.get("price"))
            if not price:
                raise ValueError(name + " needs a price.")
            cleaned["price"] = price
        food.append(cleaned)
    drinks = []
    for item in drinks_in:
        if not isinstance(item, dict):
            raise ValueError("Each drink needs a name and a price.")
        name = clean_text(item.get("name"), 80)
        if not name:
            raise ValueError("Each drink needs a name and a price.")
        category = item.get("category") if item.get("category") in ("Spirits", "Soft drinks") else "Spirits"
        if isinstance(item.get("rows"), list):
            key = "rows"
            source = item.get("rows")
        else:
            key = "sizes"
            source = item.get("sizes")
        lines = clean_lines(source)
        if not lines:
            raise ValueError(name + " needs a price.")
        cleaned = {"category": category, "name": name, key: lines}
        if item.get("id"):
            cleaned["id"] = clean_id(item.get("id"), "drink")
        drinks.append(cleaned)
    info_in = body.get("info") if isinstance(body.get("info"), dict) else {}
    phones = []
    for phone in (info_in.get("phones") or [])[:2]:
        text = clean_text(phone, 24)
        if text:
            phones.append(text)
    if not phones:
        raise ValueError("Add a phone number.")
    maps = str(info_in.get("maps") or "")
    if not maps.startswith("https://") or len(maps) > 300:
        maps = DEFAULT_MAPS
    tiktok = clean_text(info_in.get("tiktok") or "@sheger_kurt", 40)
    if tiktok and not tiktok.startswith("@"):
        tiktok = "@" + tiktok
    address = clean_text(info_in.get("address"), 180)
    if not address:
        raise ValueError("Add the address.")
    unique_ids(food)
    unique_ids(drinks)
    fee = clean_price(info_in.get("deliveryFee") if info_in.get("deliveryFee") is not None else "100") or "100"
    return {
        "info": {
            "address": address,
            "maps": maps,
            "phones": phones,
            "tiktok": tiktok or "@sheger_kurt",
            "deliveryFee": fee,
        },
        "food": food,
        "drinks": drinks,
        "home": clean_home(body.get("home")),
    }


def load_orders():
    if not os.path.exists(ORDERS_FILE):
        return {"nextId": 1001, "orders": []}
    with open(ORDERS_FILE, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("orders"), list):
        return {"nextId": 1001, "orders": []}
    return {"nextId": int(data.get("nextId") or 1001), "orders": data["orders"]}


def money(value):
    digits = re.sub(r"\D", "", str(value or ""))
    return int(digits) if digits else 0


def clean_order(body, delivery_fee):
    if not isinstance(body, dict) or not isinstance(body.get("items"), list) or not body.get("items"):
        raise ValueError("Add food to your order.")
    if len(body["items"]) > 40:
        raise ValueError("That order is too large.")
    items = []
    for row in body["items"]:
        if not isinstance(row, dict):
            raise ValueError("Each item needs a name, amount, and price.")
        name = clean_text(row.get("name"), 80)
        size = clean_text(row.get("size"), 40)
        try:
            qty = int(row.get("qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        qty = max(1, min(99, qty))
        unit = money(row.get("price"))
        if not name or not unit:
            raise ValueError("Each item needs a name, amount, and price.")
        items.append({
            "key": clean_text(row.get("key"), 80) or clean_id(name + "-" + size, "item"),
            "name": name,
            "size": size,
            "qty": qty,
            "price": unit,
        })
    food_total = sum(item["price"] * item["qty"] for item in items)
    fee = money(delivery_fee) or DEFAULT_FEE
    customer = body.get("customer") if isinstance(body.get("customer"), dict) else {}
    name = clean_text(customer.get("name"), 80)
    phone = clean_text(customer.get("phone"), 24)
    city = clean_text(customer.get("city"), 60)
    area = clean_text(customer.get("area"), 80)
    address = clean_text(customer.get("address"), 200)
    note = clean_text(customer.get("note"), 300)
    if not name:
        raise ValueError("Add your full name.")
    if not phone or len(re.sub(r"\D", "", phone)) < 9:
        raise ValueError("Add a phone number.")
    if not city:
        raise ValueError("Add your city.")
    if not area:
        raise ValueError("Add your area / sub-city.")
    if not address:
        raise ValueError("Add the delivery address.")
    payment = body.get("payment") if body.get("payment") in ("cash", "mobile", "other") else "cash"
    map_data = body.get("map") if isinstance(body.get("map"), dict) else {}
    try:
        lat = float(map_data.get("lat"))
    except (TypeError, ValueError):
        lat = None
    try:
        lng = float(map_data.get("lng"))
    except (TypeError, ValueError):
        lng = None
    map_url = clean_text(map_data.get("url"), 300)
    if (lat is None or lng is None) and not map_url:
        raise ValueError("Allow your current location.")
    if lat is not None and lng is not None and not map_url:
        map_url = "https://www.google.com/maps?q=%s,%s" % (lat, lng)
    return {
        "items": items,
        "foodTotal": food_total,
        "deliveryFee": fee,
        "total": food_total + fee,
        "customer": {
            "name": name,
            "phone": phone,
            "city": city,
            "area": area,
            "address": address,
            "note": note,
        },
        "map": {"lat": lat, "lng": lng, "url": map_url},
        "payment": payment,
    }


def load_ratings():
    if not os.path.exists(RATINGS):
        return {}
    with open(RATINGS, encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, dict) else {}


def save_json(path, data):
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read(self, limit):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > limit:
            return None
        return self.rfile.read(length)

    def authorized(self):
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        if not token or not PASSWORD:
            return False
        return hmac.compare_digest(token, PASSWORD)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/ratings":
            self._json(200, load_ratings())
            return
        if path == "/api/menu":
            if not os.path.exists(MENU_FILE):
                self.send_response(204)
                self.end_headers()
                return
            with open(MENU_FILE, encoding="utf-8") as handle:
                self._json(200, json.load(handle))
            return
        if path == "/api/home-media":
            self.serve_home_media()
            return
        if path == "/api/orders/count":
            with LOCK:
                data = load_orders()
            pending = sum(1 for order in data["orders"] if order.get("status") in ("new", "accepted"))
            self._json(200, {"pending": pending})
            return
        if path == "/api/orders":
            if not self.authorized():
                self._json(401, {"error": "That password is not right."})
                return
            with LOCK:
                data = load_orders()
            self._json(200, {"orders": data["orders"][:120]})
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/ratings":
            self.save_rating()
            return
        if path == "/api/login":
            self.login()
            return
        if path == "/api/photo":
            self.save_photo()
            return
        if path == "/api/home-media":
            self.save_home_media()
            return
        if path == "/api/orders":
            self.place_order()
            return
        self.send_error(404)

    def do_PUT(self):
        if urlparse(self.path).path != "/api/menu":
            self.send_error(404)
            return
        if not self.authorized():
            self._json(401, {"error": "That password is not right."})
            return
        raw = self._read(500000)
        if raw is None:
            self._json(413, {"error": "The menu is too large."})
            return
        try:
            menu = clean_menu(json.loads(raw.decode("utf-8")))
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            message = str(error) if isinstance(error, ValueError) else "The menu could not be read."
            self._json(400, {"error": message})
            return
        with LOCK:
            save_json(MENU_FILE, menu)
        self._json(200, {"ok": True})

    def do_PATCH(self):
        if urlparse(self.path).path != "/api/orders":
            self.send_error(404)
            return
        if not self.authorized():
            self._json(401, {"error": "That password is not right."})
            return
        raw = self._read(4000)
        if raw is None:
            self._json(413, {"error": "too large"})
            return
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "bad json"})
            return
        try:
            order_id = int(body.get("id"))
        except (TypeError, ValueError):
            order_id = 0
        status = body.get("status")
        if not order_id or status not in ("new", "accepted", "done", "cancelled"):
            self._json(400, {"error": "Choose an order status."})
            return
        with LOCK:
            data = load_orders()
            order = next((row for row in data["orders"] if row.get("id") == order_id), None)
            if not order:
                self._json(404, {"error": "That order was not found."})
                return
            order["status"] = status
            save_json(ORDERS_FILE, data)
        self._json(200, {"ok": True, "order": order})

    def place_order(self):
        raw = self._read(50000)
        if raw is None:
            self._json(413, {"error": "too large"})
            return
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "The order could not be placed."})
            return
        fee = DEFAULT_FEE
        if os.path.exists(MENU_FILE):
            try:
                with open(MENU_FILE, encoding="utf-8") as handle:
                    menu = json.load(handle)
                fee = (menu.get("info") or {}).get("deliveryFee") or DEFAULT_FEE
            except (OSError, json.JSONDecodeError):
                fee = DEFAULT_FEE
        try:
            payload = clean_order(body, fee)
        except ValueError as error:
            self._json(400, {"error": str(error)})
            return
        with LOCK:
            data = load_orders()
            order = {
                "id": data["nextId"],
                "status": "new",
                "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            order.update(payload)
            data["nextId"] += 1
            data["orders"].insert(0, order)
            data["orders"] = data["orders"][:300]
            save_json(ORDERS_FILE, data)
        self._json(200, {"ok": True, "id": order["id"]})

    def login(self):
        raw = self._read(400)
        if raw is None:
            self._json(413, {"error": "too large"})
            return
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "bad json"})
            return
        token = str(body.get("password", ""))
        if PASSWORD and token and hmac.compare_digest(token, PASSWORD):
            self._json(200, {"ok": True})
            return
        self._json(401, {"error": "That password is not right."})

    def save_photo(self):
        if not self.authorized():
            self._json(401, {"error": "That password is not right."})
            return
        query = parse_qs(urlparse(self.path).query)
        photo_id = (query.get("id") or [""])[0]
        if not ID_OK.match(photo_id):
            self._json(400, {"error": "Choose the dish again, then add the photo."})
            return
        raw = self._read(1200000)
        if not raw or raw[:2] != b"\xff\xd8":
            self._json(400, {"error": "Use a photo from the phone."})
            return
        os.makedirs(PHOTOS, exist_ok=True)
        stamp = str(int(time.time() * 1000))
        filename = photo_id + "-" + stamp + ".jpg"
        path = os.path.join(PHOTOS, filename)
        with LOCK:
            with open(path, "wb") as handle:
                handle.write(raw)
        self._json(200, {"image": "photos/" + filename})

    def serve_home_media(self):
        query = parse_qs(urlparse(self.path).query)
        media_id = (query.get("id") or [""])[0]
        if not HOME_ID_OK.match(media_id):
            self.send_error(404)
            return
        for name in os.listdir(HOME_MEDIA) if os.path.isdir(HOME_MEDIA) else []:
            if name.startswith(media_id + ".") or name == media_id:
                path = os.path.join(HOME_MEDIA, name)
                with open(path, "rb") as handle:
                    raw = handle.read()
                kind = media_kind(raw) or ("photo", "application/octet-stream")
                self.send_response(200)
                self.send_header("Content-Type", kind[1])
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return
        self.send_error(404)

    def save_home_media(self):
        if not self.authorized():
            self._json(401, {"error": "That password is not right."})
            return
        query = parse_qs(urlparse(self.path).query)
        want = "video" if (query.get("type") or [""])[0] == "video" else "photo"
        limit = 8000000 if want == "video" else 1200000
        raw = self._read(limit)
        kind = media_kind(raw) if raw else None
        if not kind or kind[0] != want:
            self._json(400, {
                "error": "Use an MP4 or WebM video." if want == "video" else "Use a photo from the phone."
            })
            return
        if want == "video" and len(raw) > 8000000:
            self._json(400, {"error": "Use a short video under about 8 MB."})
            return
        os.makedirs(HOME_MEDIA, exist_ok=True)
        ext = ".mp4" if kind[1] == "video/mp4" else ".webm" if kind[1] == "video/webm" else ".jpg"
        if kind[1] == "image/png":
            ext = ".png"
        media_id = ("hm-" + format(int(time.time() * 1000), "x"))[:60]
        filename = media_id + ext
        path = os.path.join(HOME_MEDIA, filename)
        with LOCK:
            with open(path, "wb") as handle:
                handle.write(raw)
        self._json(200, {
            "id": media_id,
            "type": kind[0],
            "src": "/api/home-media?id=" + media_id,
        })

    def save_rating(self):
        raw = self._read(4000)
        if raw is None:
            self._json(413, {"error": "too large"})
            return
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "bad json"})
            return
        dish = str(body.get("id", ""))
        stars = body.get("stars")
        text = str(body.get("text", "")).strip()[:300]
        if dish not in DISHES or not ID_OK.match(dish) or not isinstance(stars, int) or not 1 <= stars <= 5:
            self._json(400, {"error": "bad rating"})
            return
        with LOCK:
            data = load_ratings()
            rows = data.setdefault(dish, [])
            rows.append({
                "stars": stars,
                "text": text,
                "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
            if len(rows) > 400:
                del rows[:-400]
            save_json(RATINGS, data)
        self._json(200, data)


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", 8765), Handler)
    print("Menu at http://127.0.0.1:8765/")
    server.serve_forever()
