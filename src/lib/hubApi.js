import { talentProfile, gigOpportunities, myAssignments, calendarDays } from "../data/mockData.js";

export const SUPABASE_URL =
  globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";

export const SUPABASE_ANON_KEY =
  globalThis.BLACK_LABEL_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcGN0dGtybWp2d2RkZGF3ZGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTQzNjgsImV4cCI6MjA3MTczMDM2OH0.5s1HHvDsDIgWw6TVR3YfhzJC9uEjcVfunRyMa6B7xYY";

const SESSION_KEY = "blacklabel.talent.session";
const EMPTY_DASHBOARD = {
  profile: talentProfile,
  openGigs: gigOpportunities,
  assignments: myAssignments,
  calendarDays
};

function readSession() {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(session = readSession()) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

function isExpired(session) {
  return !session?.access_token || (session.expires_at && session.expires_at * 1000 <= Date.now());
}

async function request(path, options = {}) {
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

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatTimeRange(start, end) {
  if (!start) return "Time TBD";
  const timeOptions = { hour: "numeric", minute: "2-digit" };
  const startText = new Date(start).toLocaleTimeString("en-US", timeOptions);
  const endText = end ? new Date(end).toLocaleTimeString("en-US", timeOptions) : "";
  return endText ? `${startText} - ${endText}` : startText;
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPay(record) {
  if (!record?.pay_rate) return "Pay TBD";
  const amount = Number(record.pay_rate).toLocaleString("en-US", {
    style: "currency",
    currency: record.pay_currency || "USD",
    maximumFractionDigits: Number(record.pay_rate) % 1 === 0 ? 0 : 2
  });
  return record.pay_type ? `${amount} ${record.pay_type}` : amount;
}

function locationFor(opportunity) {
  return [opportunity?.location_name, opportunity?.city, opportunity?.state].filter(Boolean).join(", ") || "Location TBD";
}

function dateKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function mapInvitation(invitation, opportunities, roles) {
  const opportunity = opportunities.get(invitation.opportunity_id) || {};
  const role = roles.get(invitation.opportunity_role_id) || {};
  const metadata = { ...(opportunity.metadata || {}), ...(role.metadata || {}), ...(invitation.metadata || {}) };

  return {
    id: invitation.id,
    eventId: opportunity.event_id || opportunity.id || invitation.opportunity_id,
    date: formatDate(opportunity.starts_at),
    title: opportunity.title || "Untitled opportunity",
    role: role.role_label || titleCase(opportunity.work_type) || "Talent",
    location: locationFor(opportunity),
    pay: formatPay(role),
    status: titleCase(invitation.status || "open"),
    contractStatus: role.contract_required ? "Contract sent after admin confirmation" : "Not required",
    requirements: role.requirements || opportunity.description || "Review the gig detail before responding.",
    deliverables: metadata.deliverables || metadata.deliverable || "See call sheet after admin confirmation.",
    time: role.call_time || formatTimeRange(opportunity.starts_at, opportunity.ends_at),
    dressCode: metadata.dress_code || metadata.dressCode || "See call sheet after admin confirmation.",
    manualLabor: role.labor_required ? "Yes" : "No",
    contentRequired: role.content_required ? "Yes" : "No",
    appearanceRequired: role.appearance_required ? "Yes" : "No",
    notes: role.notes || opportunity.notes || "Black Label admin confirms the final booking.",
    startsAt: opportunity.starts_at
  };
}

function mapAssignment(assignment, opportunities, roles, contracts) {
  const opportunity = opportunities.get(assignment.opportunity_id) || {};
  const role = roles.get(assignment.opportunity_role_id) || {};
  const contract = contracts.find((item) => item.assignment_id === assignment.id);

  return {
    id: assignment.id,
    eventId: opportunity.event_id || opportunity.id || assignment.opportunity_id,
    date: formatDate(opportunity.starts_at),
    title: opportunity.title || "Untitled assignment",
    role: role.role_label || titleCase(opportunity.work_type) || "Talent",
    location: locationFor(opportunity),
    pay: formatPay(assignment.pay_rate ? assignment : role),
    status: titleCase(assignment.assignment_status),
    contractStatus: titleCase(contract?.status || assignment.contract_status),
    paymentStatus: titleCase(assignment.pay_status),
    startsAt: opportunity.starts_at
  };
}

function mapAvailability(item) {
  const status = item.status || "unavailable";
  const toneByStatus = {
    available: "open",
    preferred: "open",
    tentative: "hold",
    unavailable: "blocked",
    vacation: "blocked"
  };

  return {
    date: dateKey(item.starts_at),
    label: titleCase(status),
    tone: toneByStatus[status] || "blocked",
    title: item.notes || titleCase(item.source || "Availability")
  };
}

function mapProfile(teamMember, rosterProfile, user, assignments) {
  const nextGig = assignments[0]?.title || "No booked gigs";
  const payPending = assignments.filter((item) => item.paymentStatus !== "Paid").length;

  return {
    name: teamMember?.name || user?.email || "Black Label Talent",
    role: rosterProfile?.profile_type || teamMember?.role || "Talent",
    status: titleCase(rosterProfile?.profile_status || teamMember?.status || "active"),
    rating: rosterProfile?.profile_tier || "Roster",
    nextGig,
    payPending: payPending ? `${payPending} pending` : "$0",
    city: rosterProfile?.home_base || "Not set",
    phone: teamMember?.phone || "Not set",
    email: teamMember?.email || user?.email || "",
    bio: rosterProfile?.bio || "Your roster profile is connected to Black Label Hub.",
    roles: rosterProfile?.roles_accepted?.length ? rosterProfile.roles_accepted : [teamMember?.role || "Talent"],
    notAvailableFor: rosterProfile?.not_available_for || [],
    sizes: {
      shirt: rosterProfile?.shirt_size || "Not set",
      shoe: rosterProfile?.shoe_size || "Not set",
      height: rosterProfile?.height || "Not set"
    },
    socials: {
      instagram: rosterProfile?.instagram || "Not set",
      tiktok: rosterProfile?.tiktok || "Not set"
    },
    agreements: [{ name: "Talent Agreement", status: assignments.some((item) => item.contractStatus !== "Signed") ? "Pending" : "Signed" }]
  };
}

function ids(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))];
}

function inFilter(values) {
  return values.length ? `in.(${values.map(encodeURIComponent).join(",")})` : "in.()";
}

function cleanValue(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function listValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchByIds(table, values) {
  if (!values.length) return [];
  return request(`/rest/v1/${table}?id=${inFilter(values)}&select=*`);
}

async function getCurrentUser(session = readSession()) {
  if (isExpired(session)) return null;
  try {
    return await request("/auth/v1/user", { session, prefer: "" });
  } catch {
    clearStoredSession();
    return null;
  }
}

async function loadTalentContext(user) {
  const teamMembers = await request(
    `/rest/v1/team_members?or=(user_id.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(user.email || "")})&select=*&limit=1`
  );
  const teamMember = teamMembers[0];

  if (!teamMember) {
    return {
      ...EMPTY_DASHBOARD,
      profile: mapProfile(null, null, user, []),
      user,
      teamMember: null
    };
  }

  const [profiles, invitations, assignments, availability] = await Promise.all([
    request(`/rest/v1/roster_profiles?team_member_id=eq.${teamMember.id}&select=*&limit=1`),
    request(
      `/rest/v1/opportunity_invitations?team_member_id=eq.${teamMember.id}&status=in.(sent,viewed,interested,accepted)&select=*&order=created_at.desc`
    ),
    request(`/rest/v1/work_assignments?team_member_id=eq.${teamMember.id}&select=*&order=created_at.desc`),
    request(`/rest/v1/talent_availability?team_member_id=eq.${teamMember.id}&select=*&order=starts_at.asc`)
  ]);

  const opportunityIds = ids([...invitations, ...assignments], "opportunity_id");
  const roleIds = ids([...invitations, ...assignments], "opportunity_role_id");
  const assignmentIds = ids(assignments, "id");
  const [opportunityRows, roleRows, contractRows] = await Promise.all([
    fetchByIds("work_opportunities", opportunityIds),
    fetchByIds("work_opportunity_roles", roleIds),
    assignmentIds.length ? request(`/rest/v1/assignment_contracts?assignment_id=${inFilter(assignmentIds)}&select=*`) : []
  ]);

  const opportunities = new Map(opportunityRows.map((item) => [item.id, item]));
  const roles = new Map(roleRows.map((item) => [item.id, item]));
  const openGigs = invitations.map((item) => mapInvitation(item, opportunities, roles));
  const mappedAssignments = assignments.map((item) => mapAssignment(item, opportunities, roles, contractRows));
  const openGigDays = openGigs.map((gig) => ({
    date: dateKey(gig.startsAt),
    label: gig.status,
    tone: gig.status === "Interested" ? "hold" : "open",
    title: gig.title
  }));
  const assignmentDays = mappedAssignments.map((assignment) => ({
    date: dateKey(assignment.startsAt),
    label: assignment.status,
    tone: "confirmed",
    title: assignment.title
  }));

  return {
    profile: mapProfile(teamMember, profiles[0], user, mappedAssignments),
    openGigs,
    assignments: mappedAssignments,
    calendarDays: [...assignmentDays, ...openGigDays, ...availability.map(mapAvailability)].filter((day) => day.date),
    user,
    teamMember
  };
}

export async function signInWithPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Login failed. Check the email and password for this talent account.");
  }

  const session = await response.json();
  writeSession(session);
  return session;
}

export async function signOut() {
  const session = readSession();
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(session)
    }).catch(() => {});
  }
  clearStoredSession();
}

export async function getAuthState() {
  const session = readSession();
  const user = await getCurrentUser(session);
  return { session, user, isAuthenticated: Boolean(user) };
}

export async function getTalentDashboard() {
  const { user } = await getAuthState();
  if (!user) return { ...EMPTY_DASHBOARD, user: null, teamMember: null };
  return loadTalentContext(user);
}

export async function updateInvitationStatus(invitationId, status) {
  const dashboard = await getTalentDashboard();
  if (!dashboard.teamMember?.id) throw new Error("No linked team member profile was found.");

  return request(
    `/rest/v1/opportunity_invitations?id=eq.${invitationId}&team_member_id=eq.${dashboard.teamMember.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        channel: "talent_portal",
        responded_at: new Date().toISOString()
      })
    }
  );
}

export function acceptGig(gigId) {
  return updateInvitationStatus(gigId, "accepted");
}

export function interestedGig(gigId) {
  return updateInvitationStatus(gigId, "interested");
}

export function declineGig(gigId) {
  return updateInvitationStatus(gigId, "declined");
}

export async function updateTalentProfile(formValues = {}) {
  const dashboard = await getTalentDashboard();
  const teamMemberId = dashboard.teamMember?.id;
  if (!teamMemberId) throw new Error("No linked team member profile was found.");

  const teamMemberUpdates = {
    name: cleanValue(formValues.name),
    phone: cleanValue(formValues.phone),
    role: cleanValue(formValues.role)
  };

  const rosterProfileUpdates = {
    profile_type: cleanValue(formValues.role),
    profile_tier: cleanValue(formValues.profile_tier),
    home_base: cleanValue(formValues.home_base),
    height: cleanValue(formValues.height),
    shirt_size: cleanValue(formValues.shirt_size),
    shoe_size: cleanValue(formValues.shoe_size),
    instagram: cleanValue(formValues.instagram),
    tiktok: cleanValue(formValues.tiktok),
    roles_accepted: listValue(formValues.roles_accepted),
    not_available_for: listValue(formValues.not_available_for),
    bio: cleanValue(formValues.bio)
  };

  const profiles = await request(`/rest/v1/roster_profiles?team_member_id=eq.${teamMemberId}&select=id&limit=1`);

  await request(`/rest/v1/team_members?id=eq.${teamMemberId}`, {
    method: "PATCH",
    body: JSON.stringify(teamMemberUpdates)
  });

  if (profiles[0]?.id) {
    await request(`/rest/v1/roster_profiles?id=eq.${profiles[0].id}&team_member_id=eq.${teamMemberId}`, {
      method: "PATCH",
      body: JSON.stringify(rosterProfileUpdates)
    });
  } else {
    await request("/rest/v1/roster_profiles", {
      method: "POST",
      body: JSON.stringify({
        team_member_id: teamMemberId,
        profile_status: "active",
        ...rosterProfileUpdates
      })
    });
  }

  return getTalentDashboard();
}

export async function createTalentAvailability(formValues = {}) {
  const dashboard = await getTalentDashboard();
  const teamMemberId = dashboard.teamMember?.id;
  if (!teamMemberId) throw new Error("No linked team member profile was found.");
  if (!formValues.starts_at || !formValues.ends_at) {
    throw new Error("Start and end dates are required for availability.");
  }

  return request("/rest/v1/talent_availability", {
    method: "POST",
    body: JSON.stringify({
      team_member_id: teamMemberId,
      starts_at: formValues.starts_at,
      ends_at: formValues.ends_at,
      status: formValues.status || "unavailable",
      notes: cleanValue(formValues.notes),
      source: "talent_portal"
    })
  });
}
