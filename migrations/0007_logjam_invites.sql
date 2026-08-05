-- Dynamic LogJam invitation allow-list. Cloudflare Access verifies control of an
-- email address; the LogJam Worker authorizes that normalized address from here.

CREATE TABLE IF NOT EXISTS logjam_invites (
  email_normalized TEXT PRIMARY KEY COLLATE NOCASE,
  invited_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO logjam_invites (email_normalized, invited_at, updated_at)
VALUES
  (
    'jacobjshmol@gmail.com',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),
  (
    'rubishelkay@gmail.com',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
