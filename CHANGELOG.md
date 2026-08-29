# Changelog

## 1.1.4

- mqtt-interfaces-core 0.8: the instance publishes `<name>/maintenance/stats` (memory, CPU share, event loop lag) every 60 s — `--stats-interval`, 0 = off; she shows it on the Instances tab.

## 1.1.3

- `mqttInterfaces.needs` uses the vocabulary the core documents now: `serial` (was ["serial"]) — shown as badges in she's catalog.
- Package description without the Home Assistant discovery clause (discovery is a given for adapters on the core).

## 1.1.2

### Added

- `--map-file` is declared as a user-maintained JSON file (`x-file` in `--config-schema`, core
  0.6.0) with `example-map.json` and the new `map.schema.json` — she's Services page can edit the
  map with validation and create it from the example.

### Changed

- mqtt-interfaces-core 0.4.0: `--config-schema` marks `--mqtt-password` as secret (`x-secret`).
- package.json carries the npm keyword `mqtt-interfaces` and the `mqttInterfaces` field
  (spec 2.0, env prefix, needs serial port, `SupplementaryGroups=dialout`) so adapter catalogs —
  she's Services page — can find and describe cul2mqtt.

## 1.1.1

### Fixed

- Offline detection fired too early: an S300TH at the edge of range routinely loses 10+ minutes
  of transmissions, so a WS device was marked offline after the 10 min default. Per-protocol
  defaults are now lenient (EM, WS, HMS 30 min, FHT 60 min) and self-learned timeouts only ever
  _widen_ them (median of recent gaps × 3 or largest recent gap × 1.5, whichever is larger) —
  learning adapts to devices that send slower or lose more than expected instead of tightening
  the timeout below the default.

## 1.1.0

### Added

- Device offline detection (on by default): a device that stays silent longer than its timeout gets
  a retained `<protocol>/<address>/online` item (`1`/`0`). Timeouts default to ~3 missed transmit
  cycles per protocol (EM 15 min, WS 10 min, HMS 15 min, FHT 30 min); for EM and WS the actual
  interval is learned per device (median of recent gaps × 3, `--no-learn-intervals` disables).
  Event-only protocols (FS20) are only monitored when opted in. `--no-offline-detection` turns the
  feature off.
- Map file values may be objects: `{"name": "power_dryer", "timeout": 900}` — an explicit
  `timeout` (seconds) always wins and disables learning for that device, `0` disables detection
  for it.
- `--state-dir` (default `$STATE_DIRECTORY`, set by systemd): learned intervals and last-seen
  times survive restarts.
- Home Assistant discovery uses the `online` item as per-device availability (bridge `connected`
  AND device `online`), so a silent device becomes _unavailable_ in HA instead of showing stale
  values.

## 1.0.1

- [mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core) ^0.3.0: FS20 command
  events (`status/fs20/<address>`, published with `retain: false`) are no longer re-published
  **retained** after an mqtt reconnect.

## 1.0.0

Rewrite on [mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core)
(mqtt-smarthome spec 2.x). Hard break from 0.1.x.

### Breaking

- Topics: `<name>/status/<protocol>/<address>/<field>` with one item per parsed value (protocol lower
  case, fields snake_case) instead of one JSON blob with a `cul` sub-object per device. FS20
  commands are `status/fs20/<address>` events (not retained).
- Payloads are `{"val", "ts", "lc"}` JSON (`--no-json-payloads` for plain values).
- `--map-file` is optional and has no default (the old `example-cul2mqtt.json` with personal names
  is gone; see `example-map.json`). Map keys may be item prefixes.
- `-u/--url` → `--mqtt-url` (aliases kept), `--cul-mode` choices enforced.
- Node.js ^20.19 || ^22.12 || >= 24, ES module; `yalm`, `xo`, Travis dropped.
- [cul](https://github.com/hobbyquaker/cul) 1.0 (ESM, serialport 13 with prebuilt binaries — no
  build toolchain on the Pi, built-in reconnect, promise API). Field names follow its normalised
  parser output: `battery_low` (boolean) + `battery_state` instead of `battery`, `open` instead of
  `isopen`/`window`, `valve_position`, `until`; `ws` addresses use the FHEM numbering (`1`..`8`).

### Added

- `set/fs20/<address>` (commands, booleans, percentages, JSON with timer), `set/fht/<device>/<cmd>`
  (`--fht-central`), `set/raw` behind `--raw-set`. 0.1.x never sent anything.
- Home Assistant discovery (device-based, on by default): one HA device per RF address (map-file
  name, manufacturer/model from the protocol) linked to the CUL bridge device, a sensor per field
  with device classes for temperature / humidity / rssi / power / energy, booleans as binary
  sensors (`open` → opening, `battery_low` → battery).
- `--coc`, `--scc`, `--baudrate`, `--host`/`--port` (CUNO via telnet), `--publish-raw`.
- Serial port / telnet reconnect every 10 s (by `cul`); unreachable CUL logged once at `warn`.
  Messages without a parser or with a parse error are logged at `debug` and not published.
- `<name>/info`, `maintenance/set/loglevel`, `maintenance/set/restart`, `--config-schema`,
  `--mqtt-username`/`--mqtt-password`/`--mqtt-tls-ca`, `MQTT_*` env fallback, journald-aware logging.
- `--install`/`--uninstall` systemd template unit `cul2mqtt@<name>` (service user in `dialout`),
  Dockerfile, CI, release workflow, unit tests.

## 0.1.3

Last release of the old code base (2018).
