# Roadmap — cul2mqtt

The fleet-wide plan (spec, core lib, HA discovery, fleet manager) lives in
[mqtt-interfaces](https://github.com/hobbyquaker/mqtt-interfaces/blob/main/ROADMAP.md); the core
lib in [mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core). cul2mqtt is the
second adapter on the core (after lgtv2mqtt 3.0, before lgsb2mqtt 2.0) and the first one with a
serial device and with dynamically appearing items.

## 1.0.0 — rewrite on mqtt-interfaces-core (2026-08-22)

See CHANGELOG.md. Decisions:

- **U-1** Items are `<protocol>/<address>/<field>`, one per parsed value, derived generically from
  the cul parser output (skip list for meta fields, camelCase → snake_case). FS20 and FHT have
  special handling (command as event / command name as item).
- **U-2** The map file stays (optional). Device naming is data, not configuration, and cannot live
  in env vars (D-7 is about config). Keys are item prefixes, case-insensitive.
- **U-3** HA discovery is built from the items seen at runtime (sensors only): one HA device per RF
  address (`<protocol>/<address>` or its map name) behind the CUL as bridge device (`via_device`,
  core `discovery()` returning an array). FS20 actuators cannot be discovered (receive-only
  protocol), so no switches are created automatically.
- **U-4** cul2mqtt 1.0 builds on [cul](https://github.com/hobbyquaker/cul) 1.0 (ESM, serialport 13
  with prebuilds, built-in reconnect, promise API, normalised field names). No local reconnect
  loop, no per-protocol field special cases beyond FS20/FHT. Messages with `data.error` or
  `unknown: true` are dropped at `debug`.

## Open

- [x] Release 1.0.0 (tag `v1.0.0`; deps `cul ^1.0.0`, `mqtt-interfaces-core ^0.2.0` from npm) —
      done 2026-08-22 (npm, GitHub release). For unreleased sibling work, point a dep at
      `file:../<dir>` — `deploy.sh` ships such deps as tarballs.
- [ ] Verify on real hardware: CUL with FS20 + S300TH + EM1000 (receive), FS20 send, `--install`
      on the home server, HA entities.
- [ ] Docker image: document `--group-add` for the serial port gid; consider `--device` hints in the
      README (done) and an e2e test with a mocked serial port.
- [ ] FHT send path (`--fht-central`) is untested.
- [ ] Map file: allow an object value with HA hints (`{"name": "doorbell", "platform": "event"}`) so
      FS20 remotes become HA `event` entities and known actuators `switch`es with `set/fs20/...`.
- [ ] MAX! (MORITZ) send support once the cul library has it (planned for cul 1.1).
- [ ] Send support for the other protocols cul 1.0 can transmit (Intertechno, Somfy RTS with
      persisted rolling codes, Hoermann, UNIRoll) as `set/<protocol>/...`.
- [ ] Device discovery (`--discover`, B-2): list serial ports with a CUL (USB VID/PID 03EB:204B) and
      `V` version probe (cul 1.0 parses the answer as `{protocol: 'culfw'}`).
- [x] Device offline detection — done in 1.1.0 (see CHANGELOG and README): retained
      `<protocol>/<address>/online` when a device stays silent past its timeout; lenient
      per-protocol defaults (revised in 1.1.1 — SlowRF loses whole strings of transmissions, so
      learned timeouts only widen, never tighten; `--no-learn-intervals`), explicit
      map-file `timeout` wins (`0` disables), persisted in `--state-dir`, wired into HA discovery
      as per-device availability (core 0.3.0 `availability`). Prior art researched 2026-08-25: FHEM
      has this built in only for HomeMatic (ActionDetector, per-device `actCycle`, default 600 s),
      everything else is a manual `watchdog` per device; zigbee2mqtt uses two coarse classes
      (active 10 min / passive 25 h) plus per-device override. Map file object values carry
      `timeout` only so far — the HA-hints item above stays open.
