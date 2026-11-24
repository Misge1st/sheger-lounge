(function () {
  var FOOD_CATS = ["Meats", "Dishes", "Fasting"];
  var DRINK_CATS = ["Spirits", "Soft drinks"];
  var CAT_LABEL = {
    "Meats": "Meat sold by the kilo",
    "Dishes": "Other food",
    "Fasting": "Fasting food",
    "Spirits": "Alcohol",
    "Soft drinks": "Soft drinks, beer, and water"
  };
  var HELP = {
    orders: "New orders need you. Press “I will make this” when you start cooking. Press “Order is finished” after you deliver it.",
    food: "Change a price, hide a dish, or add a new food. Customers do not see it until you press the big button at the bottom.",
    drinks: "Change a drink price or hide a drink. Customers do not see it until you press the big button at the bottom.",
    home: "These photos and videos show on the website home page. After you add or delete one, press the big button at the bottom.",
    lounge: "This is the phone number, address, and delivery fee on the website. After you change them, press the big button at the bottom."
  };
  var password = "";
  var draft = null;
  var savedJson = "";
  var tab = "food";
  var editing = null;
  var orders = [];
  var panel = document.getElementById("panel");
  var status = document.getElementById("status");
  var publishBtn = document.getElementById("publish");
  var publishBar = document.getElementById("publish-bar");
  var loginAlert = document.getElementById("login-alert");
  var loginCount = document.getElementById("login-count");
  var loginAlertTitle = document.getElementById("login-alert-title");
  var loginAlertText = document.getElementById("login-alert-text");
  var ordersBadge = document.getElementById("orders-badge");

  function showStatus(text) {
    status.textContent = text;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function formatMoney(n) {
    return Number(n || 0).toLocaleString("en-US") + " ETB";
  }

  function paymentLabel(value) {
    if (value === "mobile") return "Mobile Payment";
    if (value === "other") return "Other";
    return "Cash on Delivery";
  }

  function pendingCount(list) {
    return (list || []).filter(function (order) {
      return order.status === "new" || order.status === "accepted";
    }).length;
  }

  function paintPending(count) {
    loginAlert.hidden = !count;
    loginCount.textContent = String(count || 0);
    loginAlertTitle.textContent = count === 1 ? "1 active order" : count + " active orders";
    loginAlertText.textContent = count ? "Open the page to see them." : "";
    if (count) {
      ordersBadge.hidden = false;
      ordersBadge.textContent = String(count);
    } else {
      ordersBadge.hidden = true;
    }
  }

  function refreshPending() {
    return fetch("/api/orders/count", { cache: "no-store" }).then(function (res) {
      if (!res.ok) return;
      return res.json().then(function (data) {
        paintPending(Number(data.pending) || 0);
      });
    }).catch(function () {});
  }

  function snapshot(menu) {
    return JSON.stringify(menu, function (key, value) {
      if (key === "_new") return undefined;
      return value;
    });
  }

  function formatPrice(raw) {
    var digits = String(raw || "").replace(/\D/g, "").slice(0, 9);
    if (!digits) return "";
    return Number(digits).toLocaleString("en-US");
  }

  function uniqueId(name) {
    var base = String(name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "item";
    var id = base;
    var used = {};
    var number = 2;
    draft.food.concat(draft.drinks).forEach(function (item) {
      if (item.id) used[item.id] = true;
    });
    while (used[id]) {
      id = (base + "-" + number).slice(0, 40);
      number += 1;
    }
    return id;
  }

  function priceLabel(item) {
    var lines = item.sizes || item.rows;
    if (lines && lines.length) {
      return lines.map(function (line) { return line.name + " " + line.price; }).join(" · ");
    }
    return item.price || "No price";
  }

  function usable(data) {
    return data && Array.isArray(data.food) && Array.isArray(data.drinks);
  }

  function button(text, action, index, kind, extra) {
    var node = document.createElement("button");
    node.type = "button";
    node.textContent = text;
    node.dataset.action = action;
    if (index != null) node.dataset.index = String(index);
    if (kind) node.dataset.kind = kind;
    if (extra) node.className = extra;
    return node;
  }

  function input(name, value, placeholder) {
    var node = document.createElement("input");
    node.name = name;
    node.value = value || "";
    node.maxLength = 80;
    if (placeholder) node.placeholder = placeholder;
    return node;
  }

  function field(label, control) {
    var wrap = document.createElement("label");
    wrap.className = "field";
    var span = document.createElement("span");
    span.textContent = label;
    wrap.appendChild(span);
    wrap.appendChild(control);
    return wrap;
  }

  function check(name, label, on) {
    var wrap = document.createElement("label");
    wrap.className = "check";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.name = name;
    box.checked = on;
    var span = document.createElement("span");
    span.textContent = label;
    wrap.appendChild(box);
    wrap.appendChild(span);
    return wrap;
  }

  function select(name, options, value) {
    var node = document.createElement("select");
    node.name = name;
    options.forEach(function (option) {
      var choice = document.createElement("option");
      choice.value = option;
      choice.textContent = CAT_LABEL[option] || option;
      choice.selected = option === value;
      node.appendChild(choice);
    });
    return node;
  }

  function lineRow(name, price) {
    var row = document.createElement("div");
    row.className = "line";
    var itemName = document.createElement("input");
    itemName.setAttribute("data-name", "");
    itemName.value = name || "";
    itemName.placeholder = "Size, like 1 kg or Bottle";
    itemName.maxLength = 40;
    var itemPrice = document.createElement("input");
    itemPrice.setAttribute("data-price", "");
    itemPrice.value = price || "";
    itemPrice.placeholder = "Price in birr";
    itemPrice.inputMode = "decimal";
    itemPrice.maxLength = 12;
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Delete this price";
    remove.addEventListener("click", function () { row.remove(); });
    row.appendChild(itemName);
    row.appendChild(itemPrice);
    row.appendChild(remove);
    return row;
  }

  function readLines(form) {
    var lines = [];
    form.querySelectorAll(".line").forEach(function (line) {
      var name = line.querySelector("[data-name]").value.trim();
      var price = line.querySelector("[data-price]").value.trim();
      if (!name && !price) return;
      lines.push({ name: name, price: price });
    });
    return lines;
  }

  function linesLookWrong(lines) {
    if (!lines.length) return "Type at least one price.";
    for (var i = 0; i < lines.length; i += 1) {
      if (!lines[i].name || !formatPrice(lines[i].price)) return "Every line needs a size and a price.";
    }
    return "";
  }

  function priced(lines) {
    return lines.map(function (line) {
      return { name: line.name, price: formatPrice(line.price) };
    });
  }

  function stashFoodEditor(item, form) {
    if (!item || !form) return;
    var nameNode = form.querySelector("[name=name]");
    var amNode = form.querySelector("[name=am]");
    var catNode = form.querySelector("[name=category]");
    var availableNode = form.querySelector("[name=available]");
    var featureNode = form.querySelector("[name=feature]");
    var multiNode = form.querySelector("[name=multi]");
    var priceNode = form.querySelector("[name=price]");
    if (nameNode) item.name = nameNode.value.trim();
    if (amNode) item.am = amNode.value.trim();
    if (catNode) item.category = catNode.value;
    if (availableNode) item.available = availableNode.checked;
    if (featureNode) {
      if (featureNode.checked) item.feature = true;
      else delete item.feature;
    }
    if (multiNode && multiNode.checked) {
      item.sizes = priced(readLines(form));
      delete item.price;
    } else if (priceNode) {
      item.price = formatPrice(priceNode.value) || priceNode.value.trim();
      delete item.sizes;
    }
  }

  function commitFood(item, form) {
    var name = form.querySelector("[name=name]").value.trim();
    if (!name) return "Add the food name.";
    item.name = name;
    item.am = form.querySelector("[name=am]").value.trim();
    item.category = form.querySelector("[name=category]").value;
    item.available = form.querySelector("[name=available]").checked;
    if (form.querySelector("[name=feature]").checked) item.feature = true;
    else delete item.feature;
    if (!item.id || item._new) {
      delete item.id;
      item.id = uniqueId(name);
    }
    if (form.querySelector("[name=multi]").checked) {
      var problem = linesLookWrong(readLines(form));
      if (problem) return problem;
      item.sizes = priced(readLines(form));
      delete item.price;
    } else {
      var price = formatPrice(form.querySelector("[name=price]").value);
      if (!price) return "Add a price.";
      item.price = price;
      delete item.sizes;
    }
    delete item._new;
    return "";
  }

  function commitDrink(item, form) {
    var name = form.querySelector("[name=name]").value.trim();
    if (!name) return "Add the drink name.";
    var problem = linesLookWrong(readLines(form));
    if (problem) return problem;
    item.name = name;
    item.category = form.querySelector("[name=category]").value;
    item.available = form.querySelector("[name=available]").checked;
    if (item.rows || item.category === "Soft drinks") {
      item.rows = priced(readLines(form));
      delete item.sizes;
    } else {
      item.sizes = priced(readLines(form));
      delete item.rows;
    }
    delete item._new;
    return "";
  }

  function commitLounge() {
    var form = panel.querySelector("form.lounge");
    if (!form) return "";
    var address = form.querySelector("[name=address]").value.trim();
    var phone1 = form.querySelector("[name=phone1]").value.trim();
    var phone2 = form.querySelector("[name=phone2]").value.trim();
    if (!address) return "Add the address.";
    if (!phone1 && !phone2) return "Add a phone number.";
    var phones = [];
    if (phone1) phones.push(phone1);
    if (phone2) phones.push(phone2);
    draft.info = {
      address: address,
      maps: form.querySelector("[name=maps]").value.trim(),
      phones: phones,
      tiktok: form.querySelector("[name=tiktok]").value.trim() || "@sheger_kurt",
      deliveryFee: form.querySelector("[name=deliveryFee]").value.trim() || "100"
    };
    return "";
  }

  function commitOpen() {
    if (!editing) return true;
    var form = panel.querySelector("form.editor");
    if (!form) {
      editing = null;
      return true;
    }
    var list = editing.kind === "food" ? draft.food : draft.drinks;
    var problem = editing.kind === "food"
      ? commitFood(list[editing.index], form)
      : commitDrink(list[editing.index], form);
    if (problem) {
      showStatus(problem);
      return false;
    }
    editing = null;
    return true;
  }

  function foodImages(item) {
    var list = [];
    var seen = {};
    var source = (item && Array.isArray(item.images) && item.images.length)
      ? item.images
      : (item && item.image ? [item.image] : []);
    source.forEach(function (src) {
      var text = String(src || "").trim();
      if (!text || seen[text] || list.length >= 3) return;
      seen[text] = true;
      list.push(text);
    });
    return list;
  }

  function syncFoodImages(item) {
    var list = foodImages(item);
    item.images = list;
    item.image = list[0] || "";
    return list;
  }

  function foodEditor(item) {
    var form = document.createElement("form");
    form.className = "editor";
    var bank = document.createElement("div");
    bank.className = "photo-bank";
    var slots = document.createElement("div");
    slots.className = "photo-slots";
    foodImages(item).forEach(function (src, index) {
      var slot = document.createElement("div");
      slot.className = "photo-slot";
      var preview = document.createElement("img");
      preview.className = "preview";
      preview.alt = "";
      preview.src = src;
      slot.appendChild(preview);
      var remove = button("Delete photo", "remove-photo", index, "food", "warn");
      slot.appendChild(remove);
      slots.appendChild(slot);
    });
    bank.appendChild(slots);
    var hint = document.createElement("p");
    hint.className = "muted";
    var count = foodImages(item).length;
    hint.textContent = count >= 3
      ? "This food already has 3 photos. Delete one if you want a new photo."
      : "You can add up to 3 photos. Customers swipe to see them. (" + count + " of 3)";
    bank.appendChild(hint);
    if (count < 3) {
      var photo = document.createElement("input");
      photo.type = "file";
      photo.name = "photo";
      photo.accept = "image/*";
      bank.appendChild(field("Add a photo of this food", photo));
    }
    form.appendChild(bank);
    form.appendChild(field("Food name", input("name", item.name, "Example: Kitfo")));
    form.appendChild(field("Amharic name", input("am", item.am, "Example: ክትፎ")));
    form.appendChild(field("Where it belongs", select("category", FOOD_CATS, item.category || "Dishes")));
    form.appendChild(check("available", "Customers can order this", item.available !== false));
    form.appendChild(check("feature", "Put a gold box around this dish", item.feature === true));
    var multi = check("multi", "This food has more than one size", !!item.sizes);
    form.appendChild(multi);
    var single = document.createElement("div");
    single.className = "single";
    single.hidden = !!item.sizes;
    single.appendChild(field("Price in birr", input("price", item.price, "350")));
    form.appendChild(single);
    var many = document.createElement("div");
    many.className = "many";
    many.hidden = !item.sizes;
    var lines = document.createElement("div");
    lines.className = "lines";
    (item.sizes || [{ name: "1 kg", price: "" }]).forEach(function (line) {
      lines.appendChild(lineRow(line.name, line.price));
    });
    many.appendChild(lines);
    many.appendChild(button("Add another size", "add-line"));
    form.appendChild(many);
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Save this food", "done"));
    actions.appendChild(button("Go back", "cancel", null, null, "ghost"));
    form.appendChild(actions);
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    return form;
  }

  function drinkEditor(item) {
    var form = document.createElement("form");
    form.className = "editor";
    form.appendChild(field("Drink name", input("name", item.name, "Example: Black Label")));
    form.appendChild(field("Where it belongs", select("category", DRINK_CATS, item.category || "Spirits")));
    form.appendChild(check("available", "Customers can order this", item.available !== false));
    var lines = document.createElement("div");
    lines.className = "lines";
    var source = item.sizes || item.rows || [{ name: "Bottle", price: "" }];
    source.forEach(function (line) { lines.appendChild(lineRow(line.name, line.price)); });
    form.appendChild(lines);
    form.appendChild(button("Add another size", "add-line"));
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Save this drink", "done"));
    actions.appendChild(button("Go back", "cancel", null, null, "ghost"));
    form.appendChild(actions);
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    return form;
  }

  function itemRow(item, index, kind) {
    var row = document.createElement("div");
    row.className = "row";
    var title = document.createElement("strong");
    title.textContent = item.name || "New item";
    if (item.am) title.textContent += " " + item.am;
    row.appendChild(title);
    if (item.available === false) {
      var off = document.createElement("div");
      off.className = "off";
      off.textContent = "Hidden from customers";
      row.appendChild(off);
    }
    var prices = document.createElement("p");
    prices.textContent = priceLabel(item);
    row.appendChild(prices);
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Change", "edit", index, kind));
    actions.appendChild(button(item.available === false ? "Show it again" : "Hide it", "soldout", index, kind, "ghost"));
    actions.appendChild(button("Delete", "remove", index, kind, "warn"));
    actions.appendChild(button("Move up", "up", index, kind, "ghost"));
    actions.appendChild(button("Move down", "down", index, kind, "ghost"));
    row.appendChild(actions);
    return row;
  }

  function renderList(kind) {
    var cats = kind === "food" ? FOOD_CATS : DRINK_CATS;
    var list = kind === "food" ? draft.food : draft.drinks;
    cats.forEach(function (cat) {
      var heading = document.createElement("h2");
      heading.textContent = CAT_LABEL[cat] || cat;
      panel.appendChild(heading);
      list.forEach(function (item, index) {
        if (item.category !== cat) return;
        if (editing && editing.kind === kind && editing.index === index) {
          panel.appendChild(kind === "food" ? foodEditor(item) : drinkEditor(item));
        } else {
          panel.appendChild(itemRow(item, index, kind));
        }
      });
    });
    panel.appendChild(button(kind === "food" ? "Add a new food" : "Add a new drink", "add", null, kind));
  }

  function renderLounge() {
    var info = draft.info || {};
    var phones = info.phones || [];
    var form = document.createElement("form");
    form.className = "lounge";
    form.appendChild(field("Address customers see", (function () {
      var box = document.createElement("textarea");
      box.name = "address";
      box.maxLength = 180;
      box.value = info.address || "";
      return box;
    })()));
    form.appendChild(field("Google Maps link", input("maps", info.maps, "Paste the map link")));
    form.appendChild(field("Phone number 1", input("phone1", phones[0], "0909499994")));
    form.appendChild(field("Phone number 2", input("phone2", phones[1], "096 382 4782")));
    form.appendChild(field("TikTok name", input("tiktok", info.tiktok, "@sheger_kurt")));
    form.appendChild(field("Delivery fee in birr", input("deliveryFee", info.deliveryFee || "100", "100")));
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Type the new details, then press the big button at the bottom. Until then, the website stays the same.";
    form.appendChild(note);
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    panel.appendChild(form);
  }

  function refreshPublish() {
    publishBtn.disabled = false;
    publishBtn.textContent = "Show changes to customers";
  }

  function orderWords(status) {
    if (status === "accepted") return "You said you will make this";
    if (status === "done") return "Finished";
    if (status === "cancelled") return "Cancelled";
    return "New — please look";
  }

  function renderOrders() {
    if (!orders.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No orders yet. When a customer orders, it will show here.";
      panel.appendChild(empty);
      return;
    }
    orders.forEach(function (order) {
      var card = document.createElement("article");
      card.className = "order-card" + (order.status === "new" ? " new" : "");
      var title = document.createElement("h3");
      title.textContent = "Order " + order.id + " — " + orderWords(order.status);
      card.appendChild(title);
      var meta = document.createElement("div");
      meta.className = "meta";
      var customer = order.customer || {};
      var map = order.map || {};
      meta.innerHTML =
        "<div><strong>" + esc(customer.name) + "</strong></div>" +
        "<div>📞 <a href='tel:" + esc(String(customer.phone || "").replace(/[^\d+]/g, "")) + "'>" + esc(customer.phone) + "</a></div>" +
        "<div>" + esc(customer.city) + (customer.area ? " · " + esc(customer.area) : "") + "</div>" +
        "<div>" + esc(customer.address) + "</div>" +
        (map.url ? "<div><a href='" + esc(map.url) + "' target='_blank' rel='noopener'>Open map location</a></div>" : "") +
        (customer.note ? "<div>Note: " + esc(customer.note) + "</div>" : "") +
        "<div>Payment: " + esc(paymentLabel(order.payment)) + "</div>";
      card.appendChild(meta);
      var list = document.createElement("ul");
      (order.items || []).forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item.qty + " × " + item.name + (item.size ? " (" + item.size + ")" : "") + " — " + formatMoney(item.price * item.qty);
        list.appendChild(li);
      });
      card.appendChild(list);
      var money = document.createElement("div");
      money.className = "money";
      money.innerHTML =
        "<div>Food: " + formatMoney(order.foodTotal) + "</div>" +
        "<div>Delivery fee: " + formatMoney(order.deliveryFee) + "</div>" +
        "<div><strong>Customer pays: " + formatMoney(order.total) + "</strong></div>";
      card.appendChild(money);
      var actions = document.createElement("div");
      actions.className = "row-actions";
      if (order.status === "new") actions.appendChild(button("I will make this", "order-status", order.id, "accepted"));
      if (order.status === "new" || order.status === "accepted") actions.appendChild(button("Order is finished", "order-status", order.id, "done"));
      if (order.status !== "cancelled" && order.status !== "done") actions.appendChild(button("Cancel this order", "order-status", order.id, "cancelled", "warn"));
      card.appendChild(actions);
      panel.appendChild(card);
    });
  }

  function loadOrders() {
    return fetch("/api/orders", {
      cache: "no-store",
      headers: { "Authorization": "Bearer " + password }
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "Orders could not load.");
        orders = Array.isArray(data.orders) ? data.orders : [];
        paintPending(pendingCount(orders));
      });
    });
  }

  function setOrderStatus(id, next) {
    return fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + password },
      body: JSON.stringify({ id: id, status: next })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "Could not update the order.");
        return loadOrders().then(render);
      });
    }).catch(function (error) {
      showStatus(error.message || "Could not update the order.");
    });
  }

  function render() {
    panel.innerHTML = "";
    publishBar.hidden = !password || tab === "orders";
    if (tab === "orders") renderOrders();
    else if (tab === "lounge") renderLounge();
    else if (tab === "home") renderHome();
    else renderList(tab);
    var help = document.getElementById("help");
    if (help) help.textContent = HELP[tab] || "";
    document.querySelectorAll(".tabs button").forEach(function (node) {
      node.setAttribute("aria-selected", node.dataset.tab === tab ? "true" : "false");
    });
    refreshPublish();
    var editor = panel.querySelector("form.editor");
    if (editor) editor.scrollIntoView({ block: "nearest" });
  }

  function ensureHome() {
    if (!draft.home || !Array.isArray(draft.home.media)) draft.home = { media: [] };
  }

  function renderHome() {
    ensureHome();
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Add a photo or a short video. Keep videos small. Then press the big button at the bottom so customers can see them.";
    panel.appendChild(note);

    var actions = document.createElement("div");
    actions.className = "row-actions";
    var photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*";
    photoInput.hidden = true;
    var videoInput = document.createElement("input");
    videoInput.type = "file";
    videoInput.accept = "video/mp4,video/webm,video/*";
    videoInput.hidden = true;
    var addPhoto = button("Add a photo", "home-pick-photo");
    var addVideo = button("Add a video", "home-pick-video");
    actions.appendChild(addPhoto);
    actions.appendChild(addVideo);
    panel.appendChild(actions);
    panel.appendChild(photoInput);
    panel.appendChild(videoInput);
    addPhoto.addEventListener("click", function () { photoInput.click(); });
    addVideo.addEventListener("click", function () { videoInput.click(); });
    photoInput.addEventListener("change", function () {
      if (photoInput.files && photoInput.files[0]) uploadHomeMedia("photo", photoInput.files[0]);
      photoInput.value = "";
    });
    videoInput.addEventListener("change", function () {
      if (videoInput.files && videoInput.files[0]) uploadHomeMedia("video", videoInput.files[0]);
      videoInput.value = "";
    });

    if (!draft.home.media.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No photos or videos yet. Press “Add a photo” or “Add a video”.";
      panel.appendChild(empty);
      return;
    }

    draft.home.media.forEach(function (item, index) {
      var row = document.createElement("div");
      row.className = "row";
      var preview;
      if (item.type === "video") {
        preview = document.createElement("video");
        preview.src = item.src;
        preview.controls = true;
        preview.playsInline = true;
        preview.muted = true;
        preview.className = "preview home-preview";
      } else {
        preview = document.createElement("img");
        preview.src = item.src;
        preview.alt = item.caption || "";
        preview.className = "preview home-preview";
      }
      row.appendChild(preview);
      var meta = document.createElement("div");
      meta.style.flex = "1";
      meta.innerHTML = "<strong>" + (item.type === "video" ? "Video" : "Photo") + "</strong>" +
        (item.caption ? "<p class='muted'>" + esc(item.caption) + "</p>" : "<p class='muted'>No caption</p>");
      row.appendChild(meta);
      var cap = input("caption-" + index, item.caption || "", "Caption (optional)");
      cap.addEventListener("change", function () {
        item.caption = String(cap.value || "").trim().slice(0, 80);
        refreshPublish();
      });
      row.appendChild(cap);
      row.appendChild(button("Delete this", "home-remove", index, "home", "warn"));
      panel.appendChild(row);
    });
  }

  function uploadHomeMedia(type, file) {
    ensureHome();
    if (draft.home.media.length >= 24) {
      showStatus("Remove an item before adding more.");
      return;
    }
    showStatus(type === "video" ? "Saving the video…" : "Saving the photo…");
    var send = type === "photo" ? compress(file) : Promise.resolve(file);
    send.then(function (blob) {
      return fetch("/api/home-media?type=" + encodeURIComponent(type), {
        method: "POST",
        headers: {
          "Content-Type": type === "video" ? (file.type || "video/mp4") : "image/jpeg",
          "Authorization": "Bearer " + password
        },
        body: blob
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          throw new Error((data && data.error) || ("Upload failed (" + res.status + "). Try again after a refresh."));
        }
        draft.home.media.unshift({
          id: data.id,
          type: data.type || type,
          src: data.src,
          caption: ""
        });
        showStatus("Saved here. Press “Show changes to customers” at the bottom.");
        render();
        return publishDraft();
      });
    }).catch(function (error) {
      showStatus(error.message || "The file was not saved.");
    });
  }

  function move(list, index, dir) {
    var item = list[index];
    var sibling = -1;
    var i;
    for (i = index + dir; i >= 0 && i < list.length; i += dir) {
      if (list[i].category === item.category) {
        sibling = i;
        break;
      }
    }
    if (sibling < 0) return;
    list[index] = list[sibling];
    list[sibling] = item;
    if (editing && editing.index === index) editing.index = sibling;
    else if (editing && editing.index === sibling) editing.index = index;
  }

  function listFor(kind) {
    return kind === "drinks" ? draft.drinks : draft.food;
  }

  function compress(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        var scale = Math.min(1, 900 / Math.max(image.width, image.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) reject(new Error("Use a photo from the phone."));
          else resolve(blob);
        }, "image/jpeg", 0.72);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Use a photo from the phone."));
      };
      image.src = url;
    });
  }

  function publishDraft() {
    publishBtn.disabled = true;
    showStatus("Sending the new menu to customers…");
    return fetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + password },
      body: JSON.stringify(draft)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "The menu did not update.");
        savedJson = snapshot(draft);
        if (data.github && data.github.ok) {
          showStatus("Done. Customers can see the new menu now.");
        } else if (data.github && data.github.error) {
          showStatus("Customers can see it. The extra save failed: " + data.github.error);
        } else {
          showStatus("Done. Customers can see the new menu now.");
        }
        refreshPublish();
      });
    }).catch(function (error) {
      showStatus(error.message || "The menu did not update. Try the button again.");
      refreshPublish();
    });
  }

  function uploadPhoto(item, file) {
    if (!item.id) item.id = uniqueId(item.name || "dish");
    var form = panel.querySelector("form.editor");
    stashFoodEditor(item, form);
    syncFoodImages(item);
    if (foodImages(item).length >= 3) {
      showStatus("This food already has 3 photos. Delete one first.");
      return;
    }
    var localUrl = URL.createObjectURL(file);
    showStatus("Saving the photo…");
    compress(file).then(function (blob) {
      return fetch("/api/photo?id=" + encodeURIComponent(item.id), {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", "Authorization": "Bearer " + password },
        body: blob
      });
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "The photo was not saved.");
        var list = foodImages(item);
        list.push(data.image);
        item.images = list.slice(0, 3);
        item.image = item.images[0] || "";
        if (item.share) delete item.share;
        URL.revokeObjectURL(localUrl);
        showStatus("Photo added. Press “Show changes to customers” at the bottom.");
        render();
        return publishDraft();
      });
    }).catch(function (error) {
      URL.revokeObjectURL(localUrl);
      showStatus(error.message || "The photo was not saved.");
    });
  }

  panel.addEventListener("click", function (event) {
    var node = event.target.closest("button");
    if (!node || !node.dataset.action) return;
    var action = node.dataset.action;
    var kind = node.dataset.kind || (editing && editing.kind) || tab;
    var index = node.dataset.index != null ? Number(node.dataset.index) : (editing ? editing.index : -1);
    if (action === "order-status") {
      setOrderStatus(index, kind);
      return;
    }
    if (action === "home-pick-photo" || action === "home-pick-video") {
      return;
    }
    if (action === "home-remove") {
      ensureHome();
      draft.home.media.splice(index, 1);
      showStatus("Deleted here. Press “Show changes to customers” at the bottom.");
      render();
      return;
    }
    if (action === "remove-photo") {
      if (!editing || editing.kind !== "food") return;
      var dish = draft.food[editing.index];
      if (!dish) return;
      stashFoodEditor(dish, panel.querySelector("form.editor"));
      var photos = foodImages(dish);
      if (index < 0 || index >= photos.length) return;
      photos.splice(index, 1);
      dish.images = photos;
      dish.image = photos[0] || "";
      showStatus("Photo deleted here. Press “Show changes to customers” at the bottom.");
      render();
      return;
    }
    if (action === "add-line") {
      var form = node.closest("form");
      var holder = form.querySelector(".lines");
      holder.appendChild(lineRow("", ""));
      return;
    }
    if (action === "done") {
      if (!commitOpen()) return;
      showStatus("Saved here. Press “Show changes to customers” at the bottom.");
      render();
      return;
    }
    if (action === "cancel") {
      if (editing) {
        var current = listFor(editing.kind)[editing.index];
        if (current && current._new) listFor(editing.kind).splice(editing.index, 1);
      }
      editing = null;
      render();
      return;
    }
    if (action === "add") {
      if (!commitOpen()) return;
      var created = kind === "drinks"
        ? { category: "Spirits", name: "", available: true, sizes: [{ name: "Bottle", price: "" }], _new: true }
        : { category: "Dishes", id: uniqueId("new-dish"), name: "", am: "", price: "", image: "", available: true, _new: true };
      listFor(kind).push(created);
      editing = { kind: kind, index: listFor(kind).length - 1 };
      tab = kind;
      render();
      return;
    }
    if (!commitOpen()) return;
    var list = listFor(kind);
    var item = list[index];
    if (!item) return;
    if (action === "edit") {
      editing = { kind: kind, index: index };
      render();
      return;
    }
    if (action === "soldout") {
      item.available = item.available === false;
      showStatus("Saved here. Press “Show changes to customers” at the bottom.");
      render();
      return;
    }
    if (action === "remove") {
      var label = item.name || "this item";
      if (!window.confirm("Delete " + label + "? Customers will not see it after you press the bottom button.")) return;
      list.splice(index, 1);
      editing = null;
      showStatus("Deleted here. Press “Show changes to customers” at the bottom.");
      render();
      return;
    }
    if (action === "up" || action === "down") {
      move(list, index, action === "up" ? -1 : 1);
      render();
    }
  });

  panel.addEventListener("change", function (event) {
    if (event.target.name === "multi") {
      var form = event.target.form;
      form.querySelector(".single").hidden = event.target.checked;
      form.querySelector(".many").hidden = !event.target.checked;
    }
    if (event.target.name === "photo" && event.target.files && event.target.files[0] && editing) {
      var item = draft.food[editing.index];
      uploadPhoto(item, event.target.files[0]);
      event.target.value = "";
    }
  });

  document.querySelectorAll(".tabs button").forEach(function (node) {
    node.addEventListener("click", function () {
      if (!commitOpen()) return;
      var problem = commitLounge();
      if (problem) {
        showStatus(problem);
        return;
      }
      tab = node.dataset.tab;
      if (tab === "orders") {
        loadOrders().then(render).catch(function (error) {
          showStatus(error.message || "Orders could not load.");
          render();
        });
        return;
      }
      render();
    });
  });

  publishBtn.addEventListener("click", function () {
    if (!commitOpen()) return;
    var problem = commitLounge();
    if (problem) {
      showStatus(problem);
      return;
    }
    render();
    publishDraft();
  });

  document.getElementById("logout").addEventListener("click", function () {
    password = "";
    sessionStorage.removeItem("sheger-staff");
    document.getElementById("app").hidden = true;
    document.getElementById("publish-bar").hidden = true;
    document.getElementById("login").hidden = false;
    document.getElementById("password").value = "";
    refreshPending();
  });

  function loadDraft() {
    return fetch("/api/menu", { cache: "no-store" }).then(function (res) {
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
      if (usable(data)) draft = data;
      else draft = JSON.parse(JSON.stringify(window.SHEGER_MENU));
      if (!draft.info) draft.info = JSON.parse(JSON.stringify(window.SHEGER_MENU.info || {}));
      ensureHome();
      savedJson = snapshot(draft);
      editing = null;
      render();
      showStatus("Customers still see the old menu until you press the button at the bottom.");
    });
  }

  function signIn(value) {
    return fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: value })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "Could not sign in.");
        password = value;
        sessionStorage.setItem("sheger-staff", value);
        document.getElementById("login").hidden = true;
        document.getElementById("app").hidden = false;
        document.getElementById("publish-bar").hidden = false;
        return loadDraft().then(function () {
          return loadOrders().then(function () {
            if (pendingCount(orders)) tab = "orders";
            render();
          });
        });
      });
    }).catch(function (error) {
      var message = error && error.name === "TypeError"
        ? "Open this from the website link, not from a saved file."
        : (error.message || "Could not sign in.");
      throw new Error(message);
    });
  }

  document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var box = document.getElementById("login-error");
    box.textContent = "";
    signIn(document.getElementById("password").value).catch(function (error) {
      box.textContent = error.message;
    });
  });

  var stored = sessionStorage.getItem("sheger-staff");
  if (stored) {
    signIn(stored).catch(function () {
      sessionStorage.removeItem("sheger-staff");
    });
  }
  refreshPending();
  setInterval(function () {
    if (password) loadOrders().then(function () {
      paintPending(pendingCount(orders));
      if (tab === "orders") render();
    }).catch(function () {});
    else refreshPending();
  }, 15000);
})();
