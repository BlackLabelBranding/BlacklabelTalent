const LOCAL_AVAILABILITY_KEY = "blacklabel.talent.localAvailability";
const SESSION_KEY = "blacklabel.talent.session";
const NOTIFICATION_KEY = "blacklabel.talent.notificationsEnabled";
const SUPABASE_URL = globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";
const SUPABASE_ANON_KEY = globalThis.BLACK_LABEL_SUPABASE_ANON_KEY || "";

const NOT_AVAILABLE_OPTIONS = [
  "Alcohol",
  "Bars / Nightlife",
  "Swimwear",
  "Lingerie",
  "Travel",
  "Outdoor Events",
  "Private Events",
  "Last Minute Calls",
  "Content Shoots",
  "Trade Shows",
  "Brand Ambassador",
  "Modeling",
  "Driving",
  "Labor / Setup",
  "Manual Labor",
  "Heavy Lifting",
  "Loading / Unloading"
];

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function authHeaders(session = readSession()) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

function readLocalAvailability() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_AVAILABILITY_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalAvailability(items) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.id || item.date}-${item.label}-${item.title}-${item.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  localStorage.setItem(LOCAL_AVAILABILITY_KEY, JSON.stringify(unique.slice(-250)));
}

function dateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function monthKeyFromHeading() {
  const heading = document.querySelector(".calendar-panel .section-head h2")?.textContent?.trim();
  if (!heading) return "";
  const parsed = new Date(`${heading} 1`);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function toneForStatus(status) {
  return {
    available: "open",
    preferred: "open",
    tentative: "hold",
    unavailable: "blocked",
    vacation: "blocked"
  }[String(status || "").toLowerCase()] || "blocked";
}

function normalizeAvailabilityRow(item, source = "talent_portal_remote") {
  const status = item.status || "unavailable";
  return {
    id: item.id || `${item.starts_at}-${item.status}`,
    date: dateKey(item.starts_at),
    label: titleCase(status),
    title: item.notes || titleCase(status),
    tone: toneForStatus(status),
    source,
    savedAt: item.created_at || new Date().toISOString()
  };
}

function decorateCalendarFromAvailability() {
  const grid = document.querySelector(".month-grid");
  if (!grid) return;
  const monthKey = monthKeyFromHeading();
  if (!monthKey) return;

  const items = readLocalAvailability().filter((item) => item.date?.startsWith(monthKey));
  const buttons = [...grid.querySelectorAll(".calendar-day:not(.empty)")];

  items.forEach((item) => {
    const dayNumber = Number(item.date.slice(-2));
    const button = buttons.find((node) => Number(node.querySelector("strong")?.textContent) === dayNumber);
    if (!button) return;

    button.classList.add(item.tone || "blocked");
    button.dataset.hasAvailability = "true";

    const text = `${item.label}: ${item.title}`;
    const existingText = button.textContent || "";
    if (existingText.includes(text)) return;

    const currentLabel = button.querySelector("span");
    const currentSmall = button.querySelector("small");
    if (!currentLabel) {
      button.insertAdjacentHTML("beforeend", `<span>${item.label}</span><small>${item.title}</small>`);
    } else if (currentSmall) {
      currentSmall.textContent = `${currentSmall.textContent} • ${text}`;
    } else {
      button.insertAdjacentHTML("beforeend", `<small>${text}</small>`);
    }
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? null : response.json();
}

async function loadRemoteAvailabilityIntoCalendar() {
  const session = readSession();
  if (!session?.access_token) return;
  try {
    const user = await fetchJson("/auth/v1/user", { headers: authHeaders(session) });
    const members = await fetchJson(`/rest/v1/team_members?or=(user_id.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(user.email || "")})&select=id&limit=1`);
    const teamMemberId = members?.[0]?.id;
    if (!teamMemberId) return;

    const rows = await fetchJson(`/rest/v1/talent_availability?team_member_id=eq.${teamMemberId}&select=*&order=starts_at.asc&limit=250`);
    const remoteItems = (rows || []).map((row) => normalizeAvailabilityRow(row)).filter((item) => item.date);
    const localOnly = readLocalAvailability().filter((item) => item.source !== "talent_portal_remote");
    writeLocalAvailability([...localOnly, ...remoteItems]);
    decorateCalendarFromAvailability();
  } catch (error) {
    console.warn("Availability calendar sync skipped", error);
  }
}

function buildNotAvailableControls() {
  const input = document.querySelector('input[name="not_available_for"]');
  if (!input || input.dataset.enhanced === "true") return;
  input.dataset.enhanced = "true";
  input.type = "hidden";

  const selected = new Set(
    input.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const wrapper = document.createElement("div");
  wrapper.className = "not-available-grid";
  wrapper.innerHTML = NOT_AVAILABLE_OPTIONS.map((option) => `
    <label class="check-chip">
      <input type="checkbox" value="${option.replaceAll('"', '&quot;')}" ${selected.has(option) ? "checked" : ""} />
      <span>${option}</span>
    </label>
  `).join("");

  input.closest("label")?.appendChild(wrapper);
}

function syncNotAvailableInput() {
  const input = document.querySelector('input[name="not_available_for"]');
  const grid = document.querySelector(".not-available-grid");
  if (!input || !grid) return;
  input.value = [...grid.querySelectorAll('input[type="checkbox"]:checked')].map((box) => box.value).join(", ");
}

function insertPasswordPanel() {
  const profileGrid = document.querySelector(".editable-profile-grid");
  if (!profileGrid || document.querySelector("[data-password-panel]")) return;

  const panel = document.createElement("article");
  panel.className = "panel profile-panel account-security-panel";
  panel.dataset.passwordPanel = "true";
  panel.innerHTML = `
    <p class="mini-label">Account security</p>
    <h2>Change password</h2>
    <form class="talent-form compact-form" data-password-form>
      <label>New password<input name="new_password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <label>Confirm password<input name="confirm_password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <button class="button button-secondary full-width" type="submit">Update password</button>
    </form>
    <p class="security-note">This changes the password for the currently signed-in Talent account.</p>
  `;
  profileGrid.appendChild(panel);
}

function insertNotificationPanel() {
  const profileGrid = document.querySelector(".editable-profile-grid");
  if (!profileGrid || document.querySelector("[data-notification-panel]")) return;

  const supported = "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";
  const enabled = localStorage.getItem(NOTIFICATION_KEY) === "true";

  const panel = document.createElement("article");
  panel.className = "panel profile-panel notification-panel";
  panel.dataset.notificationPanel = "true";
  panel.innerHTML = `
    <p class="mini-label">Phone app notifications</p>
    <h2>Notifications</h2>
    <p class="security-note">Enable PWA notifications for booking and availability alerts. Remote push will require a server-side push worker next.</p>
    <button class="button button-secondary full-width" type="button" data-enable-notifications>${enabled ? "Notifications enabled" : "Enable notifications"}</button>
    <p class="security-note">Current permission: ${permission}</p>
  `;
  profileGrid.appendChild(panel);
}

async function updatePassword(newPassword) {
  const session = readSession();
  if (!session?.access_token) throw new Error("You must be signed in to change your password.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders(session),
    body: JSON.stringify({ password: newPassword })
  });
  if (!response.ok) throw new Error("Password update failed. Please sign out and back in, then try again.");
  return response.json();
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    navigator.serviceWorker?.ready
      ?.then((registration) => registration.showNotification(title, { body, icon: "./icons/icon-192.png", badge: "./icons/favicon-32.png" }))
      .catch(() => new Notification(title, { body }));
  } catch {
    try { new Notification(title, { body }); } catch {}
  }
}

function enhanceProfile() {
  buildNotAvailableControls();
  insertPasswordPanel();
  insertNotificationPanel();
  decorateCalendarFromAvailability();
}

const observer = new MutationObserver(() => enhanceProfile());
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("change", (event) => {
  if (event.target.closest(".not-available-grid")) syncNotAvailableInput();
});

document.addEventListener("submit", async (event) => {
  const passwordForm = event.target.closest("[data-password-form]");
  if (passwordForm) {
    event.preventDefault();
    const formData = new FormData(passwordForm);
    const password = String(formData.get("new_password") || "");
    const confirm = String(formData.get("confirm_password") || "");
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    try {
      await updatePassword(password);
      passwordForm.reset();
      alert("Password updated.");
      notify("Password updated", "Your Black Label Talent password was changed.");
    } catch (error) {
      alert(error.message || "Password update failed.");
    }
    return;
  }

  const profileForm = event.target.closest("[data-profile-form]");
  if (profileForm) syncNotAvailableInput();

  const availabilityForm = event.target.closest("[data-availability-form]");
  if (!availabilityForm) return;

  const formData = new FormData(availabilityForm);
  const startsAt = formData.get("starts_at");
  const status = formData.get("status") || "unavailable";
  const notes = formData.get("notes") || titleCase(status);
  const key = dateKey(startsAt);
  if (!key) return;

  const items = readLocalAvailability().filter((item) => !(item.date === key && item.source === "talent_portal_local"));
  items.push({
    date: key,
    label: titleCase(status),
    title: String(notes || titleCase(status)),
    tone: toneForStatus(status),
    source: "talent_portal_local",
    savedAt: new Date().toISOString()
  });
  writeLocalAvailability(items);
  setTimeout(decorateCalendarFromAvailability, 120);
  setTimeout(loadRemoteAvailabilityIntoCalendar, 900);
  notify("Availability saved", `${titleCase(status)} saved for ${key}.`);
}, true);

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-enable-notifications]")) {
    if (!("Notification" in window)) {
      alert("This device/browser does not support web notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    localStorage.setItem(NOTIFICATION_KEY, permission === "granted" ? "true" : "false");
    if (permission === "granted") {
      notify("Notifications enabled", "Black Label Talent notifications are now enabled on this device.");
    } else {
      alert("Notifications were not enabled.");
    }
    setTimeout(enhanceProfile, 80);
    return;
  }

  if (event.target.closest("[data-calendar-shift]") || event.target.closest('a[href="#calendar"]')) {
    setTimeout(decorateCalendarFromAvailability, 80);
    setTimeout(loadRemoteAvailabilityIntoCalendar, 250);
    setTimeout(decorateCalendarFromAvailability, 700);
  }
});

requestAnimationFrame(enhanceProfile);
setTimeout(loadRemoteAvailabilityIntoCalendar, 500);
