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

  // Figure out where this script file lives, so config.json can be
  // found relative to it (not relative to whatever page includes it).
  let scriptEl = document.currentScript;
  console.log(scriptEl, "scriptllll");

  let baseUrl = scriptEl ? scriptEl.src.replace(/[^/]+$/, "") : "./";
  console.log(baseUrl, "base");

  let CONFIG_URL = baseUrl + "config.json";

  console.log(CONFIG_URL, "CONFIG_URL");

  function loadConfig() {
    return fetch(CONFIG_URL).then(function (res) {
      return res.json();
    });
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
    banner.id = "cc-banner";
    banner.className = "cc-banner";
    banner.innerHTML =
      '<div class="cc-banner__content">' +
      '<h2 class="cc-banner__title"></h2>' +
      '<p class="cc-banner__message"></p>' +
      "</div>" +
      '<div class="cc-banner__actions">' +
      '<button type="button" class="cc-btn cc-btn--outline" id="cc-customise">Customise</button>' +
      '<button type="button" class="cc-btn cc-btn--solid" id="cc-reject">Reject All</button>' +
      '<button type="button" class="cc-btn cc-btn--solid" id="cc-accept">Accept All</button>' +
      "</div>";

    banner.querySelector(".cc-banner__title").textContent = config.banner.title;

    let messageEl = banner.querySelector(".cc-banner__message");
    messageEl.textContent = config.banner.message + " ";

    let link = document.createElement("a");
    link.href = config.banner.privacyPolicyUrl;
    link.className = "cc-banner__link";
    link.textContent = config.banner.privacyPolicyText;
    messageEl.appendChild(link);

    return banner;
  }

  function showBanner(config) {
    let banner = createBannerElement(config);
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

    banner
      .querySelector("#cc-customise")
      .addEventListener("click", function () {
        openPopup(config);
      });
  }

  function buildCategoryRow(cat, currentConsent) {
    var row = document.createElement("div");
    row.className = "cc-category";

    var checked = currentConsent ? !!currentConsent[cat.id] : !!cat.required;

    var toggleHtml;
    if (cat.required) {
      toggleHtml =
        '<span class="cc-category__always-active">Always Active</span>';
    } else {
      toggleHtml =
        '<label class="cc-toggle">' +
        '<input type="checkbox" data-category="' +
        cat.id +
        '" ' +
        (checked ? "checked" : "") +
        ">" +
        '<span class="cc-toggle__slider"></span>' +
        "</label>";
    }

    row.innerHTML =
      '<div class="cc-category__row">' +
      '<span><span class="cc-category__chevron">&#9656;</span>' +
      '<span class="cc-category__name"></span></span>' +
      toggleHtml +
      "</div>" +
      '<p class="cc-category__desc"></p>' +
      '<div class="cc-category__cookies"></div>';

    row.querySelector(".cc-category__name").textContent = cat.name;
    row.querySelector(".cc-category__desc").textContent = cat.description;

    var cookiesEl = row.querySelector(".cc-category__cookies");
    var chevronEl = row.querySelector(".cc-category__chevron");

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

    row
      .querySelector(".cc-category__row")
      .addEventListener("click", function (e) {
        if (e.target.closest(".cc-toggle")) return;
        cookiesEl.classList.toggle("cc-open");
        chevronEl.classList.toggle("cc-open");
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
    let overlay = document.getElementById("cc-overlay");
    if (overlay) overlay.remove();
  }

  function openPopup(config) {
    if (document.getElementById("cc-overlay")) return;

    let currentConsent = getConsent();

    let overlay = document.createElement("div");
    overlay.id = "cc-overlay";
    overlay.className = "cc-overlay";

    let popup = document.createElement("div");
    popup.className = "cc-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");

    popup.innerHTML =
      '<div class="cc-popup__header">' +
      "<h2>Customise Consent Preferences</h2>" +
      '<button type="button" class="cc-popup__close" aria-label="Close">&times;</button>' +
      "</div>" +
           '<div class="cc-popup__body">' +
        '<div class="cc-popup__intro">' +
          "<p>We use cookies to help you navigate efficiently and perform certain functions. You will find detailed information about all cookies under each consent category below.</p>" +
          '<div class="cc-popup__intro-more" style="display:none;">' +
            '<p>The cookies that are categorised as "Necessary" are stored on your browser as they are essential for enabling the basic functionalities of the site.</p>' +
            "<p>We also use third-party cookies that help us analyse how you use this website, store your preferences, and provide the content and advertisements that are relevant to you. These cookies will only be stored in your browser with your prior consent.</p>" +
            "<p>You can choose to enable or disable some or all of these cookies but disabling some of them may affect your browsing experience.</p>" +
          "</div>" +
          '<a class="cc-popup__intro-toggle">Show more</a>' +
        "</div>" +
      "</div>" +

      '<div class="cc-popup__footer">' +
      '<button type="button" class="cc-btn cc-btn--solid" id="cc-popup-reject">Reject All</button>' +
      '<button type="button" class="cc-btn cc-btn--solid" id="cc-popup-save">Save My Preferences</button>' +
      '<button type="button" class="cc-btn cc-btn--solid" id="cc-popup-accept">Accept All</button>' +
      "</div>";

    let body = popup.querySelector(".cc-popup__body");
    config.categories.forEach(function (cat) {
      body.appendChild(buildCategoryRow(cat, currentConsent));
    });

      popup
      .querySelector(".cc-popup__intro-toggle")
      .addEventListener("click", function (e) {
        var more = popup.querySelector(".cc-popup__intro-more");
        var isHidden = more.style.display === "none";
        more.style.display = isHidden ? "block" : "none";
        e.target.textContent = isHidden ? "Show less" : "Show more";
      });


    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    function finishWith(consentObj) {
      saveConsent(consentObj);
      closePopup();
      let banner = document.getElementById("cc-banner");
      if (banner) banner.remove();
      updateFloatingIcon();
    }

    popup
      .querySelector("#cc-popup-save")
      .addEventListener("click", function () {
        finishWith(readTogglesAsConsent(popup, config));
      });

    popup
      .querySelector("#cc-popup-accept")
      .addEventListener("click", function () {
        finishWith(allowAllConsent(config));
      });

    popup
      .querySelector("#cc-popup-reject")
      .addEventListener("click", function () {
        finishWith(necessaryOnlyConsent(config));
      });

    popup
      .querySelector(".cc-popup__close")
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

  function updateFloatingIcon() {
    let icon = document.getElementById("cc-floating-icon");
    if (!icon) return;
    icon.style.display = getConsent() ? "flex" : "none";
  }

  function setupFloatingIcon(config) {
    let icon = document.getElementById("cc-floating-icon");
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
