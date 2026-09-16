(() => {
  "use strict";

  const GA_ID = "G-9NGEH1G3CP";
  const YM_ID = 112491722;

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
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true
  });

  if (!document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js"]')) {
    const yandexTag = document.createElement("script");
    yandexTag.async = true;
    yandexTag.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.appendChild(yandexTag);
  }

  const pagePath = () => window.location.pathname || "/";

  const sendEvent = (name, parameters) => {
    const safeParameters = Object.assign({ page_path: pagePath() }, parameters || {});
    window.gtag("event", name, safeParameters);
    window.ym(YM_ID, "reachGoal", name, safeParameters);
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
    const element = event.target.closest("a,button");
    if (!element) return;

    const href = element.tagName === "A" ? element.getAttribute("href") : "";
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
      sendEvent("generate_lead", { contact_method: method });
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

  document.addEventListener("submit", (event) => {
    const form = event.target;
    sendEvent("generate_lead", {
      contact_method: "form",
      form_id: form && form.id ? form.id : "unnamed"
    });
  });
})();