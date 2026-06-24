import {
  acceptGig,
  declineGig,
  getAuthState,
  getTalentDashboard,
  interestedGig,
  signInWithPassword,
  signOut,
  SUPABASE_ANON_KEY,
  SUPABASE_URL
} from "./lib/hubApi.js";

const root = document.querySelector("#root");
const SESSION_KEY = "blacklabel.talent.session";

const icons = {
  calendar: "CAL",
  pay: "$",
  contract: "DOC",
  location: "PIN",
  person: "ROLE",
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
  Sent: "open",
  Viewed: "open",
  Interested: "hold",
  Accepted: "confirmed",
  Assigned: "confirmed",
  Confirmed: "confirmed",
  Signed: "confirmed",
  "Needs signature": "attention",
  "Pending completion": "attention",
  Pending: "attention"
};

let dashboardState = null;
let activeCalendarMonth = monthKeyFromDate(new Date());

function readSession() {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
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

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(options.session),
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function commaList(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function updateTalentProfile(formValues = {}) {
  const dashboard = await getTalentDashboard();

  if (!dashboard.teamMember?.id) {
    throw new Error("No linked team member profile was found.");
  }

  await supabaseRequest(`/rest/v1/team_members?id=eq.${dashboard.teamMember.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: formValues.name || null,
      phone: formValues.phone || null,
      role: formValues.role || null
    })
  });

  const rosterPayload = {
    team_member_id: dashboard.teamMember.id,
    home_base: formValues.home_base || null,
    profile_tier: formValues.profile_tier || null,
    height: formValues.height || null,
    shirt_size: formValues.shirt_size || null,
    shoe_size: formValues.shoe_size || null,
    instagram: formValues.instagram || null,
    tiktok: formValues.tiktok || null,
    roles_accepted: commaList(formValues.roles_accepted),
    not_available_for: commaList(formValues.not_available_for),
    bio: formValues.bio || null
  };

  const existingProfiles = await supabaseRequest(
    `/rest/v1/roster_profiles?team_member_id=eq.${dashboard.teamMember.id}&select=id&limit=1`
  );

  if (existingProfiles?.[0]?.id) {
    return supabaseRequest(`/rest/v1/roster_profiles?id=eq.${existingProfiles[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(rosterPayload)
    });
  }

  return supabaseRequest("/rest/v1/roster_profiles", {
    method: "POST",
    body: JSON.stringify(rosterPayload)
  });
}

async function createTalentAvailability(formValues = {}) {
  const dashboard = await getTalentDashboard();

  if (!dashboard.teamMember?.id) {
    throw new Error("No linked team member profile was found.");
  }

  return supabaseRequest("/rest/v1/talent_availability", {
    method: "POST",
    body: JSON.stringify({
      team_member_id: dashboard.teamMember.id,
      starts_at: formValues.starts_at ? new Date(formValues.starts_at).toISOString() : null,
      ends_at: formValues.ends_at ? new Date(formValues.ends_at).toISOString() : null,
      status: formValues.status || "unavailable",
      notes: formValues.notes || null,
      source: "talent_portal"
    })
  });
}

function escapeHtml(value = "") {
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

function emptyState(title, copy, action = "") {
  return `
    <article class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
      ${action}
    </article>
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
        <button class="button button-secondary" type="button" data-action="interested" data-gig-id="${escapeHtml(gig.id)}">Interested</button>
        <button class="button button-primary" type="button" data-action="accept" data-gig-id="${escapeHtml(gig.id)}">Accept</button>
        <button class="button button-secondary" type="button" data-action="decline" data-gig-id="${escapeHtml(gig.id)}">Decline</button>
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

function parseMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey, amount) {
  const { year, month } = parseMonth(monthKey);
  return monthKeyFromDate(new Date(year, month - 1 + amount, 1));
}

function monthTitle(monthKey) {
  const { year, month } = parseMonth(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function talentCalendar(days) {
  const { year, month } = parseMonth(activeCalendarMonth);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const visibleDays = days.filter((day) => day.date.startsWith(activeCalendarMonth));
  const dayMap = new Map(visibleDays.map((day) => [Number(day.date.slice(-2)), day]));
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const dayButtons = Array.from({ length: totalCells }, (_, index) => {
    const date = index - leadingBlanks + 1;
    if (date < 1 || date > daysInMonth) return `<div class="calendar-day empty" aria-hidden="true"></div>`;
    const item = dayMap.get(date);
    return `
      <button class="calendar-day ${item ? escapeHtml(item.tone) : ""}" type="button">
        <strong>${date}</strong>
        ${item ? `<span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.title)}</small>` : "<small>Open date</small>"}
      </button>
    `;
  }).join("");

  return `
    <section class="panel calendar-panel" aria-label="Talent calendar">
      <div class="section-head">
        <div>
          <p class="mini-label">Your month</p>
          <h2>${escapeHtml(monthTitle(activeCalendarMonth))}</h2>
        </div>
        <div class="calendar-controls" aria-label="Month controls">
          <button class="icon-button" type="button" data-calendar-shift="-1">Prev</button>
          <span class="count-pill">${visibleDays.length} marked dates</span>
          <button class="icon-button" type="button" data-calendar-shift="1">Next</button>
        </div>
      </div>
      <div class="calendar-legend">
        <span><i class="legend-dot open"></i>Open gig</span>
        <span><i class="legend-dot hold"></i>Interested / hold</span>
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

function renderToast(message, tone = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span aria-hidden="true">${icons.check}</span>${escapeHtml(message)}`;
  document.querySelector(".content")?.prepend(toast);
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
        <h1>Black Label Talent.</h1>
        <p class="hero-copy">Your gigs, contracts, pay, and availability in one place.</p>
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
        ${openGigs[0] ? gigCard(openGigs[0], true) : emptyState("No open gigs yet", "New invitations from Black Label Hub will appear here as soon as they are sent.")}
      </section>
      <section class="panel next-panel">
        <div class="section-head">
          <div>
            <p class="mini-label">Next up</p>
            <h2>Booked Status</h2>
          </div>
          <span class="pill attention">${escapeHtml(nextGig?.contractStatus || "No active booking")}</span>
        </div>
        ${nextGig ? `<h3>${escapeHtml(nextGig.title)}</h3><p>${escapeHtml(nextGig.role)} in ${escapeHtml(nextGig.location)}. Pay is ${escapeHtml(nextGig.pay)}.</p>` : `<p>You do not have a confirmed gig yet. Accepted opportunities move here after admin confirmation.</p>`}
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
      ${openGigs.length ? openGigs.map((gig) => gigCard(gig)).join("") : emptyState("No open invitations", "You are connected to live Supabase data. Open opportunities will appear here after Hub sends them.")}
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
        <p>This opportunity may have been filled, declined, or removed.</p>
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
          <span class="pill ${statusTone[gig.status] || "open"}">${escapeHtml(gig.status)}</span>
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
          <button class="button button-secondary full-width" type="button" data-action="interested" data-gig-id="${escapeHtml(gig.id)}">Mark interested</button>
          <button class="button button-primary full-width" type="button" data-action="accept" data-gig-id="${escapeHtml(gig.id)}">Accept this gig</button>
          <button class="button button-secondary full-width" type="button" data-action="decline" data-gig-id="${escapeHtml(gig.id)}">Decline</button>
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
      <p>This is the talent-facing version of the master event calendar. Black Label Hub controls bookings; you control your availability windows.</p>
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
        ${assignments.length ? assignments.map(assignmentRow).join("") : emptyState("No confirmed gigs", "Accepted opportunities will move here once Black Label admin confirms an assignment.")}
      </div>
    </section>
  `;
}

function profileView({ profile, user, teamMember }) {
  return `
    <section class="page-head">
      <p class="mini-label">Profile</p>
      <h1>${escapeHtml(profile.name)}</h1>
      <p>Update your talent profile and availability. Changes write back to the same Hub tables.</p>
    </section>
    ${teamMember ? "" : emptyState("No linked team member", "This login is valid, but it is not linked to a team_members row yet. Add this user's auth id or email in Hub to activate the portal.")}
    <section class="profile-grid editable-profile-grid">
      <article class="panel profile-panel wide-panel">
        <p class="mini-label">Edit profile</p>
        <h2>Your booking profile</h2>
        <form class="talent-form" data-profile-form>
          <label>Name<input name="name" value="${escapeHtml(profile.name)}" /></label>
          <label>Phone<input name="phone" value="${escapeHtml(profile.phone === "Not set" ? "" : profile.phone)}" /></label>
          <label>Primary role<input name="role" value="${escapeHtml(profile.role)}" /></label>
          <label>Home base<input name="home_base" value="${escapeHtml(profile.city === "Not set" ? "" : profile.city)}" /></label>
          <label>Talent tier<input name="profile_tier" value="${escapeHtml(profile.rating === "Roster" ? "" : profile.rating)}" /></label>
          <label>Height<input name="height" value="${escapeHtml(profile.sizes.height === "Not set" ? "" : profile.sizes.height)}" /></label>
          <label>Shirt<input name="shirt_size" value="${escapeHtml(profile.sizes.shirt === "Not set" ? "" : profile.sizes.shirt)}" /></label>
          <label>Shoe<input name="shoe_size" value="${escapeHtml(profile.sizes.shoe === "Not set" ? "" : profile.sizes.shoe)}" /></label>
          <label>Instagram<input name="instagram" value="${escapeHtml(profile.socials.instagram === "Not set" ? "" : profile.socials.instagram)}" /></label>
          <label>TikTok<input name="tiktok" value="${escapeHtml(profile.socials.tiktok === "Not set" ? "" : profile.socials.tiktok)}" /></label>
          <label class="full-field">Roles accepted<input name="roles_accepted" value="${escapeHtml(profile.roles.join(", "))}" placeholder="Model, Brand Ambassador, Influencer" /></label>
          <label class="full-field">Not available for<input name="not_available_for" value="${escapeHtml(profile.notAvailableFor.join(", "))}" placeholder="Heavy setup, late nights, travel" /></label>
          <label class="full-field">Bio<textarea name="bio">${escapeHtml(profile.bio)}</textarea></label>
          <button class="button button-primary" type="submit">Save profile</button>
        </form>
      </article>
      <article class="panel profile-panel">
        <p class="mini-label">Availability</p>
        <h2>Block or open dates</h2>
        <form class="talent-form compact-form" data-availability-form>
          <label>Start<input name="starts_at" type="datetime-local" required /></label>
          <label>End<input name="ends_at" type="datetime-local" required /></label>
          <label>Status<select name="status"><option value="available">Available</option><option value="preferred">Preferred</option><option value="tentative">Tentative</option><option value="unavailable">Unavailable</option><option value="vacation">Vacation</option></select></label>
          <label class="full-field">Notes<textarea name="notes" placeholder="Vacation, unavailable after 5 PM, preferred window, etc."></textarea></label>
          <button class="button button-secondary full-width" type="submit">Save availability</button>
        </form>
      </article>
      <article class="panel profile-panel">
        <p class="mini-label">Contact</p>
        <h2>${escapeHtml(profile.role)}</h2>
        <div class="detail-list compact">
          ${detailRow("Email", profile.email || user?.email || "")}
          ${detailRow("Phone", profile.phone)}
          ${detailRow("Talent tier", profile.rating)}
        </div>
      </article>
    </section>
  `;
}

function routeView(route, dashboard) {
  if (route.startsWith("gig/")) return gigDetailView(dashboard, route.split("/")[1]);
  const views = { home: homeView, gigs: gigsView, calendar: calendarView, assignments: assignmentsView, profile: profileView };
  return views[route](dashboard);
}

function renderLogin(error = "") {
  root.innerHTML = `
    <main class="login-shell">
      <form class="login-panel" data-login-form>
        <div class="brand">
          <div class="brand-mark">BL</div>
          <div>
            <p>Black Label</p>
            <strong>Talent</strong>
          </div>
        </div>
        <p class="mini-label">Talent login</p>
        <h1>Welcome back.</h1>
        <p>Sign in with the Supabase-authenticated talent account connected in Black Label Hub.</p>
        ${error ? `<div class="form-error">${escapeHtml(error)}</div>` : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="button button-primary full-width" type="submit">Log in</button>
      </form>
    </main>
  `;
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
        <nav class="nav" aria-label="Talent portal navigation">${navMarkup(activeRoute)}</nav>
        <button class="sign-out" type="button" data-action="sign-out">Sign out</button>
      </aside>
      <main class="content">${routeView(activeRoute, dashboard)}</main>
    </div>
  `;
}

async function refreshDashboard(message) {
  root.innerHTML = `<main class="loading">Loading Talent Portal...</main>`;
  const auth = await getAuthState();
  if (!auth.isAuthenticated) {
    renderLogin();
    return;
  }
  const dashboard = await getTalentDashboard();
  render(dashboard);
  if (message) renderToast(message);
}

root.addEventListener("submit", async (event) => {
  const loginForm = event.target.closest("[data-login-form]");
  if (loginForm) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    try {
      await signInWithPassword(formData.get("email"), formData.get("password"));
      await refreshDashboard();
    } catch (error) {
      renderLogin(error.message);
    }
    return;
  }

  const profileForm = event.target.closest("[data-profile-form]");
  if (profileForm) {
    event.preventDefault();
    const formData = new FormData(profileForm);
    try {
      await updateTalentProfile(Object.fromEntries(formData.entries()));
      await refreshDashboard("Profile saved to Black Label Hub.");
    } catch (error) {
      renderToast(error.message || "Profile update failed.", "error");
    }
    return;
  }

  const availabilityForm = event.target.closest("[data-availability-form]");
  if (availabilityForm) {
    event.preventDefault();
    const formData = new FormData(availabilityForm);
    try {
      await createTalentAvailability(Object.fromEntries(formData.entries()));
      await refreshDashboard("Availability saved to your calendar.");
    } catch (error) {
      renderToast(error.message || "Availability update failed.", "error");
    }
  }
});

root.addEventListener("click", async (event) => {
  const monthButton = event.target.closest("[data-calendar-shift]");
  if (monthButton) {
    activeCalendarMonth = shiftMonth(activeCalendarMonth, Number(monthButton.dataset.calendarShift));
    if (dashboardState) render(dashboardState);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  try {
    if (button.dataset.action === "sign-out") {
      await signOut();
      renderLogin();
      return;
    }

    const gigId = button.dataset.gigId;
    if (button.dataset.action === "interested") {
      await interestedGig(gigId);
      await refreshDashboard("Marked interested. Black Label admin can see your response.");
    }
    if (button.dataset.action === "accept") {
      await acceptGig(gigId);
      await refreshDashboard("Gig accepted. Black Label admin still confirms the final booking.");
    }
    if (button.dataset.action === "decline") {
      await declineGig(gigId);
      await refreshDashboard("Gig declined. It has been removed from your open opportunities.");
    }
  } catch (error) {
    renderToast(error.message || "That update did not go through.", "error");
  }
});

globalThis.addEventListener("hashchange", () => {
  if (dashboardState) render(dashboardState);
});

refreshDashboard();

if ("serviceWorker" in navigator) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
```
