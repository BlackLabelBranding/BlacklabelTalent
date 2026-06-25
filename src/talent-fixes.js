const LOCAL_AVAILABILITY_KEY = "blacklabel.talent.localAvailability";
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

function readLocalAvailability() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_AVAILABILITY_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalAvailability(items) {
  localStorage.setItem(LOCAL_AVAILABILITY_KEY, JSON.stringify(items.slice(-100)));
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

function decorateCalendarFromLocalAvailability() {
  const grid = document.querySelector(".month-grid");
  if (!grid) return;
  const monthKey = monthKeyFromHeading();
  if (!monthKey) return;

  const items = readLocalAvailability().filter((item) => item.date?.startsWith(monthKey));
  if (!items.length) return;

  const buttons = [...grid.querySelectorAll(".calendar-day:not(.empty)")];
  items.forEach((item) => {
    const dayNumber = Number(item.date.slice(-2));
    const button = buttons.find((node) => Number(node.querySelector("strong")?.textContent) === dayNumber);
    if (!button) return;

    button.classList.add(item.tone || "blocked");
    const existing = button.querySelector("small")?.textContent || "";
    if (!existing.includes(item.title)) {
      const currentLabel = button.querySelector("span");
      const currentSmall = button.querySelector("small");
      if (!currentLabel) {
        button.insertAdjacentHTML("beforeend", `<span>${item.label}</span><small>${item.title}</small>`);
      } else if (currentSmall) {
        currentSmall.textContent = `${currentSmall.textContent} • ${item.title}`;
      }
    }
  });
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

function enhanceProfile() {
  buildNotAvailableControls();
  decorateCalendarFromLocalAvailability();
}

const observer = new MutationObserver(() => enhanceProfile());
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("change", (event) => {
  if (event.target.closest(".not-available-grid")) syncNotAvailableInput();
});

document.addEventListener("submit", (event) => {
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

  const toneByStatus = {
    available: "open",
    preferred: "open",
    tentative: "hold",
    unavailable: "blocked",
    vacation: "blocked"
  };

  const items = readLocalAvailability().filter((item) => !(item.date === key && item.source === "talent_portal_local"));
  items.push({
    date: key,
    label: titleCase(status),
    title: String(notes || titleCase(status)),
    tone: toneByStatus[status] || "blocked",
    source: "talent_portal_local",
    savedAt: new Date().toISOString()
  });
  writeLocalAvailability(items);
}, true);

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-calendar-shift]") || event.target.closest('a[href="#calendar"]')) {
    setTimeout(decorateCalendarFromLocalAvailability, 80);
    setTimeout(decorateCalendarFromLocalAvailability, 350);
  }
});

requestAnimationFrame(enhanceProfile);
