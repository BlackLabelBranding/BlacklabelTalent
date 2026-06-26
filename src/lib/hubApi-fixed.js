async function loadTalentPublicConfig() {
  const response = await fetch("https://xopcttkrmjvwdddawdaa.supabase.co/functions/v1/talent-public-config", {
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Talent auth config could not load.");
  return response.json();
}

try {
  const config = await loadTalentPublicConfig();
  if (config?.url) globalThis.BLACK_LABEL_SUPABASE_URL = config.url;
  if (config?.key) globalThis.BLACK_LABEL_SUPABASE_ANON_KEY = config.key;
} catch (error) {
  console.warn("Using bundled Talent auth config fallback.", error);
}

const api = await import("./hubApi.js?wrapped=20260624x");

export const SUPABASE_URL = api.SUPABASE_URL;
export const SUPABASE_ANON_KEY = api.SUPABASE_ANON_KEY;
export const signInWithPassword = api.signInWithPassword;
export const signOut = api.signOut;
export const getAuthState = api.getAuthState;
export const getTalentDashboard = api.getTalentDashboard;
export const updateInvitationStatus = api.updateInvitationStatus;
export const acceptGig = api.acceptGig;
export const interestedGig = api.interestedGig;
export const declineGig = api.declineGig;
export const updateTalentProfile = api.updateTalentProfile;
export const createTalentAvailability = api.createTalentAvailability;
export const createTalentAvailabilityRule = api.createTalentAvailabilityRule;
