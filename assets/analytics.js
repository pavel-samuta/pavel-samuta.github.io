(() => {
  "use strict";

  const GA_ID = "G-9NGEH1G3CP";
  const YM_ID = 112491722;
  const PRIMARY_LEAD_KEY = "ps_generate_lead_sent_at_v1";
  const PRIMARY_LEAD_WINDOW_MS = 30 * 60 * 1000;
  const PRIMARY_CONTACT_METHODS = new Set(["phone", "telegram", "whatsapp"]);
  let primaryLeadSentAt = 0;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: true,
    allow_google_signals: false
  });

  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    const googleTag = document.createElement("script");
    googleTag.async = true;
    googleTag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(googleTag);
  }

  window.ym = window.ym || function () {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = window.ym.l || Date.now();
  window.ym(YM_ID, "init", {
    ssr: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    referrer: document.referrer,
    url: window.location.href
  });

  if (!document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js"]')) {
    const yandexTag = document.createElement("script");
    yandexTag.async = true;
    yandexTag.src = "https://mc.yandex.ru/metrika/tag.js?id=" + encodeURIComponent(YM_ID);
    document.head.appendChild(yandexTag);
  }

  const setupMobileNavigation = () => {
    const nav = document.querySelector(".topbar .nav");
    if (!nav || nav.querySelector(".mobile-menu-toggle")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mobile-menu-toggle";
    toggle.setAttribute("aria-label", "Открыть меню");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";

    const brand = nav.querySelector(".brandmark");
    if (brand && brand.nextSibling) {
      nav.insertBefore(toggle, brand.nextSibling);
    } else {
      nav.appendChild(toggle);
    }

    const closeMenu = () => {
      nav.classList.remove("mobile-nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть меню");
      toggle.textContent = "☰";
    };

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("mobile-nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      toggle.textContent = open ? "×" : "☰";
    });

    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a[href]")) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 620) closeMenu();
    });
  };

  setupMobileNavigation();

  const pagePath = () => window.location.pathname || "/";

  const sendEvent = (name, parameters) => {
    const safeParameters = Object.assign({ page_path: pagePath() }, parameters || {});
    window.gtag("event", name, safeParameters);
    window.ym(YM_ID, "reachGoal", name, safeParameters);
  };

  const storedPrimaryLeadSentAt = () => {
    try {
      const value = Number(window.sessionStorage.getItem(PRIMARY_LEAD_KEY));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };

  const markPrimaryLeadSent = (sentAt) => {
    primaryLeadSentAt = sentAt;
    try {
      window.sessionStorage.setItem(PRIMARY_LEAD_KEY, String(sentAt));
    } catch {
      // In-memory deduplication still works when storage is unavailable.
    }
  };

  const sendPrimaryLeadOnce = (parameters) => {
    const now = Date.now();
    const lastSentAt = Math.max(primaryLeadSentAt, storedPrimaryLeadSentAt());

    if (lastSentAt && now - lastSentAt < PRIMARY_LEAD_WINDOW_MS) {
      return false;
    }

    markPrimaryLeadSent(now);
    sendEvent("generate_lead", parameters);
    return true;
  };

  const contactMethod = (url) => {
    const protocol = url.protocol.toLowerCase();
    const host = url.hostname.toLowerCase();

    if (protocol === "tel:") return "phone";
    if (protocol === "mailto:") return "email";
    if (host === "t.me" || host === "telegram.me") return "telegram";
    if (host === "wa.me" || host === "api.whatsapp.com" || host === "web.whatsapp.com") return "whatsapp";
    return "";
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const element = target.closest("a[href]");
    if (!element) return;

    const href = element.getAttribute("href");
    if (!href) return;

    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }

    const method = contactMethod(url);
    if (method) {
      sendEvent("contact_click", { contact_method: method });

      if (PRIMARY_CONTACT_METHODS.has(method)) {
        sendPrimaryLeadOnce({ contact_method: method });
      }
      return;
    }

    if (url.origin === window.location.origin && /^\/start\/?$/.test(url.pathname)) {
      sendEvent("begin_lead", { destination_path: url.pathname });
      return;
    }

    if (url.origin === window.location.origin && /^\/(?:en\/)?projects\/[^/]+\/?$/.test(url.pathname)) {
      sendEvent("select_content", {
        content_type: "case_study",
        item_id: url.pathname
      });
      return;
    }

    const downloadMatch = url.pathname.match(/\.([a-z0-9]{2,8})$/i);
    if (downloadMatch && /^(pdf|docx?|xlsx?|pptx?|zip|dwg|dxf|step|stp)$/i.test(downloadMatch[1])) {
      sendEvent("file_download", {
        file_extension: downloadMatch[1].toLowerCase(),
        file_name: url.pathname.split("/").pop()
      });
    }
  }, { passive: true });

  document.addEventListener("samuta:lead-success", (event) => {
    const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
      ? event.detail
      : {};

    sendPrimaryLeadOnce({
      contact_method: detail.contact_method || "form",
      form_id: detail.form_id || "unnamed"
    });
  });
})();