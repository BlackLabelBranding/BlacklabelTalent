const TALENT_RUNTIME = (() => {
  const SUPABASE_URL = globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";
  const SUPABASE_ANON_KEY = globalThis.BLACK_LABEL_SUPABASE_ANON_KEY;
  const SESSION_KEY = "blacklabel.talent.session";
  const monthNames = new Map(
    Array.from({ length: 12 }, (_, index) => [
      new Date(2026, index, 1).toLocaleString("en-US", { month: "long" }),
      index
    ])
  );

  let availabilityCache = null;
  let profileCache = null;
  let loadingContext = null;

  function readSession() {
    try {
      const value = localStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function headers(session = readSession()) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    };
  }

  async function api(path) {
    const response = await fetch(`${SUPABASE_URL}${path}`, { headers: headers() });
    if (!response.ok) throw new Error(`Talent runtime request failed with ${response.status}`);
    return response.json();
  }

  function encode(value) {
    return encodeURIComponent(value || "");
  }

  function localDate(value) {
    const text = String(value || "");
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    if (!value) return "";
    return new Date(value).toISOString().slice(0, 10);
  }

  function dateRange(startValue, endValue) {
    const start = localDate(startValue);
    const end = localDate(endValue) || start;
    if (!start) return [];

    const [startYear, startMonth, startDay] = start.split("-").map(Number);
    const [endYear, endMonth, endDay] = end.split("-").map(Number);
    const cursor = new Date(startYear, startMonth - 1, startDay);
    const last = new Date(endYear, endMonth - 1, endDay);
    const dates = [];

    while (cursor <= last && dates.length < 370) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function toneFor(status) {
    if (["available", "preferred"].includes(status)) return "open";
    if (status === "tentative") return "hold";
    return "blocked";
  }

  async function getContext() {
    if (loadingContext) return loadingContext;
    loadingContext = (async () => {
      const session = readSession();
      if (!session?.access_token) return null;
      const user = await api("/auth/v1/user");
      const teamMembers = await api(
        `/rest/v1/team_members?or=(user_id.eq.${encode(user.id)},email.eq.${encode(user.email || "")})&select=*&limit=1`
      );
      const teamMember = teamMembers[0];
      if (!teamMember) return null;

      const [availability, profiles] = await Promise.all([
        api(`/rest/v1/talent_availability?team_member_id=eq.${teamMember.id}&select=*&order=starts_at.asc`),
        api(`/rest/v1/roster_profiles?team_member_id=eq.${teamMember.id}&select=*&limit=1`)
      ]);

      availabilityCache = availability;
      profileCache = profiles[0] || null;
      return { user, teamMember, availability, profile: profileCache };
    })().finally(() => {
      loadingContext = null;
    });
    return loadingContext;
  }

  function parseVisibleMonth() {
    const title = document.querySelector(".calendar-panel .section-head h2")?.textContent?.trim() || "";
    const [monthName, yearText] = title.split(/\s+/);
    const monthIndex = monthNames.get(monthName);
    const year = Number(yearText);
    if (monthIndex === undefined || !year) return null;
    return { year, monthIndex, key: `${year}-${String(monthIndex + 1).padStart(2, "0")}` };
  }

  function buttonForDay(day) {
    return [...document.querySelectorAll(".calendar-day:not(.empty)")].find(
      (button) => button.querySelector("strong")?.textContent?.trim() === String(day)
    );
  }

  async function enhanceCalendar() {
    const month = parseVisibleMonth();
    const panel = document.querySelector(".calendar-panel");
    if (!month || !panel) return;

    panel.querySelectorAll(".availability-stack.runtime-added").forEach((node) => node.remove());
    panel.querySelectorAll(".calendar-day.runtime-availability").forEach((node) => {
      node.classList.remove("runtime-availability", "runtime-blocked", "runtime-hold", "runtime-open");
    });

    const context = await getContext();
    const availability = context?.availability || availabilityCache || [];
    const grouped = new Map();

    availability.forEach((item) => {
      dateRange(item.starts_at, item.ends_at).forEach((date) => {
        if (!date.startsWith(month.key)) return;
        const day = Number(date.slice(-2));
        const items = grouped.get(day) || [];
        items.push(item);
        grouped.set(day, items);
      });
    });

    grouped.forEach((items, day) => {
      const button = buttonForDay(day);
      if (!button) return;
      const stack = document.createElement("div");
      stack.className = "availability-stack runtime-added";

      items.slice(0, 3).forEach((item) => {
        const status = item.status || "unavailable";
        const marker = document.createElement("span");
        marker.className = `availability-marker ${toneFor(status)}`;
        marker.textContent = item.notes || titleCase(status);
        stack.append(marker);
        button.classList.add(`runtime-${toneFor(status)}`);
      });

      if (items.length > 3) {
        const more = document.createElement("span");
        more.className = "availability-marker hold";
        more.textContent = `+${items.length - 3} more`;
        stack.append(more);
      }

      button.classList.add("runtime-availability");
      button.append(stack);
    });
  }

  function enhanceNotAvailableField() {
    const form = document.querySelector("[data-profile-form]");
    const field = form?.querySelector('[name="not_available_for"]');
    if (!form || !field) return;

    const label = field.closest("label");
    if (!label || label.dataset.runtimeEnhanced === "true") return;

    label.dataset.runtimeEnhanced = "true";
    label.classList.add("not-available-field", "full-field");
    label.insertAdjacentHTML(
      "afterbegin",
      '<span class="field-kicker">Hub controlled visibility</span>'
    );

    if (field.tagName !== "TEXTAREA") {
      const textarea = document.createElement("textarea");
      textarea.name = field.name;
      textarea.value = field.value;
      textarea.placeholder = field.placeholder || "Heavy setup, late nights, travel";
      textarea.rows = 3;
      field.replaceWith(textarea);
    }

    if (!label.querySelector(".field-help")) {
      label.insertAdjacentHTML(
        "beforeend",
        '<small class="field-help">Separate items with commas. These sync back to the same Hub roster profile field.</small>'
      );
    }

    form.insertBefore(label, form.firstElementChild);
  }

  function setViewportHeight() {
    const height = Math.round(globalThis.visualViewport?.height || globalThis.innerHeight || 0);
    if (height) document.documentElement.style.setProperty("--talent-app-height", `${height}px`);
  }

  function runEnhancements() {
    setViewportHeight();
    enhanceNotAvailableField();
    if (document.querySelector(".calendar-panel")) enhanceCalendar().catch(() => {});
  }

  function boot() {
    setViewportHeight();
    globalThis.visualViewport?.addEventListener("resize", setViewportHeight);
    globalThis.visualViewport?.addEventListener("scroll", setViewportHeight);
    globalThis.addEventListener("resize", setViewportHeight);
    globalThis.addEventListener("hashchange", () => setTimeout(runEnhancements, 80));

    const observer = new MutationObserver(() => runEnhancements());
    observer.observe(document.querySelector("#root"), { childList: true, subtree: true });
    runEnhancements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  return { runEnhancements };
})();
