const LOCAL_AVAILABILITY_KEY = "blacklabel.talent.localAvailability";
const SESSION_KEY = "blacklabel.talent.session";
const NOTIFICATION_KEY = "blacklabel.talent.notificationsEnabled";
const SUPABASE_URL = globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";
const SUPABASE_ANON_KEY = globalThis.BLACK_LABEL_SUPABASE_ANON_KEY || "";
const VAPID_PUBLIC_KEY = globalThis.BLACK_LABEL_VAPID_PUBLIC_KEY || "";

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

let cachedTeamMemberId = null;
let notificationPoll = null;
let lastUnreadCount = 0;

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

function html(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function relativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      button.insertAdjacentHTML("beforeend", `<span>${html(item.label)}</span><small>${html(item.title)}</small>`);
    } else if (currentSmall) {
      currentSmall.textContent = `${currentSmall.textContent} • ${text}`;
    } else {
      button.insertAdjacentHTML("beforeend", `<small>${html(text)}</small>`);
    }
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(options.session),
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? null : response.json();
}

async function getCurrentTalent() {
  if (cachedTeamMemberId) return cachedTeamMemberId;
  const session = readSession();
  if (!session?.access_token) return null;
  const user = await fetchJson("/auth/v1/user", { session, headers: authHeaders(session) });
  const members = await fetchJson(`/rest/v1/team_members?or=(user_id.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(user.email || "")})&select=id&limit=1`);
  cachedTeamMemberId = members?.[0]?.id || null;
  return cachedTeamMemberId;
}

async function loadRemoteAvailabilityIntoCalendar() {
  try {
    const teamMemberId = await getCurrentTalent();
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
      <input type="checkbox" value="${html(option)}" ${selected.has(option) ? "checked" : ""} />
      <span>${html(option)}</span>
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

function injectTalentUiStyles() {
  if (document.querySelector("#talent-platform-styles")) return;
  const style = document.createElement("style");
  style.id = "talent-platform-styles";
  style.textContent = `
    .talent-bell{position:fixed;right:16px;top:14px;z-index:80;width:46px;height:46px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(5,2,7,.78);color:#fff;display:grid;place-items:center;box-shadow:0 14px 38px rgba(0,0,0,.35);backdrop-filter:blur(16px);cursor:pointer;font-size:20px}.talent-bell:hover{border-color:rgba(255,53,200,.5)}.talent-badge{position:absolute;right:-5px;top:-5px;min-width:22px;height:22px;border-radius:999px;background:linear-gradient(135deg,#ff35c8,#4de8ff);color:#050207;font-size:11px;font-weight:1000;display:none;place-items:center;padding:0 6px}.talent-badge.active{display:grid}.notification-drawer{position:fixed;inset:0;z-index:120;display:none}.notification-drawer.open{display:block}.notification-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px)}.notification-panel{position:absolute;right:14px;top:68px;width:min(420px,calc(100vw - 28px));max-height:calc(100svh - 92px);display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(255,255,255,.15);border-radius:22px;background:linear-gradient(180deg,rgba(15,8,20,.98),rgba(6,4,9,.98));box-shadow:0 30px 80px rgba(0,0,0,.5);overflow:hidden}.notification-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid rgba(255,255,255,.1)}.notification-head h2{margin:0;font-size:22px}.notification-head p{margin:4px 0 0;color:#aab1c4;font-size:12px}.notification-actions{display:flex;gap:8px}.notification-actions button,.notification-footer button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;min-height:34px;padding:0 12px;font-weight:900;cursor:pointer}.notification-list{overflow:auto;padding:10px;display:grid;gap:9px}.notification-item{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:start;width:100%;text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:#fff;border-radius:16px;padding:12px;cursor:pointer}.notification-item.unread{border-color:rgba(77,232,255,.34);background:linear-gradient(135deg,rgba(77,232,255,.1),rgba(255,53,200,.08))}.notification-icon{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.08)}.notification-copy strong{display:block;font-size:14px;line-height:1.2}.notification-copy span{display:block;margin-top:5px;color:#b5bdd0;font-size:12px;line-height:1.35}.notification-time{color:#8d96aa;font-size:11px;white-space:nowrap}.notification-empty{padding:30px 18px;text-align:center;color:#aab1c4}.notification-footer{padding:12px 18px;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;gap:10px}.notification-footer small{color:#8d96aa}.account-security-panel,.notification-panel.profile-panel{position:relative;right:auto;top:auto;width:auto;max-height:none}.security-note{color:#aab1c4;font-size:12px;line-height:1.45}.not-available-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin-top:8px}.check-chip{display:flex!important;align-items:center;gap:8px;min-height:34px;padding:7px 9px!important;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.04);font-size:11px!important}.check-chip input{width:14px!important;min-height:14px!important;accent-color:#4de8ff}@media(max-width:760px){.talent-bell{top:10px;right:10px;width:42px;height:42px}.notification-panel{right:0;left:0;bottom:0;top:auto;width:100%;max-height:82svh;border-radius:24px 24px 0 0}.notification-item{grid-template-columns:32px 1fr}.notification-time{grid-column:2}.notification-footer{padding-bottom:calc(12px + env(safe-area-inset-bottom))}}
  `;
  document.head.appendChild(style);
}

function notificationIcon(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("gig")) return "🎯";
  if (value.includes("contract")) return "📄";
  if (value.includes("payment")) return "💸";
  if (value.includes("call")) return "⏰";
  if (value.includes("message")) return "💬";
  if (value.includes("cancel")) return "⚠️";
  return "🔔";
}

function ensureNotificationShell() {
  injectTalentUiStyles();
  if (!document.querySelector(".app") || document.querySelector("[data-notification-bell]")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <button class="talent-bell" type="button" data-notification-bell aria-label="Open notifications">
      🔔<span class="talent-badge" data-notification-badge>0</span>
    </button>
    <section class="notification-drawer" data-notification-drawer aria-hidden="true">
      <div class="notification-backdrop" data-close-notifications></div>
      <aside class="notification-panel" role="dialog" aria-label="Notifications">
        <div class="notification-head">
          <div><h2>Notifications</h2><p data-notification-subtitle>Loading updates...</p></div>
          <div class="notification-actions">
            <button type="button" data-mark-all-read>Read all</button>
            <button type="button" data-close-notifications>Close</button>
          </div>
        </div>
        <div class="notification-list" data-notification-list><div class="notification-empty">Loading notifications...</div></div>
        <div class="notification-footer"><small>Black Label Talent alerts</small><button type="button" data-refresh-notifications>Refresh</button></div>
      </aside>
    </section>
  `);
}

async function fetchNotifications() {
  const teamMemberId = await getCurrentTalent();
  if (!teamMemberId) return [];
  return fetchJson(`/rest/v1/talent_notifications?team_member_id=eq.${teamMemberId}&select=*&order=created_at.desc&limit=60`);
}

function renderNotifications(items = []) {
  const list = document.querySelector("[data-notification-list]");
  const subtitle = document.querySelector("[data-notification-subtitle]");
  const badge = document.querySelector("[data-notification-badge]");
  if (!list || !badge) return;

  const unread = items.filter((item) => !item.read_at).length;
  lastUnreadCount = unread;
  badge.textContent = unread > 99 ? "99+" : String(unread);
  badge.classList.toggle("active", unread > 0);
  if (subtitle) subtitle.textContent = unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "All caught up";

  if (!items.length) {
    list.innerHTML = `<div class="notification-empty"><strong>No notifications yet.</strong><br />New gigs, contracts, call times, and payments will land here.</div>`;
    return;
  }

  list.innerHTML = items.map((item) => `
    <button class="notification-item ${item.read_at ? "" : "unread"}" type="button" data-notification-id="${html(item.id)}" data-notification-url="${html(item.target_url || "/#home")}">
      <span class="notification-icon">${notificationIcon(item.notification_type)}</span>
      <span class="notification-copy"><strong>${html(item.title || "Notification")}</strong><span>${html(item.body || "")}</span></span>
      <span class="notification-time">${html(relativeTime(item.created_at))}</span>
    </button>
  `).join("");
}

async function refreshNotifications({ quiet = false } = {}) {
  try {
    ensureNotificationShell();
    const items = await fetchNotifications();
    const unread = items.filter((item) => !item.read_at).length;
    if (unread > lastUnreadCount && lastUnreadCount !== 0 && !quiet) {
      const newest = items.find((item) => !item.read_at);
      if (newest) notify(newest.title || "Black Label Talent", newest.body || "You have a new update.", newest.target_url || "./#home");
    }
    renderNotifications(items);
  } catch (error) {
    console.warn("Notification refresh skipped", error);
  }
}

function openNotifications() {
  const drawer = document.querySelector("[data-notification-drawer]");
  if (!drawer) return;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  refreshNotifications({ quiet: true });
}

function closeNotifications() {
  const drawer = document.querySelector("[data-notification-drawer]");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

async function markNotificationRead(id) {
  if (!id) return;
  await fetchJson(`/rest/v1/talent_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() })
  });
}

async function markAllNotificationsRead() {
  const teamMemberId = await getCurrentTalent();
  if (!teamMemberId) return;
  await fetchJson(`/rest/v1/talent_notifications?team_member_id=eq.${teamMemberId}&read_at=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() })
  });
  await refreshNotifications({ quiet: true });
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
  const vapidNote = VAPID_PUBLIC_KEY ? "Push device registration is available." : "Browser notifications are enabled here. Server push needs the VAPID public key next.";

  const panel = document.createElement("article");
  panel.className = "panel profile-panel notification-settings-panel";
  panel.dataset.notificationPanel = "true";
  panel.innerHTML = `
    <p class="mini-label">Phone app notifications</p>
    <h2>Notifications</h2>
    <p class="security-note">Enable alerts for booking updates, contracts, payments, and call-time changes. ${vapidNote}</p>
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

function notify(title, body, targetUrl = "./#home") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    navigator.serviceWorker?.ready
      ?.then((registration) => registration.showNotification(title, { body, icon: "./icons/icon-192.png", badge: "./icons/favicon-32.png", data: { url: targetUrl } }))
      .catch(() => new Notification(title, { body }));
  } catch {
    try { new Notification(title, { body }); } catch {}
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerPushSubscription() {
  if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const teamMemberId = await getCurrentTalent();
  if (!teamMemberId) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  await fetchJson("/rest/v1/talent_push_subscriptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ team_member_id: teamMemberId, endpoint: subscription.endpoint, subscription, user_agent: navigator.userAgent, enabled: true })
  });
  return true;
}

function enhanceProfile() {
  injectTalentUiStyles();
  ensureNotificationShell();
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
  if (event.target.closest("[data-notification-bell]")) {
    openNotifications();
    return;
  }
  if (event.target.closest("[data-close-notifications]")) {
    closeNotifications();
    return;
  }
  if (event.target.closest("[data-refresh-notifications]")) {
    await refreshNotifications({ quiet: true });
    return;
  }
  if (event.target.closest("[data-mark-all-read]")) {
    await markAllNotificationsRead();
    return;
  }
  const item = event.target.closest("[data-notification-id]");
  if (item) {
    await markNotificationRead(item.dataset.notificationId);
    await refreshNotifications({ quiet: true });
    closeNotifications();
    const url = item.dataset.notificationUrl || "/#home";
    if (url.startsWith("/#")) location.hash = url.slice(1);
    else location.href = url;
    return;
  }
  if (event.target.closest("[data-enable-notifications]")) {
    if (!("Notification" in window)) {
      alert("This device/browser does not support web notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    localStorage.setItem(NOTIFICATION_KEY, permission === "granted" ? "true" : "false");
    if (permission === "granted") {
      const pushed = await registerPushSubscription().catch(() => false);
      notify("Notifications enabled", pushed ? "This device is registered for Black Label Talent push alerts." : "Black Label Talent notifications are enabled on this device.");
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
setTimeout(() => refreshNotifications({ quiet: true }), 900);
notificationPoll = setInterval(() => refreshNotifications(), 30000);
