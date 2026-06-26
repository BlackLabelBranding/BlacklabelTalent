const endpoint = "https://xopcttkrmjvwdddawdaa.supabase.co/functions/v1/talent-public-config";
try {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (response.ok) {
    const config = await response.json();
    if (config?.url) globalThis.BLACK_LABEL_SUPABASE_URL = config.url;
    if (config?.key) globalThis.BLACK_LABEL_SUPABASE_ANON_KEY = config.key;
  }
} catch (error) {
  console.warn("Talent runtime config unavailable", error);
}
