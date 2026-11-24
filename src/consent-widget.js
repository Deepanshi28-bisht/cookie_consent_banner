(function () {
  "use strict";

  let COOKIE_NAME = "cc_consent";
  let COOKIE_DAYS = 365;

  function setCookie(name, value, days) {
    let expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; expires=" +
      expires.toUTCString() +
      "; path=/; SameSite=Lax";
  }

  function getCookie(name) {
    let match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function deleteCookie(name) {
    document.cookie =
      name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }

  function getConsent() {
    let raw = getCookie(COOKIE_NAME);
    return raw ? JSON.parse(raw) : null;
  }

  function saveConsent(consentObj) {
    setCookie(COOKIE_NAME, JSON.stringify(consentObj), COOKIE_DAYS);
  }

  // Figure out where this script file lives, so config.json and the
  // stylesheet can be found relative to it (not relative to whatever
  // page includes it).
  let scriptEl = document.currentScript;
  let baseUrl = scriptEl ? scriptEl.src.replace(/[^/]+$/, "") : "./";
  let CONFIG_URL = baseUrl + "config.json";
  let CSS_URL = baseUrl + "cookie-banner.css";

  function loadConfig() {
    return fetch(CONFIG_URL).then(function (res) {
      return res.json();
    });
  }

  function loadStylesheet() {
    if (document.querySelector('link[href="' + CSS_URL + '"]')) return;
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function allowAllConsent(config) {
    let consent = {};
    config.categories.forEach(function (cat) {
      consent[cat.id] = true;
    });
    return consent;
  }

  function necessaryOnlyConsent(config) {
    let consent = {};
    config.categories.forEach(function (cat) {
      consent[cat.id] = !!cat.required;
    });
    return consent;
  }

  function createBannerElement(config) {
    let banner = document.createElement("div");
    banner.id = "cwgt-banner";
    banner.className = "cwgt-banner";
    banner.innerHTML =
      '<div class="cwgt-banner__content">' +
      '<h2 class="cwgt-banner__title"></h2>' +
      '<p class="cwgt-banner__message"></p>' +
      "</div>" +
      '<div class="cwgt-banner__actions">' +
      '<button type="button" class="cwgt-btn cwgt-btn--outline" id="cwgt-customise">Customise</button>' +
      '<button type="button" class="cwgt-btn cwgt-btn--solid" id="cwgt-reject">Reject All</button>' +
      '<button type="button" class="cwgt-btn cwgt-btn--solid" id="cwgt-accept">Accept All</button>' +
      "</div>";

    banner.querySelector(".cwgt-banner__title").textContent = config.banner.title;

    let messageEl = banner.querySelector(".cwgt-banner__message");
    messageEl.textContent = config.banner.message + " ";

    let link = document.createElement("a");
    link.href = config.banner.privacyPolicyUrl;
    link.className = "cwgt-banner__link";
    link.textContent = config.banner.privacyPolicyText;
    messageEl.appendChild(link);

    return banner;
  }

  function showBanner(config) {
    let banner = createBannerElement(config);
    document.body.appendChild(banner);

    banner.querySelector("#cwgt-accept").addEventListener("click", function () {
      saveConsent(allowAllConsent(config));
      banner.remove();
      updateFloatingIcon();
    });

    banner.querySelector("#cwgt-reject").addEventListener("click", function () {
      saveConsent(necessaryOnlyConsent(config));
      banner.remove();
      updateFloatingIcon();
    });

    banner
      .querySelector("#cwgt-customise")
      .addEventListener("click", function () {
        openPopup(config);
      });
  }

  function buildCategoryRow(cat, currentConsent) {
    var row = document.createElement("div");
    row.className = "cwgt-category";

    var checked = currentConsent ? !!currentConsent[cat.id] : !!cat.required;

    var toggleHtml;
    if (cat.required) {
      toggleHtml =
        '<span class="cwgt-category__always-active">Always Active</span>';
    } else {
      toggleHtml =
        '<label class="cwgt-toggle">' +
        '<input type="checkbox" data-category="' +
        cat.id +
        '" ' +
        (checked ? "checked" : "") +
        ">" +
        '<span class="cwgt-toggle__slider"></span>' +
        "</label>";
    }

    row.innerHTML =
      '<div class="cwgt-category__row">' +
      '<span><span class="cwgt-category__chevron">&#9656;</span>' +
      '<span class="cwgt-category__name"></span></span>' +
      toggleHtml +
      "</div>" +
      '<p class="cwgt-category__desc"></p>' +
      '<div class="cwgt-category__cookies"></div>';

    row.querySelector(".cwgt-category__name").textContent = cat.name;
    row.querySelector(".cwgt-category__desc").textContent = cat.description;

    var cookiesEl = row.querySelector(".cwgt-category__cookies");
    var chevronEl = row.querySelector(".cwgt-category__chevron");

    cat.cookies.forEach(function (cookie) {
      var cookieRow = document.createElement("div");
      cookieRow.className = "cwgt-cookie-row";
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

    row
      .querySelector(".cwgt-category__row")
      .addEventListener("click", function (e) {
        if (e.target.closest(".cwgt-toggle")) return;
        cookiesEl.classList.toggle("cwgt-open");
        chevronEl.classList.toggle("cwgt-open");
      });

    return row;
  }

  function readTogglesAsConsent(popup, config) {
    let consent = {};
    config.categories.forEach(function (cat) {
      let input = popup.querySelector('input[data-category="' + cat.id + '"]');
      consent[cat.id] = cat.required ? true : input.checked;
    });
    return consent;
  }

  function closePopup() {
    let overlay = document.getElementById("cwgt-overlay");
    if (overlay) overlay.remove();
  }

  function openPopup(config) {
    if (document.getElementById("cwgt-overlay")) return;

    let currentConsent = getConsent();

    let overlay = document.createElement("div");
    overlay.id = "cwgt-overlay";
    overlay.className = "cwgt-overlay";

    let popup = document.createElement("div");
    popup.className = "cwgt-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");

    popup.innerHTML =
      '<div class="cwgt-popup__header">' +
      "<h2>Customise Consent Preferences</h2>" +
      '<button type="button" class="cwgt-popup__close" aria-label="Close">&times;</button>' +
      "</div>" +
           '<div class="cwgt-popup__body">' +
        '<div class="cwgt-popup__intro">' +
          "<p>We use cookies to help you navigate efficiently and perform certain functions. You will find detailed information about all cookies under each consent category below.</p>" +
          '<div class="cwgt-popup__intro-more" style="display:none;">' +
            '<p>The cookies that are categorised as "Necessary" are stored on your browser as they are essential for enabling the basic functionalities of the site.</p>' +
            "<p>We also use third-party cookies that help us analyse how you use this website, store your preferences, and provide the content and advertisements that are relevant to you. These cookies will only be stored in your browser with your prior consent.</p>" +
            "<p>You can choose to enable or disable some or all of these cookies but disabling some of them may affect your browsing experience.</p>" +
          "</div>" +
          '<a class="cwgt-popup__intro-toggle">Show more</a>' +
        "</div>" +
      "</div>" +

      '<div class="cwgt-popup__footer">' +
      '<button type="button" class="cwgt-btn cwgt-btn--solid" id="cwgt-popup-reject">Reject All</button>' +
      '<button type="button" class="cwgt-btn cwgt-btn--solid" id="cwgt-popup-save">Save My Preferences</button>' +
      '<button type="button" class="cwgt-btn cwgt-btn--solid" id="cwgt-popup-accept">Accept All</button>' +
      "</div>";

    let body = popup.querySelector(".cwgt-popup__body");
    config.categories.forEach(function (cat) {
      body.appendChild(buildCategoryRow(cat, currentConsent));
    });

      popup
      .querySelector(".cwgt-popup__intro-toggle")
      .addEventListener("click", function (e) {
        var more = popup.querySelector(".cwgt-popup__intro-more");
        var isHidden = more.style.display === "none";
        more.style.display = isHidden ? "block" : "none";
        e.target.textContent = isHidden ? "Show less" : "Show more";
      });


    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    function finishWith(consentObj) {
      saveConsent(consentObj);
      closePopup();
      let banner = document.getElementById("cwgt-banner");
      if (banner) banner.remove();
      updateFloatingIcon();
    }

    popup
      .querySelector("#cwgt-popup-save")
      .addEventListener("click", function () {
        finishWith(readTogglesAsConsent(popup, config));
      });

    popup
      .querySelector("#cwgt-popup-accept")
      .addEventListener("click", function () {
        finishWith(allowAllConsent(config));
      });

    popup
      .querySelector("#cwgt-popup-reject")
      .addEventListener("click", function () {
        finishWith(necessaryOnlyConsent(config));
      });

    popup
      .querySelector(".cwgt-popup__close")
      .addEventListener("click", closePopup);

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

  function getOrCreateFloatingIcon() {
    let icon = document.getElementById("cwgt-floating-icon");
    if (icon) return icon;

    icon = document.createElement("button");
    icon.type = "button";
    icon.id = "cwgt-floating-icon";
    icon.className = "cwgt-floating-icon";
    icon.setAttribute("aria-label", "Cookie preferences");
    icon.style.display = "none";
    icon.textContent = "🍪";
    document.body.appendChild(icon);
    return icon;
  }

  function updateFloatingIcon() {
    let icon = getOrCreateFloatingIcon();
    icon.style.display = getConsent() ? "flex" : "none";
  }

  function setupFloatingIcon(config) {
    let icon = getOrCreateFloatingIcon();
    icon.addEventListener("click", function () {
      openPopup(config);
    });
  }

  function init() {
    loadStylesheet();
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
