# Persistent VSLA data

The application writes its records to `DATA_DIR/db.json`. For a laptop or a
traditional server, the default `data` directory is persistent. For a hosted
deployment, create and mount a persistent disk/volume, then set `DATA_DIR` to
that mount (for example, `/var/lib/vsla-data`).

Vercel's deployed filesystem is read-only. The server now automatically uses
`/tmp` there so it can respond instead of crashing, but `/tmp` is temporary.
For permanent financial records, deploy the API to a host with a persistent
volume or finish the existing Convex database migration and configure its URL.

Database writes are atomic, so a restart during a save leaves either the old
complete database or the new complete database. Back up the mounted data
volume regularly.
