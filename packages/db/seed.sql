-- DEV sample data (idempotent). Applied to the speqify D1 database.
-- NOT production data. PO password hash is for the throwaway dev password
-- "Speqify-PO-dev-2026!". Regenerate hashes with scripts/gen-hash.mjs.

INSERT OR IGNORE INTO users (id, role, email, display_name, password_hash)
VALUES (
  'usr_po_dev',
  'product_owner',
  'po@speqify.app',
  'Demo PO',
  'pbkdf2$100000$apXfTrvVfuxSxAjjNZC6-g$cha1mfP_EnhXCxPKPyTvBEiAscNt1LnrQmwd9ivgpa8'
);

INSERT OR IGNORE INTO projects (id, name, product_owner_id, environment_urls, template)
VALUES (
  'prj_demo',
  'Demo Project',
  'usr_po_dev',
  '["http://localhost:5173"]',
  '{"language":"en","userStory":true,"acceptanceCriteria":true,"labels":[],"components":[],"versions":[],"customFields":{}}'
);

INSERT OR IGNORE INTO panels (id, project_id, audience, secret_token, environment_url, status)
VALUES (
  'pnl_demo',
  'prj_demo',
  'client',
  'demo-panel-token',
  'http://localhost:5173',
  'open'
);
