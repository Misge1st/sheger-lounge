(function () {
  var FOOD_CATS = ["Meats", "Dishes", "Fasting"];
  var DRINK_CATS = ["Spirits", "Soft drinks"];
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
    loginAlertText.textContent = count ? "Sign in to open them." : "";
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
      choice.textContent = option;
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
    itemName.placeholder = "Name";
    itemName.maxLength = 40;
    var itemPrice = document.createElement("input");
    itemPrice.setAttribute("data-price", "");
    itemPrice.value = price || "";
    itemPrice.placeholder = "Price";
    itemPrice.inputMode = "decimal";
    itemPrice.maxLength = 12;
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Remove";
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
    if (!lines.length) return "Add a price.";
    for (var i = 0; i < lines.length; i += 1) {
      if (!lines[i].name || !formatPrice(lines[i].price)) return "Each price needs a name and an amount.";
    }
    return "";
  }

  function priced(lines) {
    return lines.map(function (line) {
      return { name: line.name, price: formatPrice(line.price) };
    });
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

  function foodEditor(item) {
    var form = document.createElement("form");
    form.className = "editor";
    if (item.image) {
      var preview = document.createElement("img");
      preview.className = "preview";
      preview.alt = "";
      preview.src = item.image;
      form.appendChild(preview);
    }
    form.appendChild(field("Name", input("name", item.name, "Chicken pasta")));
    form.appendChild(field("Amharic name", input("am", item.am, "")));
    form.appendChild(field("Category", select("category", FOOD_CATS, item.category || "Dishes")));
    form.appendChild(check("available", "Available for customers", item.available !== false));
    form.appendChild(check("feature", "Highlight this dish", item.feature === true));
    var multi = check("multi", "More than one price", !!item.sizes);
    form.appendChild(multi);
    var single = document.createElement("div");
    single.className = "single";
    single.hidden = !!item.sizes;
    single.appendChild(field("Price", input("price", item.price, "350")));
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
    many.appendChild(button("Add price", "add-line"));
    form.appendChild(many);
    var photo = document.createElement("input");
    photo.type = "file";
    photo.name = "photo";
    photo.accept = "image/*";
    form.appendChild(field("Photo", photo));
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Done", "done"));
    actions.appendChild(button("Cancel", "cancel", null, null, "ghost"));
    form.appendChild(actions);
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    return form;
  }

  function drinkEditor(item) {
    var form = document.createElement("form");
    form.className = "editor";
    form.appendChild(field("Name", input("name", item.name, "Black Label")));
    form.appendChild(field("Category", select("category", DRINK_CATS, item.category || "Spirits")));
    form.appendChild(check("available", "Available for customers", item.available !== false));
    var lines = document.createElement("div");
    lines.className = "lines";
    var source = item.sizes || item.rows || [{ name: "Bottle", price: "" }];
    source.forEach(function (line) { lines.appendChild(lineRow(line.name, line.price)); });
    form.appendChild(lines);
    form.appendChild(button("Add price", "add-line"));
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Done", "done"));
    actions.appendChild(button("Cancel", "cancel", null, null, "ghost"));
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
      off.textContent = "Unavailable";
      row.appendChild(off);
    }
    var prices = document.createElement("p");
    prices.textContent = priceLabel(item);
    row.appendChild(prices);
    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(button("Edit", "edit", index, kind));
    actions.appendChild(button(item.available === false ? "Mark available" : "Sold out", "soldout", index, kind, "ghost"));
    actions.appendChild(button("Remove", "remove", index, kind, "warn"));
    actions.appendChild(button("Up", "up", index, kind, "ghost"));
    actions.appendChild(button("Down", "down", index, kind, "ghost"));
    row.appendChild(actions);
    return row;
  }

  function renderList(kind) {
    var cats = kind === "food" ? FOOD_CATS : DRINK_CATS;
    var list = kind === "food" ? draft.food : draft.drinks;
    cats.forEach(function (cat) {
      var heading = document.createElement("h2");
      heading.textContent = cat;
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
    panel.appendChild(button(kind === "food" ? "Add food" : "Add drink", "add", null, kind));
  }

  function renderLounge() {
    var info = draft.info || {};
    var phones = info.phones || [];
    var form = document.createElement("form");
    form.className = "lounge";
    form.appendChild(field("Address", (function () {
      var box = document.createElement("textarea");
      box.name = "address";
      box.maxLength = 180;
      box.value = info.address || "";
      return box;
    })()));
    form.appendChild(field("Google Maps link", input("maps", info.maps, "https://")));
    form.appendChild(field("Delivery phone 1", input("phone1", phones[0], "")));
    form.appendChild(field("Delivery phone 2", input("phone2", phones[1], "")));
    form.appendChild(field("TikTok", input("tiktok", info.tiktok, "@sheger_kurt")));
    form.appendChild(field("Delivery fee (ETB)", input("deliveryFee", info.deliveryFee || "100", "100")));
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Press Publish to show these details on the customer menu.";
    form.appendChild(note);
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    panel.appendChild(form);
  }

  function refreshPublish() {
    publishBtn.disabled = false;
    publishBtn.textContent = "Publish";
  }

  function renderOrders() {
    if (!orders.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No orders yet.";
      panel.appendChild(empty);
      return;
    }
    orders.forEach(function (order) {
      var card = document.createElement("article");
      card.className = "order-card" + (order.status === "new" ? " new" : "");
      var title = document.createElement("h3");
      title.textContent = "Order #" + order.id + " · " + String(order.status || "new").toUpperCase();
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
        "<div>Delivery: " + formatMoney(order.deliveryFee) + "</div>" +
        "<div><strong>TOTAL: " + formatMoney(order.total) + "</strong></div>";
      card.appendChild(money);
      var actions = document.createElement("div");
      actions.className = "row-actions";
      if (order.status === "new") actions.appendChild(button("Accept", "order-status", order.id, "accepted"));
      if (order.status === "new" || order.status === "accepted") actions.appendChild(button("Done", "order-status", order.id, "done"));
      if (order.status !== "cancelled" && order.status !== "done") actions.appendChild(button("Cancel", "order-status", order.id, "cancelled", "warn"));
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
    else renderList(tab);
    document.querySelectorAll(".tabs button").forEach(function (node) {
      node.setAttribute("aria-selected", node.dataset.tab === tab ? "true" : "false");
    });
    refreshPublish();
    var editor = panel.querySelector("form.editor");
    if (editor) editor.scrollIntoView({ block: "nearest" });
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
    showStatus("Publishing…");
    return fetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + password },
      body: JSON.stringify(draft)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "The menu was not published.");
        savedJson = snapshot(draft);
        if (data.github && data.github.ok) {
          showStatus("Published. Customers can see this menu. Also saved on GitHub.");
        } else if (data.github && data.github.error) {
          showStatus("Published for customers. GitHub sync failed: " + data.github.error);
        } else if (data.github && data.github.skipped) {
          showStatus("Published. Customers can see this menu. (Add GITHUB_TOKEN on Netlify to sync GitHub.)");
        } else {
          showStatus("Published. Customers can see this menu.");
        }
        refreshPublish();
      });
    }).catch(function (error) {
      showStatus(error.message || "The menu was not published.");
      refreshPublish();
    });
  }

  function uploadPhoto(item, file, preview) {
    if (!item.id) item.id = uniqueId(item.name || "dish");
    if (!preview) {
      preview = document.createElement("img");
      preview.className = "preview";
      preview.alt = "";
      var form = panel.querySelector("form.editor");
      if (form) form.insertBefore(preview, form.firstChild);
    }
    var localUrl = URL.createObjectURL(file);
    preview.src = localUrl;
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
        item.image = data.image;
        if (item.share) delete item.share;
        if (preview) preview.src = data.image;
        URL.revokeObjectURL(localUrl);
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
    if (action === "add-line") {
      var form = node.closest("form");
      var holder = form.querySelector(".lines");
      holder.appendChild(lineRow("", ""));
      return;
    }
    if (action === "done") {
      if (!commitOpen()) return;
      showStatus("Saved on this page. Press Publish for customers.");
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
      showStatus("Saved on this page. Press Publish for customers.");
      render();
      return;
    }
    if (action === "remove") {
      var label = item.name || "this item";
      if (!window.confirm("Remove " + label + "?")) return;
      list.splice(index, 1);
      editing = null;
      showStatus("Removed on this page. Press Publish for customers.");
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
      var preview = event.target.form.querySelector(".preview");
      uploadPhoto(item, event.target.files[0], preview);
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
      savedJson = snapshot(draft);
      editing = null;
      render();
      showStatus("Customers see the menu after you press Publish.");
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
        ? "Open this page from the lounge website, not as a saved file."
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
