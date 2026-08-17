/* ---------------------------------------------------------------------
   Copy this file to js/config.js for local development.

   js/config.js is git-ignored. On Vercel it is generated at build time
   from the SUPABASE_URL and SUPABASE_ANON_KEY environment variables by
   scripts/generate-config.js — see README.md.

   Only the publishable / anon key belongs here. The service-role key
   must NEVER appear in any file that ships to the browser.
--------------------------------------------------------------------- */
window.DS_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  STORAGE_BUCKET: "deep-skilling-documents",
};
