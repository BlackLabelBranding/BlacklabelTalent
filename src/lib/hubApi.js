import { talentProfile, gigOpportunities, myAssignments, calendarDays } from "../data/mockData.js";

export const SUPABASE_URL =
  globalThis.BLACK_LABEL_SUPABASE_URL || "https://xopcttkrmjvwdddawdaa.supabase.co";

export const SUPABASE_ANON_KEY =
  globalThis.BLACK_LABEL_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InhvcGN0dGtybWp2d2RkZGF3ZGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTQzNjgsImV4cCI6MjA3MTczMDM2OH0.5s1HHvDsDIgWw6TVR3YfhzJC9uEjcVfunRyMa6B7xYY".replace("eyJpc3MiOiJIUzI1Ni", "eyJpc3MiOiJzdXBhYmFzZSI");

const SESSION_KEY = "blacklabel.talent.session";
const AVATAR_BUCKET = "team-members";
const EMPTY_DASHBOARD = {
  profile: talentProfile,
  openGigs: gigOpportunities,
  assignments: myAssignments,
  calendarDays,
  availabilityRules: []
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

function authHeaders(session = readSession(), contentType = "application/json") {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    ...(contentType ? { "Content-Type": contentType } : {})
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

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
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

function fullAddressFor(opportunity) {
  return [opportunity?.address, opportunity?.city, opportunity?.state, opportunity?.postal_code].filter(Boolean).join(", ") || "Address TBD";
}

function dateKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function ids(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))];
}

function inFilter(values) {
  return values.length ? `in.(${values.map(encodeURIComponent).join(",")})` : "in.()";
}

function storagePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function safeFileName(name = "avatar") {
  const cleaned = String(name).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "avatar";
}

async function fetchByIds(table, values) {
  if (!values.length) return [];
  return request(`/rest/v1/${table}?id=${inFilter(values)}&select=*`);
}

function mapInvitation(invitation, opportunities, roles) {
  const opportunity = opportunities.get(invitation.opportunity_id) || {};
  const role = roles.get(invitation.opportunity_role_id) || {};
  const metadata = { ...(opportunity.metadata || {}), ...(role.metadata || {}), ...(invitation.metadata || {}) };

  return {
    id: invitation.id,
    eventId: opportunity.event_id || opportunity.id || invitation.opportunity_id,
    campaignId: invitation.campaign_id || "",
    date: formatDate(opportunity.starts_at),
    startsAt: opportunity.starts_at,
    endsAt: opportunity.ends_at,
    timezone: opportunity.timezone || "America/Chicago",
    title: opportunity.title || "Untitled opportunity",
    clientName: opportunity.client_name || "Not set",
    division: opportunity.division || "Not set",
    workType: titleCase(opportunity.work_type || "event"),
    opportunityStatus: titleCase(opportunity.status || "draft"),
    visibility: titleCase(opportunity.visibility || "internal"),
    role: role.role_label || titleCase(opportunity.work_type) || "Talent",
    roleKey: role.role_key || "",
    roleStatus: titleCase(role.status || "open"),
    slotsNeeded: role.slots_needed ?? "Not set",
    minSlots: role.min_slots ?? "Not set",
    maxSlots: role.max_slots ?? "Not set",
    location: locationFor(opportunity),
    fullAddress: fullAddressFor(opportunity),
    pay: formatPay(role),
    status: titleCase(invitation.status || "open"),
    contractStatus: role.contract_required ? "Contract sent after admin confirmation" : "Not required",
    offerSentAt: formatDateTime(invitation.sent_at),
    viewedAt: formatDateTime(invitation.viewed_at),
    respondedAt: formatDateTime(invitation.responded_at),
    expiresAt: formatDateTime(invitation.expires_at),
    responseNotes: invitation.response_notes || "Not set",
    channel: titleCase(invitation.channel || "hub"),
    requirements: role.requirements || opportunity.description || "Review the gig detail before responding.",
    deliverables: metadata.deliverables || metadata.deliverable || "See call sheet after admin confirmation.",
    time: role.call_time || formatTimeRange(opportunity.starts_at, opportunity.ends_at),
    callTime: role.call_time || "Not set",
    arrivalTime: role.arrival_time || "Not set",
    departureTime: role.departure_time || "Not set",
    dressCode: metadata.dress_code || metadata.dressCode || "See call sheet after admin confirmation.",
    manualLabor: role.labor_required ? "Yes" : "No",
    contentRequired: role.content_required ? "Yes" : "No",
    appearanceRequired: role.appearance_required ? "Yes" : "No",
    notes: role.notes || opportunity.notes || "Black Label admin confirms the final booking."
  };
}

function mapAssignment(assignment, opportunities, roles, contracts) {
  const opportunity = opportunities.get(assignment.opportunity_id) || {};
  const role = roles.get(assignment.opportunity_role_id) || {};
  const contract = contracts.find((item) => item.assignment_id === assignment.id) || {};

  return {
    id: assignment.id,
    eventId: opportunity.event_id || opportunity.id || assignment.opportunity_id,
    date: formatDate(opportunity.starts_at),
    startsAt: opportunity.starts_at,
    endsAt: opportunity.ends_at,
    timezone: opportunity.timezone || "America/Chicago",
    title: opportunity.title || "Untitled assignment",
    clientName: opportunity.client_name || "Not set",
    division: opportunity.division || "Not set",
    role: role.role_label || titleCase(opportunity.work_type) || "Talent",
    location: locationFor(opportunity),
    fullAddress: fullAddressFor(opportunity),
    pay: formatPay(assignment.pay_rate ? assignment : role),
    payType: assignment.pay_type || role.pay_type || "Not set",
    payRate: assignment.pay_rate ?? role.pay_rate ?? "Not set",
    payCurrency: assignment.pay_currency || role.pay_currency || "USD",
    status: titleCase(assignment.assignment_status),
    offerStatus: titleCase(assignment.offer_status),
    contractStatus: titleCase(contract.status || assignment.contract_status),
    paymentStatus: titleCase(assignment.pay_status),
    callTime: assignment.call_time || role.call_time || "Not set",
    arrivalTime: assignment.arrival_time || role.arrival_time || "Not set",
    departureTime: assignment.departure_time || role.departure_time || "Not set",
    offeredAt: formatDateTime(assignment.offered_at),
    acceptedAt: formatDateTime(assignment.accepted_at),
    declinedAt: formatDateTime(assignment.declined_at),
    confirmedAt: formatDateTime(assignment.confirmed_at),
    completedAt: formatDateTime(assignment.completed_at),
    paidAt: formatDateTime(assignment.paid_at),
    publicNotes: assignment.public_notes || "Not set",
    contractTitle: contract.contract_title || "Not set",
    contractType: contract.contract_type || "Not set",
    contractSentAt: formatDateTime(contract.sent_at),
    contractViewedAt: formatDateTime(contract.viewed_at),
    contractSignedAt: formatDateTime(contract.signed_at),
    signedName: contract.signed_name || "Not set",
    pdfUrl: contract.pdf_url || ""
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
    id: item.id,
    date: dateKey(item.starts_at),
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    timezone: item.timezone || "America/Chicago",
    label: titleCase(status),
    tone: toneByStatus[status] || "blocked",
    title: item.notes || titleCase(item.source || "Availability"),
    source: titleCase(item.source || "hub"),
    notes: item.notes || ""
  };
}

function mapAvailabilityRule(item) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return {
    id: item.id,
    ruleName: item.rule_name || "Recurring availability",
    weekday: item.weekday,
    weekdayLabel: days[item.weekday] || "Day not set",
    startTime: item.start_time || "",
    endTime: item.end_time || "",
    status: item.status || "unavailable",
    statusLabel: titleCase(item.status || "unavailable"),
    notes: item.notes || "",
    isActive: Boolean(item.is_active)
  };
}

function mapProfile(teamMember, rosterProfile, user, assignments) {
  const nextGig = assignments[0]?.title || "No booked gigs";
  const payPending = assignments.filter((item) => item.paymentStatus !== "Paid").length;

  return {
    name: teamMember?.name || user?.email || "Black Label Talent",
    role: rosterProfile?.profile_type || teamMember?.role || "Talent",
    roleLabel: teamMember?.role || "Talent",
    roleKey: teamMember?.role_key || "Not set",
    roleLevel: teamMember?.role_level ?? "Not set",
    managerId: teamMember?.manager_id ?? "Not set",
    status: titleCase(rosterProfile?.profile_status || teamMember?.status || "active"),
    teamStatus: titleCase(teamMember?.status || "active"),
    rating: rosterProfile?.profile_tier || "Roster",
    nextGig,
    payPending: payPending ? `${payPending} pending` : "$0",
    city: rosterProfile?.home_base || "Not set",
    phone: teamMember?.phone || "Not set",
    email: teamMember?.email || user?.email || "",
    avatarUrl: teamMember?.avatar_url || "",
    avatarInitials: teamMember?.avatar_initials || "",
    bio: rosterProfile?.bio || "Your roster profile is connected to Black Label Hub.",
    bookingNotes: rosterProfile?.booking_notes || "",
    internalNotes: rosterProfile?.internal_notes || "",
    roles: rosterProfile?.roles_accepted?.length ? rosterProfile.roles_accepted : [teamMember?.role || "Talent"],
    notAvailableFor: rosterProfile?.not_available_for || [],
    sizes: {
      height: rosterProfile?.height || "Not set",
      weight: rosterProfile?.weight || "Not set",
      hairColor: rosterProfile?.hair_color || "Not set",
      eyeColor: rosterProfile?.eye_color || "Not set",
      shirt: rosterProfile?.shirt_size || "Not set",
      dress: rosterProfile?.dress_size || "Not set",
      shoe: rosterProfile?.shoe_size || "Not set"
    },
    socials: {
      instagram: rosterProfile?.instagram || "Not set",
      tiktok: rosterProfile?.tiktok || "Not set",
      facebook: rosterProfile?.facebook || "Not set",
      website: rosterProfile?.website || "Not set"
    },
    agreements: [{ name: "Talent Agreement", status: assignments.some((item) => item.contractStatus !== "Signed") ? "Pending" : "Signed" }]
  };
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

  const [profiles, invitations, assignments, availability, availabilityRules] = await Promise.all([
    request(`/rest/v1/roster_profiles?team_member_id=eq.${teamMember.id}&select=*&limit=1`),
    request(`/rest/v1/opportunity_invitations?team_member_id=eq.${teamMember.id}&status=in.(sent,viewed,interested,accepted)&select=*&order=created_at.desc`),
    request(`/rest/v1/work_assignments?team_member_id=eq.${teamMember.id}&select=*&order=created_at.desc`),
    request(`/rest/v1/talent_availability?team_member_id=eq.${teamMember.id}&select=*&order=starts_at.asc`),
    request(`/rest/v1/talent_availability_rules?team_member_id=eq.${teamMember.id}&select=*&order=weekday.asc,start_time.asc`)
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
    availabilityRules: availabilityRules.map(mapAvailabilityRule),
    user,
    teamMember
  };
}

export function consumePasswordRecoveryFromUrl() {
  const params = new URLSearchParams(globalThis.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (type !== "recovery" || !accessToken || !refreshToken) return false;

  const expiresIn = Number(params.get("expires_in") || 3600);
  writeSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn
  });
  globalThis.history.replaceState(null, "", `${globalThis.location.pathname}#reset-password`);
  return true;
}

export async function signInWithPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({ email: cleanValue(email)?.toLowerCase(), password })
  });

  if (!response.ok) {
    throw new Error("Login failed. Check the email and password for this talent account.");
  }

  const session = await response.json();
  writeSession(session);
  return session;
}

export async function requestPasswordReset(email) {
  const cleanEmail = cleanValue(email)?.toLowerCase();
  if (!cleanEmail) throw new Error("Enter the email for your talent account.");

  const redirectTo = `${globalThis.location.origin}${globalThis.location.pathname}#reset-password`;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({ email: cleanEmail, redirect_to: redirectTo })
  });

  if (!response.ok) {
    throw new Error("Unable to send reset email. Confirm the email and try again.");
  }

  return true;
}

export async function updatePassword(password) {
  const session = readSession();
  if (!session?.access_token) throw new Error("Open the reset link again before setting a new password.");
  if (!password || String(password).length < 8) throw new Error("Use at least 8 characters for the new password.");

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders(session),
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    throw new Error("Unable to update password. The reset link may have expired.");
  }

  clearStoredSession();
  return true;
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

export async function uploadTalentAvatar(file) {
  const dashboard = await getTalentDashboard();
  const session = readSession();
  const teamMemberId = dashboard.teamMember?.id;
  if (!teamMemberId) throw new Error("No linked team member profile was found.");
  if (!file?.size) throw new Error("Choose an avatar image first.");
  if (!file.type?.startsWith("image/")) throw new Error("Avatar must be an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Avatar image must be under 5 MB.");

  const objectPath = `avatars/${teamMemberId}/${Date.now()}-${safeFileName(file.name)}`;
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${storagePath(objectPath)}`, {
    method: "POST",
    headers: {
      ...authHeaders(session, file.type || "application/octet-stream"),
      "x-upsert": "true"
    },
    body: file
  });

  if (!uploadResponse.ok) {
    const message = await uploadResponse.text();
    throw new Error(message || "Unable to upload avatar image.");
  }

  const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${storagePath(objectPath)}`;
  await request(`/rest/v1/team_members?id=eq.${teamMemberId}`, {
    method: "PATCH",
    body: JSON.stringify({ avatar_url: avatarUrl })
  });

  return avatarUrl;
}

export async function updateInvitationStatus(invitationId, status) {
  const dashboard = await getTalentDashboard();
  if (!dashboard.teamMember?.id) throw new Error("No linked team member profile was found.");

  return request(`/rest/v1/opportunity_invitations?id=eq.${invitationId}&team_member_id=eq.${dashboard.teamMember.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      channel: "talent_portal",
      responded_at: new Date().toISOString()
    })
  });
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
    role: cleanValue(formValues.role),
    avatar_url: cleanValue(formValues.avatar_url),
    avatar_initials: cleanValue(formValues.avatar_initials)
  };

  const rosterProfileUpdates = {
    profile_type: cleanValue(formValues.profile_type || formValues.role),
    profile_tier: cleanValue(formValues.profile_tier),
    home_base: cleanValue(formValues.home_base),
    height: cleanValue(formValues.height),
    weight: cleanValue(formValues.weight),
    hair_color: cleanValue(formValues.hair_color),
    eye_color: cleanValue(formValues.eye_color),
    shirt_size: cleanValue(formValues.shirt_size),
    dress_size: cleanValue(formValues.dress_size),
    shoe_size: cleanValue(formValues.shoe_size),
    instagram: cleanValue(formValues.instagram),
    tiktok: cleanValue(formValues.tiktok),
    facebook: cleanValue(formValues.facebook),
    website: cleanValue(formValues.website),
    roles_accepted: listValue(formValues.roles_accepted),
    not_available_for: listValue(formValues.not_available_for),
    booking_notes: cleanValue(formValues.booking_notes),
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
      timezone: cleanValue(formValues.timezone) || "America/Chicago",
      status: formValues.status || "unavailable",
      notes: cleanValue(formValues.notes),
      source: "talent_portal"
    })
  });
}

export async function createTalentAvailabilityRule(formValues = {}) {
  const dashboard = await getTalentDashboard();
  const teamMemberId = dashboard.teamMember?.id;
  if (!teamMemberId) throw new Error("No linked team member profile was found.");

  return request("/rest/v1/talent_availability_rules", {
    method: "POST",
    body: JSON.stringify({
      team_member_id: teamMemberId,
      rule_name: cleanValue(formValues.rule_name),
      weekday: Number(formValues.weekday),
      start_time: cleanValue(formValues.start_time),
      end_time: cleanValue(formValues.end_time),
      status: formValues.status || "unavailable",
      notes: cleanValue(formValues.notes),
      is_active: formValues.is_active !== "false"
    })
  });
}