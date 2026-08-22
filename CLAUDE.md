@AGENTS.md

## Shell / environment

- **Always run commands through WSL (Debian), never PowerShell.** Use `wsl -d Debian -- bash -lc '<cmd>'`.
- The repo lives at `~/repos/cul2mqtt` inside WSL; mqtt-interfaces-core, lgtv2mqtt (nested
  `lgtv2mqtt/lgtv2mqtt`) and lgsb2mqtt are siblings under `~/repos/`.
