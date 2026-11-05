(() => {
  "use strict";
  const form = document.getElementById("engineering-lead-form");
  if (!form) return;
  const status = document.getElementById("request-feedback");
  const source = new URLSearchParams(location.search).get("service");
  const select = form.elements.namedItem("service");
  const options = {
    "reverse-engineering": "Реверс-инжиниринг детали или узла",
    "design-documentation-recovery": "Разработка или восстановление КД",
    "industrial-localization": "Локализация импортной детали",
    "equipment-modernization": "Модернизация оборудования",
    "supplier-technical-assessment": "Оценка поставщика или FAT",
    "fat-equipment-acceptance": "Оценка поставщика или FAT",
    "manufacturing-cost-reduction": "Анализ себестоимости изделия",
    "critical-spare-parts": "Реверс-инжиниринг детали или узла"
  };
  if (source && options[source] && select) select.value = options[source];
  const getMessage = () => {
    if (!form.reportValidity()) return null;
    const data = new FormData(form);
    return [
      "Здравствуйте, Павел Александрович!",
      "Прошу предварительно оценить инженерную задачу.",
      "",
      "Направление: " + String(data.get("service") || ""),
      "Срок: " + String(data.get("timing") || ""),
      "Задача и результат: " + String(data.get("problem") || "").trim(),
      "Предприятие и контакт: " + String(data.get("contact") || "").trim(),
      "",
      "Отправлено со страницы: " + location.href.split("#")[0]
    ].join("\n");
  };
  const notify = (method) => {
    if (status) status.textContent = "Откроется " + method + ". Проверьте текст и нажмите «Отправить» в приложении. Сообщение не отправлено автоматически.";
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = getMessage();
    if (!message) return;
    const subject = "Инженерная задача: " + (select ? select.value : "проект");
    notify("почтовое приложение");
    location.href = "mailto:pavelsamuta@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(message);
  });
  const wa = document.getElementById("request-whatsapp");
  if (wa) wa.addEventListener("click", () => {
    const message = getMessage();
    if (!message) return;
    notify("WhatsApp");
    const url = "https://wa.me/375292766270?text=" + encodeURIComponent(message);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) location.href = url;
  });
})();