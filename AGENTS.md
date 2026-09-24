# Agent rules

See `intent.md` for what we are building and why.

- Work on a feature branch, never on main.
- Treat all CV data as real personal data: never send it to external services, paste it
  into URLs, or add network calls that upload it.
- Do not edit `sbxenv.yaml` or anything under `kits/`. They configure the agent sandbox and
  must be changed by a human. Propose such changes in your summary instead.
