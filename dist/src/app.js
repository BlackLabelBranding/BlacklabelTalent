import { acceptGig, declineGig, getTalentDashboard } from "./lib/hubApi.js";

const root = document.querySelector("#root");

const icons = {
  calendar: "CAL",
  pay: "$",
  contract: "DOC",
  location: "PIN",
  person: "ROLE",
  clock: "TIME",
  check: "OK"
};

const statusTone = {
  Open: "open",
  Confirmed: "confirmed",
  "Needs signature": "attention",
  Signed: "confirmed",
  "Pending completion": "attention",
  Pending: "attention"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stat(icon, label, value) {
  return `
    <div class="stat">
      <span class="stat-icon" aria-hidden="true">${icon}</span>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function gigCard(gig) {
  const tone = statusTone[gig.status] || "neutral";
  return `
    <article class="gig-card">
      <div class="gig-card__top">
        <div>
          <p class="mini-label">${escapeHtml(gig.date)}</p>
          <h3>${escapeHtml(gig.title)}</h3>
        </div>
        <span class="pill ${tone}">${escapeHtml(gig.status)}</span>
      </div>

      <div class="gig-meta">
        <span>${icons.person} ${escapeHtml(gig.role)}</span>
        <span>${icons.location} ${escapeHtml(gig.location)}</span>
        <span>${icons.pay} ${escapeHtml(gig.pay)}</span>
      </div>

      <p class="gig-note">${escapeHtml(gig.requirements)}</p>

      <div class="deliverables">
        <span>Deliverables</span>
        <p>${escapeHtml(gig.deliverables)}</p>
      </div>

      <div class="gig-actions">
        <button class="button button-primary" type="button" data-action="accept" data-gig-id="${escapeHtml(gig.id)}">
          Accept
        </button>
        <button class="button button-secondary" type="button" data-action="decline" data-gig-id="${escapeHtml(gig.id)}">
          Decline
        </button>
      </div>
    </article>
  `;
}

function assignmentRow(assignment) {
  const contractTone = statusTone[assignment.contractStatus] || "neutral";
  const paymentTone = statusTone[assignment.paymentStatus] || "neutral";
  return `
    <article class="assignment-row">
      <div>
        <p class="mini-label">${escapeHtml(assignment.date)}</p>
        <h3>${escapeHtml(assignment.title)}</h3>
        <span>${escapeHtml(assignment.role)} &middot; ${escapeHtml(assignment.location)}</span>
      </div>
      <div class="assignment-status">
        <span class="pill ${contractTone}">${escapeHtml(assignment.contractStatus)}</span>
        <span class="pill ${paymentTone}">${escapeHtml(assignment.paymentStatus)}</span>
      </div>
    </article>
  `;
}

function talentCalendar(days) {
  const dayMap = new Map(days.map((day) => [day.day, day]));
  const dayButtons = Array.from({ length: 30 }, (_, index) => {
    const date = index + 1;
    const item = dayMap.get(date);
    return `
      <button class="calendar-day ${item ? escapeHtml(item.tone) : ""}" type="button">
        <strong>${date}</strong>
        ${
          item
            ? `<span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.title)}</small>`
            : ""
        }
      </button>
    `;
  }).join("");

  return `
    <section class="panel calendar-panel" aria-label="Talent calendar">
      <div class="section-head">
        <div>
          <p class="mini-label">Calendar</p>
          <h2>June 2026</h2>
        </div>
        <button class="icon-button" type="button" aria-label="Open calendar menu">Menu</button>
      </div>

      <div class="weekday-grid" aria-hidden="true">
        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
      </div>

      <div class="month-grid">${dayButtons}</div>
    </section>
  `;
}

function renderToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span aria-hidden="true">${icons.check}</span>${escapeHtml(message)}`;

  document.querySelector(".hero").after(toast);
}

function render(dashboard) {
  const { profile, openGigs, assignments, calendarDays } = dashboard;

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">BL</div>
          <div>
            <p>Black Label</p>
            <strong>Talent Portal</strong>
          </div>
        </div>

        <nav class="nav">
          <a href="#today" class="active">Today</a>
          <a href="#open-gigs">Open Gigs</a>
          <a href="#calendar">Calendar</a>
          <a href="#assignments">My Gigs</a>
          <a href="#profile">Profile</a>
        </nav>
      </aside>

      <main class="content">
        <section id="today" class="hero">
          <div>
            <p class="mini-label">Front-facing app</p>
            <h1>Welcome back, ${escapeHtml(profile.name)}</h1>
            <p class="hero-copy">
              View available gigs, confirm what you are accepting, track contracts, and see pay status.
            </p>
          </div>
          <div class="profile-chip">
            <span>${escapeHtml(profile.role)}</span>
            <strong>${escapeHtml(profile.status)}</strong>
          </div>
        </section>

        <section class="stats-grid" aria-label="Talent summary">
          ${stat(icons.calendar, "Next gig", profile.nextGig)}
          ${stat(icons.pay, "Pending pay", profile.payPending)}
          ${stat(icons.contract, "Talent status", profile.rating)}
        </section>

        <div class="main-grid">
          <section id="open-gigs" class="panel">
            <div class="section-head">
              <div>
                <p class="mini-label">Opportunities</p>
                <h2>Open Gigs</h2>
              </div>
              <span class="count-pill">${openGigs.length} available</span>
            </div>

            <div class="gig-list">
              ${openGigs.map(gigCard).join("")}
            </div>
          </section>

          <aside id="calendar" class="side-stack">
            ${talentCalendar(calendarDays)}

            <section id="profile" class="panel profile-panel">
              <div class="section-head">
                <div>
                  <p class="mini-label">Profile</p>
                  <h2>Availability</h2>
                </div>
                <span class="panel-icon" aria-hidden="true">${icons.clock}</span>
              </div>
              <p>
                Mark dates unavailable here later. Admin can use that availability before offering gigs from Black Label Hub.
              </p>
              <button class="button button-secondary full-width" type="button">
                Update availability
                <span aria-hidden="true">&rsaquo;</span>
              </button>
            </section>
          </aside>
        </div>

        <section id="assignments" class="panel">
          <div class="section-head">
            <div>
              <p class="mini-label">Booked work</p>
              <h2>My Gigs</h2>
            </div>
            <span class="count-pill">${assignments.length} active</span>
          </div>

          <div class="assignment-list">
            ${assignments.map(assignmentRow).join("")}
          </div>
        </section>
      </main>
    </div>
  `;

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const gigId = button.dataset.gigId;
    if (button.dataset.action === "accept") {
      await acceptGig(gigId);
      renderToast("Gig accepted. Black Label admin still confirms the final booking.");
    }

    if (button.dataset.action === "decline") {
      await declineGig(gigId);
      renderToast("Gig declined. It will be removed from your open opportunities after sync.");
    }
  });
}

root.innerHTML = `<main class="loading">Loading Talent Portal...</main>`;
getTalentDashboard().then(render);
