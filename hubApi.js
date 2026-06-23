const SUPABASE_URL =
  globalThis.BLACK_LABEL_SUPABASE_URL ||
  "https://xopcttkrmjvwdddawdaa.supabase.co";

const SUPABASE_ANON_KEY =
  globalThis.BLACK_LABEL_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcGN0dGtybWp2d2RkZGF3ZGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTQzNjgsImV4cCI6MjA3MTczMDM2OH0.5s1HHvDsDIgWw6TVR3YfhzJC9uEjcVfunRyMa6B7xYY";

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

function endpoint(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

async function request(path, options = {}) {
  const res = await fetch(endpoint(path), {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function getTalentEmail() {
  return (
    localStorage.getItem("black_label_talent_email") ||
    globalThis.BLACK_LABEL_TALENT_EMAIL ||
    ""
  ).trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "Time TBD";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(row) {
  if (!row?.pay_rate) return "Pay TBD";
  const amount = Number(row.pay_rate).toLocaleString("en-US", {
    style: "currency",
    currency: row.pay_currency || "USD",
    maximumFractionDigits: 0,
  });
  return row.pay_type === "hourly" ? `${amount}/hr` : `${amount} ${row.pay_type || "flat"}`;
}

function normalizeProfile(member, profile) {
  return {
    id: member?.id || null,
    name: member?.name || member?.email || "Talent",
    email: member?.email || "",
    phone: member?.phone || "",
    role: member?.role || profile?.profile_type || "Talent",
    status: profile?.profile_status || member?.status || "Active",
    rating: profile?.profile_tier || "Preferred",
    city: profile?.home_base || "",
    bio: profile?.bio || "",
    instagram: profile?.instagram || "",
    tiktok: profile?.tiktok || "",
    facebook: profile?.facebook || "",
    website: profile?.website || "",
    height: profile?.height || "",
    shirtSize: profile?.shirt_size || "",
    shoeSize: profile?.shoe_size || "",
    bookingNotes: profile?.booking_notes || "",
    rolesAccepted: profile?.roles_accepted || [],
    notAvailableFor: profile?.not_available_for || [],
    nextGig: "No gig booked",
    payPending: "$0",
  };
}

function normalizeInvitation(row) {
  const job = row.work_opportunities || {};
  const role = row.work_opportunity_roles || {};

  return {
    id: row.id,
    invitationId: row.id,
    title: job.title || "Opportunity",
    date: formatDate(job.starts_at),
    time: formatTime(job.starts_at),
    location: [job.location_name, job.city, job.state].filter(Boolean).join(", ") || "Location TBD",
    role: role.role_label || "General",
    pay: money(role),
    status: row.status === "sent" ? "Open" : row.status,
    requirements: role.requirements || job.description || "",
    deliverables: job.notes || "Details will be provided by Black Label.",
    notes: job.description || "",
    contractStatus: role.contract_required ? "Needs signature" : "Not required",
    manualLabor: role.labor_required ? "Yes" : "No",
    contentRequired: role.content_required ? "Yes" : "No",
    appearanceRequired: role.appearance_required ? "Yes" : "No",
    dressCode: role.requirements || "See booking notes",
  };
}

function normalizeAssignment(row) {
  const job = row.work_opportunities || {};
  const role = row.work_opportunity_roles || row;

  return {
    id: row.id,
    title: job.title || "Assignment",
    date: formatDate(job.starts_at),
    time: formatTime(job.starts_at),
    location: [job.location_name, job.city, job.state].filter(Boolean).join(", ") || "Location TBD",
    role: role.role_label || "General",
    pay: money(row.pay_rate ? row : role),
    status: row.assignment_status || "confirmed",
    contractStatus: row.contract_status || "not_sent",
    paymentStatus: row.pay_status || "not_ready",
  };
}

function normalizeAvailability(row) {
  return {
    id: row.id,
    date: String(row.starts_at || "").slice(0, 10),
    label: row.status,
    title: row.notes || row.status,
    tone:
      row.status === "available"
        ? "open"
        : row.status === "tentative"
          ? "hold"
          : row.status === "vacation"
            ? "blocked"
            : "blocked",
  };
}

export async function getTalentDashboard() {
  const email = getTalentEmail();

  if (!email) {
    return {
      needsLogin: true,
      profile: normalizeProfile(null, null),
      openGigs: [],
      assignments: [],
      calendarDays: [],
    };
  }

  const members = await request(
    `team_members?select=id,user_id,name,email,phone,role,role_key,status&email=eq.${encodeURIComponent(email)}&limit=1`
  );

  const member = members?.[0];

  if (!member) {
    return {
      needsLink: true,
      profile: normalizeProfile({ email }, null),
      openGigs: [],
      assignments: [],
      calendarDays: [],
    };
  }

  const [profiles, invites, assignments, availability] = await Promise.all([
    request(`roster_profiles?select=*&team_member_id=eq.${member.id}&limit=1`),
    request(
      `opportunity_invitations?select=*,work_opportunities(*),work_opportunity_roles(*)&team_member_id=eq.${member.id}&order=created_at.desc`
    ),
    request(
      `work_assignments?select=*,work_opportunities(*),work_opportunity_roles(*)&team_member_id=eq.${member.id}&order=created_at.desc`
    ),
    request(
      `talent_availability?select=*&team_member_id=eq.${member.id}&order=starts_at.asc`
    ),
  ]);

  const profile = normalizeProfile(member, profiles?.[0] || null);
  const openGigs = (invites || [])
    .filter((row) => ["drafted", "sent", "viewed", "interested"].includes(row.status))
    .map(normalizeInvitation);

  const myAssignments = (assignments || []).map(normalizeAssignment);
  const calendarDays = [
    ...(availability || []).map(normalizeAvailability),
    ...myAssignments.map((gig) => ({
      id: gig.id,
      date: String(gig.date),
      label: "Booked",
      title: gig.title,
      tone: "confirmed",
    })),
  ];

  profile.nextGig = myAssignments[0]?.title || "No gig booked";
  profile.payPending = `$${myAssignments
    .filter((row) => ["pending", "approved", "not_ready"].includes(row.paymentStatus))
    .length}`;

  return {
    profile,
    openGigs,
    assignments: myAssignments,
    calendarDays,
  };
}

export async function acceptGig(gigId) {
  return updateInvitation(gigId, "accepted");
}

export async function declineGig(gigId) {
  return updateInvitation(gigId, "declined");
}

export async function markInterested(gigId) {
  return updateInvitation(gigId, "interested");
}

async function updateInvitation(invitationId, status) {
  return request(`opportunity_invitations?id=eq.${invitationId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      responded_at: new Date().toISOString(),
    }),
  });
}

export async function saveTalentProfile(profile) {
  const email = getTalentEmail();
  if (!email) throw new Error("Missing talent email.");

  const members = await request(
    `team_members?select=id&email=eq.${encodeURIComponent(email)}&limit=1`
  );

  const member = members?.[0];
  if (!member) throw new Error("No team member record found for this email.");

  await request(`team_members?id=eq.${member.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: profile.name,
      phone: profile.phone,
    }),
  });

  const existing = await request(
    `roster_profiles?select=id&team_member_id=eq.${member.id}&limit=1`
  );

  const payload = {
    team_member_id: member.id,
    bio: profile.bio,
    home_base: profile.city,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    facebook: profile.facebook,
    website: profile.website,
    height: profile.height,
    shirt_size: profile.shirtSize,
    shoe_size: profile.shoeSize,
    booking_notes: profile.bookingNotes,
  };

  if (existing?.[0]?.id) {
    return request(`roster_profiles?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  return request("roster_profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function saveAvailability({ starts_at, ends_at, status, notes }) {
  const email = getTalentEmail();
  if (!email) throw new Error("Missing talent email.");

  const members = await request(
    `team_members?select=id&email=eq.${encodeURIComponent(email)}&limit=1`
  );

  const member = members?.[0];
  if (!member) throw new Error("No team member record found for this email.");

  return request("talent_availability", {
    method: "POST",
    body: JSON.stringify({
      team_member_id: member.id,
      starts_at,
      ends_at,
      status,
      notes,
      source: "talent_portal",
    }),
  });
}

export { SUPABASE_URL };
