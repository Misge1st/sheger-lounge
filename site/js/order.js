(function () {
  var KEY = "sheger-cart";
  var locationFix = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function money(value) {
    return Number(String(value || "").replace(/\D/g, "")) || 0;
  }

  function format(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function loadCart() {
    try {
      var rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
    paintFab();
  }

  function deliveryFee() {
    var info = (window.SHEGER_MENU && window.SHEGER_MENU.info) || {};
    return money(info.deliveryFee != null ? info.deliveryFee : 100) || 100;
  }

  function cartCount() {
    return loadCart().reduce(function (sum, row) { return sum + (row.qty || 0); }, 0);
  }

  function paintFab() {
    var fab = document.getElementById("cart-fab");
    var count = document.getElementById("cart-count");
    if (!fab || !count) return;
    var total = cartCount();
    count.textContent = String(total);
    fab.hidden = total === 0;
  }

  function addItem(entry) {
    var rows = loadCart();
    var found = rows.find(function (row) { return row.key === entry.key; });
    if (found) found.qty = Math.min(99, found.qty + (entry.qty || 1));
    else rows.push({
      key: entry.key,
      name: entry.name,
      size: entry.size || "",
      price: money(entry.price),
      qty: entry.qty || 1
    });
    saveCart(rows);
    flashAdded(entry.name);
  }

  function flashAdded(name) {
    var note = document.getElementById("cart-toast");
    if (!note) return;
    note.textContent = name + " added";
    note.hidden = false;
    clearTimeout(flashAdded.timer);
    flashAdded.timer = setTimeout(function () { note.hidden = true; }, 1400);
  }

  function setQty(key, qty) {
    var rows = loadCart().map(function (row) {
      if (row.key !== key) return row;
      return Object.assign({}, row, { qty: Math.max(0, Math.min(99, qty)) });
    }).filter(function (row) { return row.qty > 0; });
    saveCart(rows);
    renderCheckout();
  }

  function foodTotal(rows) {
    return rows.reduce(function (sum, row) { return sum + row.price * row.qty; }, 0);
  }

  function paintLocation() {
    var label = document.getElementById("map-label");
    var link = document.getElementById("map-link");
    var box = document.querySelector(".loc-box");
    var button = document.getElementById("use-location");
    if (!label || !link || !box || !button) return;
    if (!locationFix) {
      box.classList.remove("ready");
      label.textContent = "Allow your current location so the driver can find you.";
      link.hidden = true;
      button.textContent = "Share my current location";
      return;
    }
    box.classList.add("ready");
    label.textContent = "Current location shared.";
    link.hidden = false;
    link.href = locationFix.url;
    button.textContent = "Update my location";
  }

  function setLocation(lat, lng) {
    locationFix = {
      lat: lat,
      lng: lng,
      url: "https://www.google.com/maps?q=" + lat + "," + lng
    };
    paintLocation();
  }

  function askLocation(force) {
    var label = document.getElementById("map-label");
    if (!navigator.geolocation) {
      if (label) label.textContent = "This phone cannot share location. Type the address clearly.";
      return;
    }
    if (locationFix && !force) {
      paintLocation();
      return;
    }
    if (label) label.textContent = "Waiting for you to allow location…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      setLocation(pos.coords.latitude, pos.coords.longitude);
    }, function (error) {
      locationFix = null;
      paintLocation();
      if (!label) return;
      if (error && error.code === 1) {
        label.textContent = "Location was blocked. Allow location for this site, then try again.";
      } else {
        label.textContent = "Could not get your location. Check GPS and try again.";
      }
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  function renderCheckout() {
    var list = document.getElementById("order-lines");
    var totals = document.getElementById("order-totals");
    if (!list || !totals) return;
    var rows = loadCart();
    if (!rows.length) {
      list.innerHTML = "<p class='empty-order'>Your order is empty. Add food from the menu.</p>";
      totals.innerHTML = "";
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var label = esc(row.name) + (row.size ? " · " + esc(row.size) : "");
      return "<div class='order-line' data-key='" + esc(row.key) + "'>" +
        "<div><strong>" + label + "</strong><span>" + format(row.price * row.qty) + " ETB</span></div>" +
        "<div class='qty'>" +
          "<button type='button' data-act='minus' aria-label='Less'>−</button>" +
          "<span>" + row.qty + "</span>" +
          "<button type='button' data-act='plus' aria-label='More'>+</button>" +
          "<button type='button' data-act='remove' class='ghost'>Remove</button>" +
        "</div></div>";
    }).join("");
    var food = foodTotal(rows);
    var fee = deliveryFee();
    totals.innerHTML =
      "<div><span>Food total</span><strong>" + format(food) + " ETB</strong></div>" +
      "<div><span>Delivery fee</span><strong>" + format(fee) + " ETB</strong></div>" +
      "<div class='grand'><span>TOTAL</span><strong>" + format(food + fee) + " ETB</strong></div>";
  }

  function openCheckout() {
    var panel = document.getElementById("checkout");
    if (!panel) return;
    panel.hidden = false;
    document.body.style.overflow = "hidden";
    renderCheckout();
    paintLocation();
    askLocation(false);
  }

  function closeCheckout() {
    var panel = document.getElementById("checkout");
    if (!panel) return;
    panel.hidden = true;
    document.body.style.overflow = "";
  }

  function orderButton(meta) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "add-btn";
    button.textContent = "Add";
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (meta.available === false) return;
      addItem(meta);
    });
    return button;
  }

  function attachFoodButtons() {
    document.querySelectorAll("#food .plate").forEach(function (plate) {
      if (plate.classList.contains("unavailable")) return;
      if (plate.dataset.id) {
        var item = (window.SHEGER_MENU.food || []).find(function (row) { return row.id === plate.dataset.id; });
        if (!item || item.available === false) return;
        if (item.sizes) {
          plate.querySelectorAll(".size").forEach(function (row, index) {
            if (row.querySelector(".add-btn")) return;
            var size = item.sizes[index];
            if (!size) return;
            row.appendChild(orderButton({
              key: item.id + "::" + size.name,
              name: item.name,
              size: size.name,
              price: size.price,
              available: item.available
            }));
          });
        } else {
          var body = plate.querySelector(".item");
          if (!body || body.querySelector(".add-btn")) return;
          body.appendChild(orderButton({
            key: item.id,
            name: item.name,
            size: "",
            price: item.price,
            available: item.available
          }));
        }
        return;
      }
      plate.querySelectorAll("[data-id]").forEach(function (row) {
        if (row.querySelector(".add-btn")) return;
        var item = (window.SHEGER_MENU.food || []).find(function (food) { return food.id === row.dataset.id; });
        if (!item || item.available === false) return;
        row.appendChild(orderButton({
          key: item.id,
          name: item.name,
          size: "",
          price: item.price,
          available: item.available
        }));
      });
    });
  }

  function attachDrinkButtons() {
    document.querySelectorAll("#drinks .drink").forEach(function (group) {
      if (group.classList.contains("unavailable")) return;
      var title = (group.querySelector("h2") || {}).textContent || "Drink";
      title = title.replace(/\s*Unavailable\s*$/, "").trim();
      group.querySelectorAll("[data-q]").forEach(function (row) {
        if (row.querySelector(".add-btn")) return;
        var nameEl = row.querySelector(".name");
        var priceEl = row.querySelector(".price");
        if (!nameEl || !priceEl) return;
        var size = nameEl.textContent.trim();
        row.appendChild(orderButton({
          key: "drink::" + title + "::" + size,
          name: title,
          size: size,
          price: priceEl.textContent,
          available: true
        }));
      });
    });
  }

  function bindMenu() {
    attachFoodButtons();
    attachDrinkButtons();
    paintFab();
  }

  function placeOrder(event) {
    event.preventDefault();
    var rows = loadCart();
    var status = document.getElementById("order-status");
    var button = document.getElementById("place-order");
    if (!rows.length) {
      status.textContent = "Add food to your order first.";
      return;
    }
    if (!locationFix) {
      status.textContent = "Allow your current location first.";
      askLocation(true);
      return;
    }
    var form = document.getElementById("delivery-form");
    var payload = {
      items: rows,
      payment: (form.querySelector("input[name=payment]:checked") || {}).value || "cash",
      customer: {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        city: form.city.value.trim(),
        area: form.area.value.trim(),
        address: form.address.value.trim(),
        note: form.note.value.trim()
      },
      map: locationFix
    };
    button.disabled = true;
    status.textContent = "Sending your order…";
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "The order was not sent.");
        saveCart([]);
        form.reset();
        form.city.value = "Addis Ababa";
        locationFix = null;
        paintLocation();
        renderCheckout();
        status.textContent = "";
        showThanks(data.id);
      });
    }).catch(function (error) {
      status.textContent = error.message || "The order was not sent.";
    }).finally(function () {
      button.disabled = false;
    });
  }

  function showThanks(orderId) {
    var overlay = document.getElementById("thanks-overlay");
    var detail = document.getElementById("thanks-detail");
    var ok = document.getElementById("thanks-ok");
    detail.textContent = "Order #" + orderId + " sent.";
    overlay.hidden = false;
    ok.focus();
  }

  function hideThanks() {
    document.getElementById("thanks-overlay").hidden = true;
    closeCheckout();
  }

  document.getElementById("cart-fab").addEventListener("click", openCheckout);
  document.getElementById("checkout-close").addEventListener("click", closeCheckout);
  document.getElementById("checkout-back").addEventListener("click", closeCheckout);
  document.getElementById("thanks-ok").addEventListener("click", hideThanks);
  document.getElementById("thanks-overlay").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) hideThanks();
  });
  document.getElementById("use-location").addEventListener("click", function () {
    askLocation(true);
  });
  document.getElementById("order-lines").addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    var line = button.closest(".order-line");
    if (!line) return;
    var row = loadCart().find(function (item) { return item.key === line.dataset.key; });
    if (!row) return;
    if (button.dataset.act === "plus") setQty(row.key, row.qty + 1);
    if (button.dataset.act === "minus") setQty(row.key, row.qty - 1);
    if (button.dataset.act === "remove") setQty(row.key, 0);
  });
  document.getElementById("delivery-form").addEventListener("submit", placeOrder);

  window.ShegerOrder = { bindMenu: bindMenu, paintFab: paintFab };
  paintFab();
})();
