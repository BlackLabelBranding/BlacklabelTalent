const PUSH_SUPABASE_URL = globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";
const PUSH_ANON_KEY = globalThis.BLACK_LABEL_SUPABASE_ANON_KEY || "";
const PUSH_SESSION_KEY = "blacklabel.talent.session";

function pushSession() {
  try {
    return JSON.parse(localStorage.getItem(PUSH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function pushHeaders() {
  const session = pushSession();
  return {
    apikey: PUSH_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || PUSH_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

async function pushFetch(path, options = {}) {
  const response = await fetch(`${PUSH_SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...pushHeaders(), ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  return response.json();
}

function validVapidPublicKey(key) {
  const value = String(key || "").trim();
  if (value.length < 80) return false;
  if (/^[0-9a-f]+$/i.test(value)) return false;
  return /^[A-Za-z0-9_-]+={0,2}$/.test(value);
}

async function getVapidPublicKey() {
  const inlineKey = String(globalThis.BLACK_LABEL_VAPID_PUBLIC_KEY || "").trim();
  if (validVapidPublicKey(inlineKey)) return inlineKey;

  const data = await pushFetch("/functions/v1/push-public-key", { method: "GET" });
  const publicKey = String(data?.publicKey || "").trim();
  if (!validVapidPublicKey(publicKey)) {
    throw new Error("The VAPID_PUBLIC_KEY secret is not in browser push format. Generate new VAPID keys and replace the existing hex-looking secrets.");
  }
  return publicKey;
}

function vapidToBytes(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getTalentIdentity() {
  const session = pushSession();
  if (!session?.access_token) throw new Error("Please log in before enabling notifications.");
  const user = await pushFetch("/auth/v1/user", { method: "GET" });
  const members = await pushFetch(`/rest/v1/team_members?or=(user_id.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(user.email || "")})&select=id&limit=1`, { method: "GET" });
  const teamMemberId = members?.[0]?.id;
  if (!teamMemberId) throw new Error("No linked team member was found for this login.");
  return { user, teamMemberId };
}

function toastPush(message, error = false) {
  const existing = document.querySelector(".push-fix-toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = `push-fix-toast ${error ? "error" : "success"}`;
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 5200);
}

function injectPushStyles() {
  if (document.querySelector("#push-fix-styles")) return;
  const style = document.createElement("style");
  style.id = "push-fix-styles";
  style.textContent = `.push-fix-toast{position:fixed;left:16px;right:16px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:9999;padding:13px 15px;border-radius:14px;background:rgba(6,18,12,.96);border:1px solid rgba(67,255,155,.32);color:#dfffea;font-weight:900;box-shadow:0 18px 44px rgba(0,0,0,.38);backdrop-filter:blur(16px)}.push-fix-toast.error{background:rgba(24,7,12,.96);border-color:rgba(255,79,111,.4);color:#ffdce4}`;
  document.head.appendChild(style);
}

async function enableDevicePush() {
  if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
  if (!("PushManager" in window)) throw new Error("This browser does not support push notifications.");

  injectPushStyles();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const publicKey = await getVapidPublicKey();
  const { user, teamMemberId } = await getTalentIdentity();
  await navigator.serviceWorker.register("./sw.js").catch(() => null);
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidToBytes(publicKey)
    });
  }

  const payload = {
    team_member_id: teamMemberId,
    user_id: user.id,
    endpoint: subscription.endpoint,
    subscription,
    user_agent: navigator.userAgent,
    enabled: true,
    updated_at: new Date().toISOString()
  };

  await pushFetch("/rest/v1/talent_push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });

  localStorage.setItem("blacklabel.talent.notificationsEnabled", "true");
  toastPush("Device notifications enabled for Black Label Talent.");
  return true;
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-enable-notifications]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const original = button.textContent;
  button.textContent = "Enabling...";
  button.disabled = true;
  try {
    await enableDevicePush();
    button.textContent = "Notifications enabled";
  } catch (error) {
    console.error("Push registration failed", error);
    toastPush(error.message || "Push registration failed.", true);
    button.textContent = original || "Enable notifications";
  } finally {
    button.disabled = false;
  }
}, true);
