(function () {
  document.documentElement.classList.add("js");

  var navbar = document.getElementById("navbar");
  if (navbar) {
    var onScroll = function () {
      navbar.classList.toggle("scrolled", window.scrollY > 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var toggle = document.getElementById("nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  function closeMenu() {
    if (!mobileMenu || !toggle) return;
    mobileMenu.classList.remove("is-open");
    mobileMenu.classList.add("is-closed");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    toggle.focus();
  }
  function openMenu() {
    if (!mobileMenu || !toggle) return;
    mobileMenu.classList.remove("is-closed");
    mobileMenu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    var closeBtn = document.getElementById("nav-close");
    if (closeBtn) closeBtn.focus();
  }
  if (toggle && mobileMenu) {
    toggle.addEventListener("click", function () {
      if (mobileMenu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    var closeBtn = document.getElementById("nav-close");
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    var bg = mobileMenu.querySelector(".mm-bg");
    if (bg) bg.addEventListener("click", closeMenu);
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  var dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var dayNames = { sun: "domingo", mon: "lunes", tue: "martes", wed: "miércoles", thu: "jueves", fri: "viernes", sat: "sábado" };

  function guayaquilNow() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Guayaquil",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var wd = (map.weekday || "Mon").slice(0, 3).toLowerCase();
    var lookup = { sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat" };
    var key = lookup[wd] || "mon";
    var hour = parseInt(map.hour, 10);
    var minute = parseInt(map.minute, 10);
    return { key: key, minutes: hour * 60 + minute, index: dayKeys.indexOf(key) };
  }

  function parseRange(value) {
    if (!value) return null;
    var t = String(value).trim().toLowerCase();
    if (t === "cerrado" || t === "closed") return null;
    var m = String(value).match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    function pad(n) { return String(n).padStart(2, "0"); }
    return {
      start: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
      end: parseInt(m[3], 10) * 60 + parseInt(m[4], 10),
      startLabel: pad(m[1]) + ":" + m[2],
      endLabel: pad(m[3]) + ":" + m[4],
    };
  }

  function primaryVenue(payload) {
    if (!payload || !payload.venues) return null;
    return payload.venues.find(function (v) { return v.primary; }) || payload.venues[0];
  }

  function nextOpen(venue, fromIndex) {
    for (var i = 1; i <= 7; i++) {
      var idx = (fromIndex + i) % 7;
      var key = dayKeys[idx];
      var range = parseRange(venue.hours[key]);
      if (range) return { key: key, range: range, offset: i };
    }
    return null;
  }

  function statusText(payload) {
    var venue = primaryVenue(payload);
    if (!venue || !venue.hours) return null;
    var now = guayaquilNow();
    var today = parseRange(venue.hours[now.key]);
    if (today) {
      if (now.minutes < today.start) {
        return { open: false, text: "Abre hoy a las " + today.startLabel, line: "Hoy: " + today.startLabel + " a " + today.endLabel + " · " + (venue.short || venue.name) };
      }
      if (now.minutes >= today.end) {
        var n1 = nextOpen(venue, now.index);
        if (!n1) return { open: false, text: "Hoy cerrado", line: "Hoy cerrado en " + (venue.short || venue.name) };
        if (n1.offset === 1) return { open: false, text: "Hoy cerrado · abre mañana " + n1.range.startLabel, line: "Hoy cerrado en " + (venue.short || venue.name) };
        return { open: false, text: "Hoy cerrado · abre " + dayNames[n1.key] + " " + n1.range.startLabel, line: "Hoy cerrado en " + (venue.short || venue.name) };
      }
      if (today.end - now.minutes < 60) {
        return { open: true, text: "Cierra pronto · " + today.endLabel, line: "Hoy: " + today.startLabel + " a " + today.endLabel + " · " + (venue.short || venue.name) };
      }
      return { open: true, text: "Abierto ahora · hasta " + today.endLabel, line: "Hoy: " + today.startLabel + " a " + today.endLabel + " · " + (venue.short || venue.name) };
    }
    var n = nextOpen(venue, now.index);
    if (!n) return { open: false, text: "Hoy cerrado", line: "Hoy cerrado en " + (venue.short || venue.name) };
    if (now.key === "mon" && n.key === "tue") {
      return { open: false, text: "Lunes cerrado · abre martes " + n.range.startLabel, line: "Hoy cerrado en " + (venue.short || venue.name) };
    }
    if (n.offset === 1) {
      return { open: false, text: "Hoy cerrado · abre mañana " + n.range.startLabel, line: "Hoy cerrado en " + (venue.short || venue.name) };
    }
    return { open: false, text: "Hoy cerrado · abre " + dayNames[n.key] + " " + n.range.startLabel, line: "Hoy cerrado en " + (venue.short || venue.name) };
  }

  var hoursPayload = {};
  try { hoursPayload = JSON.parse(document.body.getAttribute("data-hours") || "{}"); } catch (e) { hoursPayload = {}; }

  var status = statusText(hoursPayload);
  var badge = document.getElementById("open-status");
  if (badge && status) {
    badge.textContent = status.text;
    var dot = badge.previousElementSibling;
    if (dot && dot.classList.contains("dot")) dot.classList.toggle("is-open", status.open);
  }
  var mmToday = document.getElementById("mm-today");
  if (mmToday && status) mmToday.textContent = status.line;

  var todayKey = guayaquilNow().key;
  document.querySelectorAll(".rows li[data-days]").forEach(function (li) {
    if ((li.getAttribute("data-days") || "").split(" ").indexOf(todayKey) !== -1) {
      li.classList.add("is-today");
    }
  });

  var hero = document.getElementById("hero");
  var footer = document.getElementById("footer");
  var sticky = document.getElementById("sticky-cta");
  if (hero && sticky && "IntersectionObserver" in window && window.matchMedia("(max-width: 899px)").matches) {
    document.body.classList.add("has-sticky");
    var heroGone = false;
    var footerIn = false;
    function syncSticky() {
      var show = heroGone && !footerIn;
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", String(!show));
      var a = sticky.querySelector("a");
      if (a) a.tabIndex = show ? 0 : -1;
    }
    new IntersectionObserver(function (entries) {
      heroGone = !entries[0].isIntersecting;
      syncSticky();
    }, { threshold: 0 }).observe(hero);
    if (footer) {
      new IntersectionObserver(function (entries) {
        footerIn = entries[0].isIntersecting;
        syncSticky();
      }, { threshold: 0 }).observe(footer);
    }
  }

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("revealed"); });
  }
})();
