-- Local development only (docker-compose.dev.yml). Production roles are set up
-- by hand with a generated password; see docs/deployment-vps.md.
CREATE ROLE gpc LOGIN PASSWORD 'gpc';
CREATE ROLE gpc_app NOLOGIN;
GRANT gpc_app TO gpc;
CREATE DATABASE gpc OWNER gpc;
-- Scratch database for the backend tests, which wipe it.
CREATE DATABASE gpc_test OWNER gpc;
