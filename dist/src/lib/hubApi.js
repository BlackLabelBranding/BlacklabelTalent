import { talentProfile, gigOpportunities, myAssignments, calendarDays } from "../data/mockData.js";

const HUB_API_BASE_URL = globalThis.BLACK_LABEL_HUB_API_BASE_URL || "https://blacklabelhub.com/api";

export async function getTalentDashboard() {
  // Future wiring point:
  // return fetch(`${HUB_API_BASE_URL}/talent/dashboard`, { credentials: "include" }).then((res) => res.json());
  return {
    profile: talentProfile,
    openGigs: gigOpportunities,
    assignments: myAssignments,
    calendarDays
  };
}

export async function acceptGig(gigId) {
  // Future wiring point:
  // return fetch(`${HUB_API_BASE_URL}/talent/gigs/${gigId}/accept`, { method: "POST", credentials: "include" });
  return { ok: true, gigId };
}

export async function declineGig(gigId) {
  // Future wiring point:
  // return fetch(`${HUB_API_BASE_URL}/talent/gigs/${gigId}/decline`, { method: "POST", credentials: "include" });
  return { ok: true, gigId };
}

export { HUB_API_BASE_URL };
