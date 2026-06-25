function mcText(value) {
  return String(value || "").trim();
}

function mcStat(label) {
  const wanted = label.toLowerCase();
  const item = Array.from(document.querySelectorAll(".stats-grid .stat")).find((node) => {
    const found = mcText(node.querySelector("span:nth-of-type(2)")?.textContent).toLowerCase();
    return found === wanted;
  });
  return mcText(item?.querySelector("strong")?.textContent);
}

function mcNextGig() {
  const booked = document.querySelector(".next-panel");
  const title = mcText(booked?.querySelector("h3")?.textContent) || mcStat("Next gig") || "Awaiting Dispatch";
  const copy = mcText(booked?.querySelector("p")?.textContent);
  const contract = mcText(booked?.querySelector(".pill")?.textContent) || "Standby";
  const pay = mcStat("Pending pay") || "Pay TBD";
  const detail = copy.replace("Pay is", "").trim() || "No confirmed assignment yet";
  return { title, copy, contract, pay, detail };
}

function mcUnread() {
  return mcText(document.querySelector("[data-notification-badge]")?.textContent) || "0";
}

function mcStatusClass(status, contract) {
  const value = `${status} ${contract}`.toLowerCase();
  if (value.includes("unavailable") || value.includes("hold") || value.includes("declined")) return "status-red";
  if (value.includes("signature") || value.includes("pending") || value.includes("draft")) return "status-amber";
  if (value.includes("booked") || value.includes("confirmed") || value.includes("assigned")) return "status-blue";
  return "status-green";
}

function mcPatchHeroStatus() {
  const chip = document.querySelector(".profile-chip");
  if (!chip || chip.dataset.missionPatched === "true") return;
  const role = mcText(chip.querySelector("span")?.textContent) || "Talent";
  const status = mcText(chip.querySelector("strong")?.textContent) || "Available";
  const next = mcNextGig();
  chip.dataset.missionPatched = "true";
  chip.classList.add(mcStatusClass(status, next.contract));
  chip.innerHTML = `<strong>${status.toUpperCase()}</strong><span>${role}</span>`;
}

function mcBuildGrid() {
  const hero = document.querySelector(".hero");
  if (!hero || document.querySelector(".mission-control-grid")) return;
  const next = mcNextGig();
  const notifications = mcUnread();
  const pendingPay = mcStat("Pending pay") || "$0";
  const talentStatus = mcStat("Talent status") || "Active";
  const grid = document.createElement("section");
  grid.className = "mission-control-grid";
  grid.innerHTML = `
    <article class="mission-dispatch-card mission-card-main">
      <span class="mission-kicker">Next Dispatch</span>
      <h3>${next.title}</h3>
      <div class="mission-dispatch-meta"><span>${next.detail}</span><span>${next.pay}</span><span>${next.contract}</span></div>
      <a class="button button-primary" href="#assignments">Open Dispatch</a>
    </article>
    <article class="mission-mini-card"><span>Call Time</span><strong>${next.title === "Awaiting Dispatch" ? "Standby" : "Ready"}</strong><small>${next.detail}</small></article>
    <article class="mission-mini-card"><span>Alerts</span><strong>${notifications}</strong><small>Unread notifications</small></article>
    <article class="mission-mini-card"><span>Earnings</span><strong>${pendingPay}</strong><small>Pending pay</small></article>
    <article class="mission-mini-card ai-card"><span>AI Dispatch</span><strong>97%</strong><small>${talentStatus} match profile</small></article>
  `;
  hero.insertAdjacentElement("afterend", grid);
}

function mcCommsIcon() {
  const comms = document.querySelector('.nav a[href="#communications"]');
  if (!comms) return;
  comms.setAttribute("aria-label", "Messages");
  comms.innerHTML = "MSG";
}

function mcEnhance() {
  mcPatchHeroStatus();
  mcBuildGrid();
  mcCommsIcon();
}

new MutationObserver(mcEnhance).observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(mcEnhance, 80));
setTimeout(mcEnhance, 500);
setInterval(mcEnhance, 2500);
