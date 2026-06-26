import { signInWithPassword } from "./lib/hubApi.js?v=20260624u";

function normalizeTalentLoginEmail() {
  const input = document.querySelector('[data-login-form] input[name="email"]');
  if (!input) return "";
  input.value = String(input.value || "").trim().toLowerCase();
  return input.value;
}

function showLoginError(form, message) {
  const old = form.querySelector(".login-normalize-error");
  if (old) old.remove();
  const node = document.createElement("div");
  node.className = "form-error login-normalize-error";
  node.textContent = message;
  const firstLabel = form.querySelector("label");
  form.insertBefore(node, firstLabel || form.firstChild);
}

document.addEventListener("input", (event) => {
  if (event.target?.matches?.('[data-login-form] input[name="email"]')) {
    event.target.value = String(event.target.value || "").trimStart().toLowerCase();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target?.closest?.("[data-login-form]");
  if (!form) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const email = normalizeTalentLoginEmail();
  const password = String(new FormData(form).get("password") || "");
  const button = form.querySelector('button[type="submit"]');
  const originalText = button?.textContent || "Log in";

  if (button) {
    button.disabled = true;
    button.textContent = "Logging in...";
  }

  try {
    await signInWithPassword(email, password);
    window.location.hash = window.location.hash || "#home";
    window.location.reload();
  } catch (error) {
    showLoginError(form, error.message || "Login failed.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}, true);

new MutationObserver(normalizeTalentLoginEmail).observe(document.body, { childList: true, subtree: true });
setTimeout(normalizeTalentLoginEmail, 250);
