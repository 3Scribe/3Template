-- Scaffold metadata only. Product tables belong to later milestones.
CREATE TABLE instance_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT INTO instance_metadata (key, value) VALUES ('scaffold_version', '1');
