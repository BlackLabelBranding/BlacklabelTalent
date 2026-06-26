function normalizeTalentLoginEmail() {
  const input = document.querySelector('[data-login-form] input[name="email"]');
  if (!input) return;
  input.value = String(input.value || "").trim().toLowerCase();
}

document.addEventListener("input", (event) => {
  if (event.target?.matches?.('[data-login-form] input[name="email"]')) {
    event.target.value = String(event.target.value || "").trimStart().toLowerCase();
  }
});

document.addEventListener("submit", (event) => {
  if (!event.target?.closest?.("[data-login-form]")) return;
  normalizeTalentLoginEmail();
}, true);

new MutationObserver(normalizeTalentLoginEmail).observe(document.body, { childList: true, subtree: true });
setTimeout(normalizeTalentLoginEmail, 250);
