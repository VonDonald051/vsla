# Persistent VSLA data

The application writes its records to `DATA_DIR/db.json`. For a laptop or a
traditional server, the default `data` directory is persistent. For a hosted
deployment, create and mount a persistent disk/volume, then set `DATA_DIR` to
that mount (for example, `/var/lib/vsla-data`). Do not use `/tmp` or deploy to
an ephemeral/serverless filesystem: those locations are reset and cannot keep
financial records permanently.

Database writes are atomic, so a restart during a save leaves either the old
complete database or the new complete database. Back up the mounted data
volume regularly.
