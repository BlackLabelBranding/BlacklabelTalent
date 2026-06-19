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

const routes = {
  home: "Home",
  gigs: "Open Gigs",
  calendar: "Calendar",
  assignments: "My Gigs",
  profile: "Profile"
};

const statusTone = {
  Open: "open",
  Confirmed: "confirmed",
  "Needs signature": "attention",
  Signed: "confirmed",
  "Pending completion": "attention",
  Pending: "attention"
};

let dashboardState = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentRoute() {
  const hash = globalThis.location.hash.replace("#", "");
  if (hash.startsWith("gig/")) return hash;
  return routes[hash] ? hash : "home";
}

function navMarkup(activeRoute) {
  const normalizedRoute = activeRoute.startsWith("gig/") ? "gigs" : activeRoute;
  return Object.entries(routes)
    .map(([route, label]) => `<a href="#${route}" class="${route === normalizedRoute ? "active" : ""}">${label}</a>`)
    .join("");
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

function gigCard(gig, featured = false) {
  const tone = statusTone[gig.status] || "neutral";
  return `
    <article class="gig-card ${featured ? "featured-gig" : ""}">
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
        <a class="button button-secondary" href="#gig/${escapeHtml(gig.id)}">View details</a>
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
        <span>${escapeHtml(assignment.role)} &middot; ${escapeHtml(assignment.location)} &middot; ${escapeHtml(assignment.pay)}</span>
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
            : "<small>Open date</small>"
        }
      </button>
    `;
  }).join("");

  return `
    <section class="panel calendar-panel" aria-label="Talent calendar">
      <div class="section-head">
        <div>
          <p class="mini-label">Your month</p>
          <h2>June 2026</h2>
        </div>
        <span class="count-pill">5 marked dates</span>
      </div>

      <div class="calendar-legend">
        <span><i class="legend-dot open"></i>Open gig</span>
        <span><i class="legend-dot confirmed"></i>Booked</span>
        <span><i class="legend-dot blocked"></i>Unavailable</span>
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

  document.querySelector(".content").prepend(toast);
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function homeView({ profile, openGigs, assignments }) {
  const nextGig = assignments[0];
  return `
    <section class="hero">
      <div>
        <p class="mini-label">Black Label Talent</p>
        <h1>Book the gig. Own the night.</h1>
        <p class="hero-copy">
          Your gigs, contracts, pay, and availability in one place.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#gigs">See open gigs</a>
          <a class="button button-secondary glass" href="#calendar">Open calendar</a>
        </div>
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

    <div class="home-grid">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="mini-label">Hot call</p>
            <h2>Featured Opportunity</h2>
          </div>
          <span class="count-pill">${openGigs.length} live</span>
        </div>
        ${gigCard(openGigs[0], true)}
      </section>

      <section class="panel next-panel">
        <div class="section-head">
          <div>
            <p class="mini-label">Next up</p>
            <h2>Booked Status</h2>
          </div>
          <span class="pill attention">${escapeHtml(nextGig.contractStatus)}</span>
        </div>
        <h3>${escapeHtml(nextGig.title)}</h3>
        <p>${escapeHtml(nextGig.role)} in ${escapeHtml(nextGig.location)}. Pay is ${escapeHtml(nextGig.pay)}.</p>
        <a class="button button-secondary full-width" href="#assignments">View my gigs</a>
      </section>
    </div>
  `;
}

function gigsView({ openGigs }) {
  return `
    <section class="page-head">
      <p class="mini-label">Opportunities</p>
      <h1>Open Gigs</h1>
      <p>Accept only the roles and requirements that fit you. Admin confirms final booking from Black Label Hub.</p>
    </section>
    <section class="gig-list page-list">
      ${openGigs.map((gig) => gigCard(gig)).join("")}
    </section>
  `;
}

function gigDetailView(dashboard, gigId) {
  const gig = dashboard.openGigs.find((item) => item.id === gigId);

  if (!gig) {
    return `
      <section class="page-head">
        <p class="mini-label">Gig detail</p>
        <h1>Gig not found</h1>
        <p>This opportunity may have been filled or removed.</p>
        <a class="button button-primary" href="#gigs">Back to open gigs</a>
      </section>
    `;
  }

  return `
    <section class="page-head detail-head">
      <a class="back-link" href="#gigs">Back to open gigs</a>
      <p class="mini-label">${escapeHtml(gig.role)}</p>
      <h1>${escapeHtml(gig.title)}</h1>
      <p>${escapeHtml(gig.requirements)}</p>
    </section>

    <section class="detail-grid">
      <article class="panel detail-main">
        <div class="section-head">
          <div>
            <p class="mini-label">Gig details</p>
            <h2>${escapeHtml(gig.date)}</h2>
          </div>
          <span class="pill open">${escapeHtml(gig.status)}</span>
        </div>

        <div class="detail-list">
          ${detailRow("Time", gig.time)}
          ${detailRow("Location", gig.location)}
          ${detailRow("Pay", gig.pay)}
          ${detailRow("Dress code", gig.dressCode)}
          ${detailRow("Manual labor required", gig.manualLabor)}
          ${detailRow("Content required", gig.contentRequired)}
          ${detailRow("Appearance required", gig.appearanceRequired)}
          ${detailRow("Contract", gig.contractStatus)}
        </div>

        <div class="deliverables detail-deliverables">
          <span>Deliverables</span>
          <p>${escapeHtml(gig.deliverables)}</p>
        </div>
      </article>

      <aside class="panel detail-side">
        <p class="mini-label">Notes from Black Label</p>
        <h2>Before you accept</h2>
        <p>${escapeHtml(gig.notes)}</p>
        <div class="gig-actions stacked">
          <button class="button button-primary full-width" type="button" data-action="accept" data-gig-id="${escapeHtml(gig.id)}">
            Accept this gig
          </button>
          <button class="button button-secondary full-width" type="button" data-action="decline" data-gig-id="${escapeHtml(gig.id)}">
            Decline
          </button>
        </div>
      </aside>
    </section>
  `;
}

function calendarView({ calendarDays }) {
  return `
    <section class="page-head">
      <p class="mini-label">Calendar</p>
      <h1>Dates, holds, and bookings</h1>
      <p>This is the talent-facing version of the master event calendar. Black Label Hub controls the source data.</p>
    </section>
    ${talentCalendar(calendarDays)}
  `;
}

function assignmentsView({ assignments }) {
  return `
    <section class="page-head">
      <p class="mini-label">Booked work</p>
      <h1>My Gigs</h1>
      <p>Track confirmed work, contracts, and payment status.</p>
    </section>
    <section class="panel">
      <div class="assignment-list">
        ${assignments.map(assignmentRow).join("")}
      </div>
    </section>
  `;
}

function profileView({ profile }) {
  return `
    <section class="page-head">
      <p class="mini-label">Profile</p>
      <h1>${escapeHtml(profile.name)}</h1>
      <p>Manage your talent profile, role preferences, blackout dates, and agreement status.</p>
    </section>
    <section class="profile-grid">
      <article class="panel profile-panel">
        <p class="mini-label">Talent profile</p>
        <h2>${escapeHtml(profile.role)}</h2>
        <p>${escapeHtml(profile.bio)}</p>
        <div class="detail-list compact">
          ${detailRow("Home base", profile.city)}
          ${detailRow("Phone", profile.phone)}
          ${detailRow("Email", profile.email)}
          ${detailRow("Talent tier", profile.rating)}
        </div>
        <button class="button button-primary" type="button">Update profile</button>
      </article>
      <article class="panel profile-panel">
        <p class="mini-label">Availability</p>
        <h2>Control your dates</h2>
        <p>Block out unavailable dates so Black Label Hub knows when not to offer gigs.</p>
        <button class="button button-secondary full-width" type="button">Update availability</button>
      </article>
      <article class="panel profile-panel">
        <p class="mini-label">Roles</p>
        <h2>What you accept</h2>
        <div class="chip-list">
          ${profile.roles.map((role) => `<span>${escapeHtml(role)}</span>`).join("")}
        </div>
        <p class="mini-label profile-subhead">Not available for</p>
        <div class="chip-list muted">
          ${profile.notAvailableFor.map((role) => `<span>${escapeHtml(role)}</span>`).join("")}
        </div>
      </article>
      <article class="panel profile-panel">
        <p class="mini-label">Sizing and socials</p>
        <h2>Booking info</h2>
        <div class="detail-list compact">
          ${detailRow("Height", profile.sizes.height)}
          ${detailRow("Shirt", profile.sizes.shirt)}
          ${detailRow("Shoe", profile.sizes.shoe)}
          ${detailRow("Instagram", profile.socials.instagram)}
          ${detailRow("TikTok", profile.socials.tiktok)}
        </div>
      </article>
      <article class="panel profile-panel agreements-panel">
        <p class="mini-label">Agreements</p>
        <h2>Contract status</h2>
        <div class="assignment-list">
          ${profile.agreements
            .map(
              (agreement) => `
                <div class="agreement-row">
                  <strong>${escapeHtml(agreement.name)}</strong>
                  <span class="pill ${agreement.status === "Signed" ? "confirmed" : "attention"}">${escapeHtml(agreement.status)}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function routeView(route, dashboard) {
  if (route.startsWith("gig/")) return gigDetailView(dashboard, route.split("/")[1]);

  const views = {
    home: homeView,
    gigs: gigsView,
    calendar: calendarView,
    assignments: assignmentsView,
    profile: profileView
  };
  return views[route](dashboard);
}

function render(dashboard) {
  dashboardState = dashboard;
  const activeRoute = currentRoute();

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">BL</div>
          <div>
            <p>Black Label</p>
            <strong>Talent</strong>
          </div>
        </div>

        <nav class="nav" aria-label="Talent portal navigation">
          ${navMarkup(activeRoute)}
        </nav>
      </aside>

      <main class="content">
        ${routeView(activeRoute, dashboard)}
      </main>
    </div>
  `;
}

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

globalThis.addEventListener("hashchange", () => {
  if (dashboardState) render(dashboardState);
});

root.innerHTML = `<main class="loading">Loading Talent Portal...</main>`;
getTalentDashboard().then(render);

if ("serviceWorker" in navigator) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
