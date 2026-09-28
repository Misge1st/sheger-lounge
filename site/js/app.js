(function () {
  var MENU = window.SHEGER_MENU;
  var viewer = document.getElementById("viewer");
  var viewerInfo = document.getElementById("viewer-info");
  var viewerImg = document.getElementById("viewer-img");
  var viewerRate = document.getElementById("viewer-rate");
  var lastShot = null;
  var eagerLeft = 2;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function starText(n) {
    var s = "";
    var full = Math.round(n);
    for (var i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
    return s;
  }

  function myRatings() {
    try { return JSON.parse(localStorage.getItem("sheger-my-ratings") || "{}"); }
    catch (e) { return {}; }
  }

  function saveMine(id, stars, text) {
    var all = myRatings();
    all[id] = { stars: stars, text: text };
    localStorage.setItem("sheger-my-ratings", JSON.stringify(all));
  }

  function paintYours() {
    var mine = myRatings();
    document.querySelectorAll(".yours").forEach(function (el) {
      var r = mine[el.dataset.for];
      el.textContent = r ? "You rated " + starText(r.stars) : "";
    });
  }

  function nameHtml(item) {
    var am = item.am ? " <span class='am'>" + esc(item.am) + "</span>" : "";
    var off = item.available === false ? " <span class='tag-off'>Unavailable</span>" : "";
    return esc(item.name) + am + off;
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function itemText(item) {
    var bits = [item.name, item.am, item.category, item.price];
    (item.sizes || []).forEach(function (row) { bits.push(row.name, row.price); });
    return norm(bits.join(" "));
  }

  function matches(q, text) {
    if (!q) return true;
    return q.split(" ").every(function (word) { return text.indexOf(word) !== -1; });
  }

  function priceRow(cls, name, price, q) {
    var attr = q ? " data-q='" + esc(q) + "'" : "";
    return "<div class='" + cls + "'" + attr + "><span class='name'>" + esc(name) + "</span><span class='price'>" + esc(price) + "</span></div>";
  }

  function yours(id) {
    return "<p class='yours' data-for='" + esc(id) + "'></p>";
  }

  function makeImg(item) {
    var img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.decoding = "async";
    if (eagerLeft > 0) {
      img.loading = "eager";
      eagerLeft -= 1;
    } else {
      img.loading = "lazy";
    }
    if (item.available === false) img.tabIndex = -1;
    return img;
  }

  function makePlate(item) {
    var plate = document.createElement("div");
    plate.className = "plate" + (item.available === false ? " unavailable" : "");
    plate.dataset.q = itemText(item);
    if (item.id) plate.dataset.id = item.id;
    if (item.image) plate.appendChild(makeImg(item));
    else {
      var blank = document.createElement("div");
      blank.className = "no-photo";
      plate.appendChild(blank);
    }
    var body = document.createElement("div");
    if (item.sizes) {
      body.innerHTML = "<h2>" + nameHtml(item) + "</h2>" + item.sizes.map(function (s) {
        return priceRow("size", s.name, s.price);
      }).join("") + yours(item.id);
    } else {
      body.className = "item";
      body.innerHTML = "<span class='name'>" + nameHtml(item) + "</span><span class='price'>" + esc(item.price) + "</span>" + yours(item.id);
    }
    plate.appendChild(body);
    if (item.feature) {
      var wrap = document.createElement("div");
      wrap.className = "feature";
      wrap.appendChild(plate);
      return wrap;
    }
    return plate;
  }

  function makePair(a, b) {
    var plate = document.createElement("div");
    plate.className = "plate";
    if (a.image) plate.appendChild(makeImg(a));
    var body = document.createElement("div");
    [a, b].forEach(function (item) {
      var row = document.createElement("div");
      row.className = "item" + (item.available === false ? " unavailable" : "");
      row.dataset.id = item.id;
      row.dataset.q = itemText(item);
      row.innerHTML = "<span class='name'>" + nameHtml(item) + "</span><span class='price'>" + esc(item.price) + "</span>" + yours(item.id);
      body.appendChild(row);
    });
    plate.appendChild(body);
    return plate;
  }

  function renderFood() {
    var root = document.getElementById("food");
    root.innerHTML = "";
    ["Meats", "Dishes", "Fasting"].forEach(function (cat) {
      var block = document.createElement("div");
      block.className = "cat-block";
      block.id = "cat-" + cat.toLowerCase();
      if (cat === "Fasting") {
        var h = document.createElement("h3");
        h.className = "fast-label";
        h.innerHTML = "FASTING <span>የፆም ምግቦች</span>";
        block.appendChild(h);
      }
      var list = MENU.food.filter(function (item) { return item.category === cat; });
      var i = 0;
      while (i < list.length) {
        var item = list[i];
        var next = list[i + 1];
        if (item.share && next && next.share && next.image === item.image) {
          block.appendChild(makePair(item, next));
          i += 2;
        } else {
          block.appendChild(makePlate(item));
          i += 1;
        }
      }
      root.appendChild(block);
    });
  }

  function renderDrinks() {
    var root = document.getElementById("drinks");
    root.innerHTML = "";
    [{ id: "spirits", label: "Spirits" }, { id: "soft", label: "Soft drinks" }].forEach(function (cat) {
      var block = document.createElement("div");
      block.className = "cat-block";
      block.id = "cat-" + cat.id;
      MENU.drinks.filter(function (item) { return item.category === cat.label; }).forEach(function (item) {
        var group = document.createElement("div");
        group.className = "drink" + (item.available === false ? " unavailable" : "");
        var h = document.createElement("h2");
        h.textContent = item.name;
        if (item.available === false) {
          var off = document.createElement("span");
          off.className = "tag-off";
          off.textContent = "Unavailable";
          h.appendChild(off);
        }
        group.appendChild(h);
        var rows = item.sizes || item.rows || [];
        var cls = item.sizes ? "size" : "item";
        rows.forEach(function (row) {
          var q = norm([item.name, row.name, row.price, cat.label].join(" "));
          group.insertAdjacentHTML("beforeend", priceRow(cls, row.name, row.price, q));
        });
        block.appendChild(group);
      });
      root.appendChild(block);
    });
  }

  function setCats(which) {
    var bar = document.getElementById("cats");
    var list = which === "drinks"
      ? [["spirits", "Spirits"], ["soft", "Soft drinks"]]
      : [["meats", "Meats"], ["dishes", "Dishes"], ["fasting", "Fasting"]];
    bar.innerHTML = "";
    list.forEach(function (pair, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = pair[1];
      if (index === 0) button.setAttribute("aria-current", "true");
      button.addEventListener("click", function () {
        bar.querySelectorAll("button").forEach(function (other) { other.removeAttribute("aria-current"); });
        button.setAttribute("aria-current", "true");
        var target = document.getElementById("cat-" + pair[0]);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      bar.appendChild(button);
    });
  }

  function dishIds(plate) {
    if (plate.dataset.id) return [plate.dataset.id];
    return Array.prototype.map.call(plate.querySelectorAll("[data-id]"), function (el) { return el.dataset.id; });
  }

  function dishLabel(plate, id) {
    if (plate.dataset.id === id) {
      var heading = plate.querySelector("h2");
      if (heading) return heading.innerText.replace(/\s+/g, " ").trim();
      var named = plate.querySelector(".name");
      if (named) return named.innerText.replace(/\s+/g, " ").trim();
    }
    var row = plate.querySelector('[data-id="' + id + '"] .name');
    return row ? row.innerText.replace(/\s+/g, " ").trim() : id;
  }

  function notesHtml(id) {
    var mine = myRatings()[id];
    if (!mine || !mine.text) return "";
    return "<ul class='notes'><li><span class='who'>" + starText(mine.stars) + "</span>" + esc(mine.text) + "</li></ul>";
  }

  function sendToNetlify(label, stars, text) {
    var body = new URLSearchParams();
    body.set("form-name", "food-rating");
    body.set("dish", label);
    body.set("stars", String(stars));
    body.set("feedback", text);
    body.set("bot-field", "");
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  }

  function buildRateForm(plate) {
    viewerRate.innerHTML = "";
    dishIds(plate).forEach(function (id) {
      if (plate.querySelector(".unavailable") && plate.dataset.id === id) return;
      var box = document.createElement("div");
      box.className = "rate-box";
      var picked = (myRatings()[id] || {}).stars || 0;
      box.innerHTML =
        "<h3>Rate " + esc(dishLabel(plate, id)) + "</h3>" +
        "<div class='stars'>" +
          [1, 2, 3, 4, 5].map(function (n) {
            return "<button type='button' data-star='" + n + "' class='" + (n <= picked ? "on" : "") + "' aria-label='" + n + " star'>★</button>";
          }).join("") +
        "</div>" +
        "<textarea maxlength='300' placeholder='Add your feedback'></textarea>" +
        "<button type='button' class='send'>Send</button>" +
        "<p class='thanks' hidden></p>" +
        notesHtml(id);
      box.querySelectorAll(".stars button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          picked = Number(btn.dataset.star);
          box.querySelectorAll(".stars button").forEach(function (star) {
            star.classList.toggle("on", Number(star.dataset.star) <= picked);
          });
        });
      });
      box.querySelector(".send").addEventListener("click", function () {
        var thanks = box.querySelector(".thanks");
        if (!picked) {
          thanks.hidden = false;
          thanks.textContent = "Choose a star rating first.";
          return;
        }
        var text = box.querySelector("textarea").value.trim().slice(0, 300);
        var label = dishLabel(plate, id);
        saveMine(id, picked, text);
        paintYours();
        thanks.hidden = false;
        thanks.textContent = "Thank you. The lounge has your rating.";
        var old = box.querySelector(".notes");
        if (old) old.remove();
        box.insertAdjacentHTML("beforeend", notesHtml(id));
        sendToNetlify(label, picked, text).then(function (res) {
          if (!res.ok) thanks.textContent = "Thank you. Your rating is saved on this phone.";
        }).catch(function () {
          thanks.textContent = "Thank you. Your rating is saved on this phone.";
        });
      });
      viewerRate.appendChild(box);
    });
  }

  function openViewer(img) {
    var plate = img.parentElement;
    if (plate.classList.contains("unavailable")) return;
    var block = plate.querySelector(":scope > div");
    viewerInfo.innerHTML = "";
    var copy = block.cloneNode(true);
    copy.querySelectorAll(".yours").forEach(function (node) { node.remove(); });
    viewerInfo.appendChild(copy);
    viewerImg.src = img.currentSrc || img.src;
    viewerImg.alt = img.alt;
    buildRateForm(plate);
    viewer.hidden = false;
    document.body.style.overflow = "hidden";
    lastShot = img;
  }

  function closeViewer() {
    viewer.hidden = true;
    viewerImg.removeAttribute("src");
    viewerRate.innerHTML = "";
    document.body.style.overflow = "";
    if (lastShot) lastShot.focus();
  }

  function bindPhotos() {
    document.querySelectorAll("#food .plate > img").forEach(function (img) {
      if (img.parentElement.classList.contains("unavailable")) return;
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.addEventListener("click", function () { openViewer(img); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openViewer(img);
        }
      });
    });
  }

  var tabs = document.querySelectorAll("nav.tabs button");
  var searchForm = document.getElementById("menu-search");
  var searchInput = document.getElementById("q");
  var clearSearch = document.getElementById("clear-search");
  var searchStatus = document.getElementById("search-status");

  function showTab(which, scrollTop) {
    var home = which === "home";
    var drinks = which === "drinks";
    tabs.forEach(function (other) {
      var id = other.getAttribute("aria-controls");
      var on = id === which;
      other.setAttribute("aria-selected", on ? "true" : "false");
      var panel = document.getElementById(id);
      if (panel) panel.hidden = !on;
    });
    document.body.classList.toggle("home", home);
    document.body.classList.toggle("drinks", drinks && !home);
    if (!home) {
      setCats(drinks ? "drinks" : "food");
      if (norm(searchInput.value)) document.getElementById("cats").hidden = true;
    } else {
      document.getElementById("cats").hidden = true;
      document.getElementById("cats").innerHTML = "";
    }
    if (scrollTop) window.scrollTo(0, 0);
  }

  function setHidden(el, hidden) {
    el.hidden = hidden;
    if (el.parentElement && el.parentElement.classList.contains("feature")) {
      el.parentElement.hidden = hidden;
    }
  }

  function applySearch(raw) {
    var q = norm(raw);
    var foodHits = 0;
    var drinkHits = 0;
    clearSearch.hidden = !q;
    if (q && document.body.classList.contains("home")) {
      showTab("food", false);
    }
    document.querySelectorAll("#food .plate").forEach(function (plate) {
      var rows = plate.querySelectorAll("[data-q]");
      if (rows.length && !plate.dataset.q) {
        var shown = 0;
        rows.forEach(function (row) {
          var on = matches(q, row.dataset.q);
          row.hidden = !!q && !on;
          if (!q || on) shown += 1;
        });
        setHidden(plate, !!q && shown === 0);
        foodHits += q ? shown : 0;
      } else {
        var on = matches(q, plate.dataset.q || "");
        setHidden(plate, !!q && !on);
        if (q && on) foodHits += 1;
      }
    });
    document.querySelectorAll("#drinks .drink").forEach(function (group) {
      var shown = 0;
      group.querySelectorAll("[data-q]").forEach(function (row) {
        var on = matches(q, row.dataset.q);
        row.hidden = !!q && !on;
        if (!q || on) shown += 1;
      });
      var heading = group.querySelector("h2");
      if (heading) heading.hidden = !!q && shown === 0;
      group.hidden = !!q && shown === 0;
      if (q) drinkHits += shown;
    });
    document.querySelectorAll(".cat-block").forEach(function (block) {
      var visible = block.querySelector(".plate:not([hidden]), .drink:not([hidden])");
      block.hidden = !!q && !visible;
    });
    document.getElementById("cats").hidden = !!q || document.body.classList.contains("home");
    searchStatus.hidden = !q;
    searchStatus.innerHTML = "";
    if (!q) return { food: 0, drinks: 0 };
    if (!foodHits && !drinkHits) {
      searchStatus.textContent = "No matches.";
      return { food: 0, drinks: 0 };
    }
    var onDrinks = document.body.classList.contains("drinks");
    if (!onDrinks && !foodHits && drinkHits) showTab("drinks", false);
    if (onDrinks && !drinkHits && foodHits) showTab("food", false);
    onDrinks = document.body.classList.contains("drinks");
    var here = onDrinks ? drinkHits : foodHits;
    var other = onDrinks ? foodHits : drinkHits;
    searchStatus.textContent = here + (here === 1 ? " match" : " matches");
    if (other) {
      var jump = document.createElement("button");
      jump.type = "button";
      jump.textContent = other + " in " + (onDrinks ? "Food" : "Drinks");
      jump.addEventListener("click", function () {
        showTab(onDrinks ? "food" : "drinks", true);
        applySearch(searchInput.value);
      });
      searchStatus.appendChild(jump);
    }
    return { food: foodHits, drinks: drinkHits };
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var which = btn.getAttribute("aria-controls") || "home";
      showTab(which, true);
      if (which !== "home" && norm(searchInput.value)) applySearch(searchInput.value);
    });
  });

  document.querySelectorAll(".home-actions [data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showTab(btn.getAttribute("data-go"), true);
    });
  });

  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    applySearch(searchInput.value);
    var panel = document.body.classList.contains("drinks") ? "#drinks" : "#food";
    var hit = document.querySelector(panel + " .plate:not([hidden]), " + panel + " .drink:not([hidden])");
    if (hit) hit.scrollIntoView({ behavior: "smooth", block: "start" });
    searchInput.blur();
  });
  searchInput.addEventListener("input", function () {
    applySearch(searchInput.value);
  });
  clearSearch.addEventListener("click", function () {
    searchInput.value = "";
    applySearch("");
    searchInput.focus();
  });

  document.querySelector(".viewer-x").addEventListener("click", closeViewer);
  document.querySelector(".viewer-back").addEventListener("click", closeViewer);
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer) closeViewer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !viewer.hidden) closeViewer();
  });

  function telHref(display) {
    var digits = String(display).replace(/[^\d+]/g, "");
    if (digits.charAt(0) === "0") digits = "+251" + digits.slice(1);
    else if (digits.charAt(0) !== "+") digits = "+" + digits;
    return "tel:" + digits;
  }

  function applyInfo(info) {
    if (!info) return;
    var addr = document.querySelector(".addr");
    if (addr && info.maps) addr.href = info.maps;
    document.querySelectorAll(".addr .am, .home-address").forEach(function (am) {
      if (info.address) am.textContent = info.address;
    });
    var phones = info.phones || [];
    document.querySelectorAll(".phone").forEach(function (link) {
      var value = phones[Number(link.dataset.slot)] || "";
      link.hidden = !value;
      if (!value) return;
      link.textContent = value;
      link.href = telHref(value);
    });
    var tik = document.querySelector(".tik");
    if (tik && info.tiktok) {
      var handle = String(info.tiktok).replace(/^@/, "");
      tik.href = "https://www.tiktok.com/@" + handle;
      var em = tik.querySelector("em");
      if (em) em.textContent = "@" + handle;
    }
  }

  function usable(data) {
    return data && Array.isArray(data.food) && Array.isArray(data.drinks);
  }

  function paintHome() {
    var gallery = document.getElementById("home-gallery");
    if (!gallery) return;
    gallery.innerHTML = "";
    var rows = (MENU.home && MENU.home.media) || [];
    rows.forEach(function (item) {
      if (!item || !item.src) return;
      var figure = document.createElement("figure");
      if (item.type === "video") {
        var video = document.createElement("video");
        video.src = item.src;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        figure.appendChild(video);
      } else {
        var img = document.createElement("img");
        img.src = item.src;
        img.alt = item.caption || "Sheger Lounge";
        img.loading = "lazy";
        figure.appendChild(img);
      }
      if (item.caption) {
        var cap = document.createElement("figcaption");
        cap.textContent = item.caption;
        figure.appendChild(cap);
      }
      gallery.appendChild(figure);
    });
  }

  function boot() {
    MENU = window.SHEGER_MENU;
    applyInfo(MENU.info);
    renderFood();
    renderDrinks();
    paintHome();
    showTab("home", false);
    bindPhotos();
    paintYours();
    if (window.ShegerOrder) window.ShegerOrder.bindMenu();
  }

  fetch("/api/menu", { cache: "no-store" }).then(function (res) {
    if (res.status === 204 || !res.ok) return null;
    return res.json();
  }).catch(function () {
    return null;
  }).then(function (data) {
    if (usable(data)) return data;
    return fetch("/data/menu.json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).catch(function () { return null; });
  }).then(function (data) {
    if (usable(data)) window.SHEGER_MENU = data;
  }).finally(boot);
})();
