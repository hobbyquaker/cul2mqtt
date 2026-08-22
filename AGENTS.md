# Agent instructions — cul2mqtt

## What this is

cul2mqtt bridges a Busware CUL / COC / SCC / CUNO running culfw (868 MHz RF: FS20, EM1000, HMS,
S300TH, FHT, MAX!, ...) to MQTT, following the
[mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome) convention, and announces the
items it sees to Home Assistant via MQTT discovery. It is one of many `xyz2mqtt` adapters by the
same author; the shared behaviour comes from
[mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core) (`../mqtt-interfaces-core`
when checked out next to this repo — generic fixes go there, see its README for the API). Keep
consistent with lgtv2mqtt 3.0 (the reference adapter).

## Topics

`<name>/connected` (0/1/2), `<name>/status/<protocol>/<address>[/<field>]` (retained, `{val, ts, lc}`),
`<name>/status/fs20/<address>` (event, not retained), `<name>/set/fs20/<address>`,
`<name>/set/fht/<device>/<cmd>`, `<name>/set/raw` (opt-in), `<name>/info`,
`<name>/maintenance/set/{loglevel,restart}`, `<name>/raw` (opt-in). Do not rename topics outside a
major release.

## Code layout (ES modules, node >= 20.19)

- `index.js` — `createAdapter()` from the core plus the CUL part: one `new Cul()` (the library
  reconnects by itself; we mirror `ready`/`close`/`error` into `connected`), `data` → `itemsFor()`
  → `mapItem()` → `pubStatus()`, set dispatch (`cul.cmd()` / `cul.write()` promises), debounced
  discovery when new items appear.
- `lib/items.js` — pure: parsed cul message → items; map file lookup. Extend `SKIP` / special cases
  here when a protocol publishes garbage.
- `lib/commands.js` — pure: `set/<parts>` + payload → cul command (FS20, FHT, raw).
- `lib/hadiscovery.js` — entity map from the seen items; `FIELDS` holds device classes/units.
- `lib/install.js` — core installer with `SupplementaryGroups=dialout`.
- `config.js` — adapter options on top of the core `parseConfig()`; env prefix `CUL2MQTT_`.
- `test/` — node:test unit tests for every `lib/` module (`npm test`).
- The RF protocol parsing lives in the `cul` package (`../cul` if checked out). Fix parsers there.

## Style & practices

- Plain JavaScript ES modules, 4-space indentation, eslint + prettier (`npm run lint`). Let a failing
  lint stop you.
- Run commands through WSL (Debian), not PowerShell; the repo lives at `~/repos/cul2mqtt`.
- Minimal dependencies; this runs on a Raspberry Pi next to the CUL.
- Never make defaults point at personal infrastructure or devices (no personal map file defaults).
- Log raw traffic at `debug` with `cul <` / `cul >` prefixes; an unplugged CUL is `warn`, not `error`.

## Known weak spots

- `cul` 1.0 (ESM, serialport 13, built-in reconnect): its `error` is always followed by `close`
  and a reconnect; `close()` stops the loop. To work against an unreleased sibling checkout, set
  the dep to `file:../cul` (or `file:../mqtt-interfaces-core`) — `deploy.sh` ships every `file:`
  dependency as a tarball.
- `itemsFor()` is generic over the parser output; new protocols may publish meta fields until
  added to `SKIP`. `data.error` (parse failure) and `unknown: true` (no parser) messages are dropped.
- Nothing in the set path is verified on hardware yet except what the `cul` README documents.
