/* Sprout — runtime configuration.
   These are PUBLIC keys (publishable / anon). They are safe to ship in the
   client: the database is protected by Row Level Security, not by hiding keys.
   The customer app reads the loan catalogue straight from the back-office DB;
   if the API is unreachable the app falls back to its built-in catalogue. */
window.SPROUT_CONFIG = {
  supabaseUrl: 'https://luhnjwfpiwnldcsulyex.supabase.co',
  supabaseKey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV',

  // REST endpoint the products screen reads (only active rows, ordered by sort).
  productsApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/products' +
    '?select=name,tag,tag_class,desc:description,stat1_label,stat1_value,stat2_label,stat2_value,featured' +
    '&active=eq.true&order=sort.asc',
  productsHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' },

  // enabled pre-screening rules the customer's screening step reads (back-office controlled)
  prescreenApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/prescreen_rules' +
    '?select=key,label,enabled,config,product&order=sort.asc',
  prescreenHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' },

  // active document requirements the upload step reads (back-office controlled)
  docsApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/doc_requirements' +
    '?select=key,label,description,icon,requirement,source&active=eq.true&order=sort.asc',
  docsHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' },

  // customer application case (created on submit, status read back on the result screen)
  casesApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/cases',
  casesHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' },

  // customer document uploads → Supabase Storage (bucket: case-docs) + metadata table
  storageUploadUrl: 'https://luhnjwfpiwnldcsulyex.supabase.co/storage/v1/object/case-docs/',
  storagePublicUrl: 'https://luhnjwfpiwnldcsulyex.supabase.co/storage/v1/object/public/case-docs/',
  caseDocsApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/case_documents',

  // mock credit-bureau lookup (National ID -> score) the screening step reads
  creditBureauApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/credit_bureau',
  creditBureauHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' },

  // customer profile captured at sign-up (shown on the home screen)
  customersApi: 'https://luhnjwfpiwnldcsulyex.supabase.co/rest/v1/customers',
  customersHeaders: { apikey: 'sb_publishable_2yGL94L0n6HScZCJnYRyNA_LvcnMgoV' }

  // ── ID-card verification (e-KYC) ──────────────────────────────────────────
  // Leave unset to use the built-in local format-check stub. To plug in a real
  // third-party eKYC/OCR provider later, set the endpoint (and any auth headers)
  // here; id-verify.js will POST { side, image } and expect
  //   { ok, confidence, checks, reason }  in return:
  // , idVerifyApi: 'https://your-ekyc-provider.example/verify'
  // , idVerifyHeaders: { Authorization: 'Bearer <token>' }
};
