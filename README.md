# Kipinä CV bank

What we're building: [intent.md](intent.md). Rules for coding agents: [AGENTS.md](AGENTS.md).

## Running agents in a sandbox

Coding agents run unattended in [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/)
([install `sbx`](https://docs.docker.com/ai/sandboxes/install/)), configured in `sbxenv.yaml`.

```sh
sbx env plan                             # review before first run and after config changes. You can choose "balanced" for the network egress config for this repo
sbx env run                              # Claude Code
sbx env run --env-arg agent=cursor       # Cursor
```

## Connecting your IDE to the sandbox

- [VS Code](https://docs.docker.com/ai/sandboxes/integrations/vscode/)
- [Cursor](https://docs.docker.com/ai/sandboxes/integrations/cursor/)

The agent works in its own git clone. Pull its work with:

```sh
git fetch sandbox-kipina-cv-claude       # or sandbox-kipina-cv-cursor
git diff main..sandbox-kipina-cv-claude/<branch>
```

- Always start with `sbx env run`. A plain `sbx run` mounts this checkout read-write.
- Review changes to `sbxenv.yaml` and `kits/` before merging: they run on your host.
- Keep secrets and real CV data out of this folder. The agent can read all of it.
