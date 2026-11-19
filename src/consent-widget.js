(function () {
  "use strict";

  var COOKIE_NAME = "cc_consent";
  var COOKIE_DAYS = 365;

  function setCookie(name, value, days) {
    var expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      "; expires=" + expires.toUTCString() +
      "; path=/; SameSite=Lax";
  }

  function getCookie(name) {
    var match = document.cookie.match(
      new RegExp("(^|; )" + name + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }

  function getConsent() {
    var raw = getCookie(COOKIE_NAME);
    return raw ? JSON.parse(raw) : null;
  }

  function saveConsent(consentObj) {
    setCookie(COOKIE_NAME, JSON.stringify(consentObj), COOKIE_DAYS);
  }

  // Figure out where this script file lives, so config.json can be
  // found relative to it (not relative to whatever page includes it).
  var scriptEl = document.currentScript;
  var baseUrl = scriptEl ? scriptEl.src.replace(/[^/]+$/, "") : "./";
  var CONFIG_URL = baseUrl + "config.json";

  function loadConfig() {
    return fetch(CONFIG_URL).then(function (res) {
      return res.json();
    });
  }

  function allowAllConsent(config) {
    var consent = {};
    config.categories.forEach(function (cat) {
      consent[cat.id] = true;
    });
    return consent;
  }

  function necessaryOnlyConsent(config) {
    var consent = {};
    config.categories.forEach(function (cat) {
      consent[cat.id] = !!cat.required;
    });
    return consent;
  }

  function createBannerElement(config) {
    var banner = document.createElement("div");
    banner.id = "cc-banner";
    banner.className = "cc-banner";
    banner.innerHTML =
      '<div class="cc-banner__content">' +
        '<h2 class="cc-banner__title"></h2>' +
        '<p class="cc-banner__message"></p>' +
      "</div>" +
      '<div class="cc-banner__actions">' +
        '<button type="button" class="cc-btn cc-btn--outline" id="cc-customise">Customise</button>' +
        '<button type="button" class="cc-btn cc-btn--outline" id="cc-reject">Reject All</button>' +
        '<button type="button" class="cc-btn cc-btn--solid" id="cc-accept">Accept All</button>' +
      "</div>";

    banner.querySelector(".cc-banner__title").textContent = config.banner.title;

    var messageEl = banner.querySelector(".cc-banner__message");
    messageEl.textContent = config.banner.message + " ";

    var link = document.createElement("a");
    link.href = config.banner.privacyPolicyUrl;
    link.className = "cc-banner__link";
    link.textContent = config.banner.privacyPolicyText;
    messageEl.appendChild(link);

    return banner;
  }

  function showBanner(config) {
    var banner = createBannerElement(config);
    document.body.appendChild(banner);

       banner.querySelector("#cc-accept").addEventListener("click", function () {
      saveConsent(allowAllConsent(config));
      banner.remove();
      updateFloatingIcon();
    });

    banner.querySelector("#cc-reject").addEventListener("click", function () {
      saveConsent(necessaryOnlyConsent(config));
      banner.remove();
      updateFloatingIcon();
    });


      banner.querySelector("#cc-customise").addEventListener("click", function () {
      openPopup(config);
    });

  }

  function buildCategoryRow(cat, currentConsent) {
    var row = document.createElement("div");
    row.className = "cc-category";

    var checked = currentConsent ? !!currentConsent[cat.id] : !!cat.required;
    var disabledAttr = cat.required ? "disabled" : "";

    row.innerHTML =
      '<div class="cc-category__row">' +
        '<span class="cc-category__name"></span>' +
        '<label class="cc-toggle">' +
          '<input type="checkbox" data-category="' + cat.id + '" ' +
            (checked ? "checked " : "") + disabledAttr + ">" +
          '<span class="cc-toggle__slider"></span>' +
        "</label>" +
      "</div>" +
      '<p class="cc-category__desc"></p>' +
      '<div class="cc-category__cookies"></div>';

    row.querySelector(".cc-category__name").textContent = cat.name;
    row.querySelector(".cc-category__desc").textContent = cat.description;

    var cookiesEl = row.querySelector(".cc-category__cookies");
    cat.cookies.forEach(function (cookie) {
      var cookieRow = document.createElement("div");
      cookieRow.className = "cc-cookie-row";
      cookieRow.innerHTML =
        "<div><strong>Name:</strong> </div>" +
        "<div><strong>Duration:</strong> </div>" +
        "<div><strong>Description:</strong> </div>";
      var fields = cookieRow.querySelectorAll("div");
      fields[0].appendChild(document.createTextNode(cookie.name));
      fields[1].appendChild(document.createTextNode(cookie.duration));
      fields[2].appendChild(document.createTextNode(cookie.description));
      cookiesEl.appendChild(cookieRow);
    });

    // Clicking the row (but not the toggle itself) expands/collapses cookies
    row.querySelector(".cc-category__row").addEventListener("click", function (e) {
      if (e.target.closest(".cc-toggle")) return;
      cookiesEl.classList.toggle("cc-open");
    });

    return row;
  }

  function readTogglesAsConsent(popup, config) {
    var consent = {};
    config.categories.forEach(function (cat) {
      var input = popup.querySelector('input[data-category="' + cat.id + '"]');
      consent[cat.id] = cat.required ? true : input.checked;
    });
    return consent;
  }

  function closePopup() {
    var overlay = document.getElementById("cc-overlay");
    if (overlay) overlay.remove();
  }

  function openPopup(config) {
    if (document.getElementById("cc-overlay")) return;

    var currentConsent = getConsent();

    var overlay = document.createElement("div");
    overlay.id = "cc-overlay";
    overlay.className = "cc-overlay";

    var popup = document.createElement("div");
    popup.className = "cc-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");

    popup.innerHTML =
      '<div class="cc-popup__header">' +
        "<h2>Cookie Preferences</h2>" +
        '<button type="button" class="cc-popup__close" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div class="cc-popup__body"></div>' +
      '<div class="cc-popup__footer">' +
        '<button type="button" class="cc-btn cc-btn--outline" id="cc-popup-reject">Reject All</button>' +
        '<button type="button" class="cc-btn cc-btn--outline" id="cc-popup-save">Save My Preferences</button>' +
        '<button type="button" class="cc-btn cc-btn--solid" id="cc-popup-accept">Accept All</button>' +
      "</div>";

    var body = popup.querySelector(".cc-popup__body");
    config.categories.forEach(function (cat) {
      body.appendChild(buildCategoryRow(cat, currentConsent));
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    function finishWith(consentObj) {
      saveConsent(consentObj);
      closePopup();
      var banner = document.getElementById("cc-banner");
      if (banner) banner.remove();
      updateFloatingIcon();
    }

    popup.querySelector("#cc-popup-save").addEventListener("click", function () {
      finishWith(readTogglesAsConsent(popup, config));
    });

    popup.querySelector("#cc-popup-accept").addEventListener("click", function () {
      finishWith(allowAllConsent(config));
    });

    popup.querySelector("#cc-popup-reject").addEventListener("click", function () {
      finishWith(necessaryOnlyConsent(config));
    });

    popup.querySelector(".cc-popup__close").addEventListener("click", closePopup);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePopup();
    });

    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        closePopup();
        document.removeEventListener("keydown", escHandler);
      }
    });
  }


   function updateFloatingIcon() {
    var icon = document.getElementById("cc-floating-icon");
    if (!icon) return;
    icon.style.display = getConsent() ? "flex" : "none";
  }

  function setupFloatingIcon(config) {
    var icon = document.getElementById("cc-floating-icon");
    if (!icon) return;
    icon.addEventListener("click", function () {
      openPopup(config);
    });
  }

  function init() {
    loadConfig().then(function (config) {
      if (!getConsent()) {
        showBanner(config);
      }
      setupFloatingIcon(config);
      updateFloatingIcon();
    });
  }


  document.addEventListener("DOMContentLoaded", init);


})();
