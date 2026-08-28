# cul2mqtt

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[![NPM version](https://badge.fury.io/js/cul2mqtt.svg)](http://badge.fury.io/js/cul2mqtt)
[![CI](https://github.com/hobbyquaker/cul2mqtt/actions/workflows/ci.yml/badge.svg)](https://github.com/hobbyquaker/cul2mqtt/actions/workflows/ci.yml)
[![License][gpl-badge]][gpl-url]

> Interface between a [Busware](https://busware.de) CUL / COC / SCC / CUNO running
> [culfw](http://culfw.de) and MQTT 📡 — FS20, EM1000, HMS, S300TH, FHT, MAX!, ... with Home
> Assistant discovery

Built on the [cul](https://github.com/hobbyquaker/cul) library and
[mqtt-interfaces-core](https://github.com/hobbyquaker/mqtt-interfaces-core).

Upgrading from 0.1.x? Topics changed — see [CHANGELOG.md](CHANGELOG.md).

## Getting started

### Install and run

```
npm install -g cul2mqtt
cul2mqtt --serialport /dev/ttyACM0 --mqtt-url mqtt://192.168.1.2
```

The user running cul2mqtt needs access to the serial port (usually group `dialout`). Received
telegrams show up as `cul/status/<protocol>/<address>/<field>` right away; `-v debug` prints the
raw traffic (`cul <` / `cul >`).

`cul2mqtt --help` lists all options; every option can also be set via an environment variable
(`CUL2MQTT_SERIALPORT`, `CUL2MQTT_MQTT_URL`, `CUL2MQTT_NAME`, ...).

| option                               | default            | description                                                                      |
| ------------------------------------ | ------------------ | -------------------------------------------------------------------------------- |
| `-s, --serialport`                   | `/dev/ttyACM0`     | serial port of the CUL / COC / SCC                                               |
| `--baudrate`                         | `9600`             | serial baud rate (`38400` with `--coc` / `--scc`)                                |
| `-c, --cul-mode`                     | `SlowRF`           | RF mode: `SlowRF` (FS20, HMS, EM, S300TH, FHT, ...), `MORITZ` (MAX!) or `AskSin` |
| `--coc`, `--scc`                     | off                | device is a Busware COC / SCC on a Raspberry Pi                                  |
| `--host`, `--port`                   | , `2323`           | CUNO / CUNO2 via telnet instead of a serial port                                 |
| `-m, --map-file`                     |                    | JSON file with friendly item names (see below)                                   |
| `--fht-central`                      |                    | FHT central code (4 hex digits), required for `cul/set/fht`                      |
| `--offline-detection`                | on                 | mark silent devices offline on `cul/status/<protocol>/<address>/online`          |
| `--learn-intervals`                  | on                 | widen offline timeouts from observed per-device message gaps                     |
| `--state-dir`                        | `$STATE_DIRECTORY` | directory for persisted state (learned intervals); set by systemd                |
| `--publish-raw`                      | off                | additionally publish every raw culfw line on `cul/raw`                           |
| `--raw-set`                          | off                | accept raw culfw commands on `cul/set/raw` (see below)                           |
| `-u, --mqtt-url`                     | `mqtt://localhost` | broker URL, see [MQTT.js](https://github.com/mqttjs/MQTT.js#connect-using-a-url) |
| `--mqtt-username`, `--mqtt-password` |                    | broker credentials                                                               |
| `-n, --name`                         | `cul`              | instance name, used as topic prefix                                              |
| `--json-payloads`                    | on                 | status as `{"val", "ts", "lc"}` JSON; `--no-json-payloads` for plain values      |
| `--ha-discovery`                     | on                 | Home Assistant MQTT discovery (`--no-ha-discovery` disables and clears it)       |
| `--ha-prefix`                        | `homeassistant`    | discovery prefix                                                                 |
| `--no-maintenance`                   | (on)               | disable the `maintenance/set/loglevel` and `restart` topics (see below)          |
| `--mqtt-client-id-prefix`            |                    | prefix for the mqtt client id                                                    |
| `--mqtt-tls-ca`                      |                    | CA certificate file for `mqtts://` brokers                                       |
| `--config-schema`                    |                    | print a JSON Schema of all options and exit                                      |
| `-v, --verbosity`                    | `info`             | `error`, `warn`, `info`, `debug`                                                 |

### Docker

Multi-arch image (amd64, arm64, armv7):

```
docker run -d --name cul2mqtt --restart unless-stopped --device /dev/ttyACM0 --group-add $(stat -c %g /dev/ttyACM0) \
  -e CUL2MQTT_SERIALPORT=/dev/ttyACM0 -e CUL2MQTT_MQTT_URL=mqtt://192.168.1.2 \
  ghcr.io/hobbyquaker/cul2mqtt
```

`--device` passes the CUL through, `--group-add` gives the unprivileged container user the
serial port's group. A map file can be mounted and referenced with `CUL2MQTT_MAP_FILE`.

### Run as a systemd service

```
sudo cul2mqtt --install --name cul --serialport /dev/ttyACM0 --mqtt-url mqtt://192.168.1.2
```

`--install` creates a system user `cul2mqtt` (member of `dialout` for the serial port), writes the
given options to `/etc/cul2mqtt/<name>.env` (`CUL2MQTT_*` variables — edit and
`systemctl restart cul2mqtt@<name>` to change), installs the template unit
`/etc/systemd/system/cul2mqtt@.service` and enables + starts `cul2mqtt@<name>`. The instance name
is the `--name` option, i.e. the MQTT topic prefix. Logs: `journalctl -u cul2mqtt@<name> -f`.

**Several CULs** (e.g. one in SlowRF and one in MORITZ mode): run `--install` once per device with
a different `--name` — each becomes its own instance `cul2mqtt@<name>` with its own config and
topic prefix, sharing one template unit and one system user:

```
sudo cul2mqtt --install --name cul  --serialport /dev/ttyACM0 --mqtt-url mqtt://broker
sudo cul2mqtt --install --name max  --serialport /dev/ttyACM1 --cul-mode MORITZ --mqtt-url mqtt://broker
systemctl status 'cul2mqtt@*'
```

`sudo cul2mqtt --uninstall --name max` removes one instance (the template unit goes with the last
one).

Tip: with several USB serial devices use a stable path like
`/dev/serial/by-id/usb-busware.de_CUL868-if00` instead of `/dev/ttyACM0`.

### Deploy to a host (developers)

`deploy.sh [user@host]` packs the module, copies it to the host, installs it under
`/usr/local/lib/node_modules/cul2mqtt` and restarts every `cul2mqtt@<name>` service there
(`SERVICE`, `REMOTE_DIR`, `SKIP_TESTS` env vars, see the script). Install the service once with
`--install` first.

## Topics

Topics and payloads follow the [mqtt-smarthome architecture](https://github.com/mqtt-smarthome/mqtt-smarthome).
`cul` is the instance name (`--name`).

### `cul/connected`

Retained. `0` = cul2mqtt is not running (set via last will), `1` = connected to the broker but the
CUL is not open (unplugged, wrong port, telnet down — retried every 10 s), `2` = connected to both.

### `cul/status/<protocol>/<address>/<field>`

One retained item per parsed value. Every status is
`{"val": <value>, "ts": <ms received>, "lc": <ms last changed>}` (mqtt-smarthome); with
`--no-json-payloads` the plain value is published instead. Protocol names are lower case, field
names snake_case; `rssi` is published alongside when the CUL reports it.

| protocol | devices                           | example topics                                                                                                                                                         |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fs20`   | FS20 remotes, sensors, actuators  | `cul/status/fs20/6C4800` — the received command (`on`, `off`, `toggle`, `dim50%`, ...) as an **event, not retained**; `cul/status/fs20/6C4800/time` for timer commands |
| `em`     | EM1000 power / gas / water meters | `cul/status/em/0205/current`, `cul/status/em/0205/total`, `cul/status/em/0205/peak`                                                                                    |
| `ws`     | S300TH, KS300, ...                | `cul/status/ws/1/temperature`, `cul/status/ws/1/humidity`                                                                                                              |
| `hms`    | HMS100T, HMS100TF, ...            | `cul/status/hms/A5E3/temperature`, `cul/status/hms/A5E3/humidity`, `cul/status/hms/A5E3/battery`                                                                       |
| `fht`    | FHT80b thermostats                | `cul/status/fht/1234/measured_temp`, `cul/status/fht/1234/desired_temp`, `cul/status/fht/1234/actuator`                                                                |
| `moritz` | MAX! (`--cul-mode MORITZ`)        | `cul/status/moritz/0A1B2C/measured_temperature`, `cul/status/moritz/0A1B2C/valveposition`, `cul/status/moritz/0A1B2C/isopen`                                           |

What exactly is published depends on the parsers in the [cul](https://github.com/hobbyquaker/cul)
library.

`cul/info` (retained JSON) describes the running instance: adapter name and version, implemented
mqtt-smarthome spec version, node version, host, pid, start time, whether maintenance topics are on.

#### Map file

`--map-file names.json` replaces addresses with friendly names. Keys are item prefixes
(`<protocol>/<address>` or `<protocol>/<address>/<field>`, case-insensitive), values the name that
replaces the matched part:

```json
{
  "EM/0205": "power_dishwasher",
  "FS20/6C4800": "doorbell",
  "WS/1": "living_room",
  "WS/4/temperature": "garden_temperature"
}
```

→ `cul/status/power_dishwasher/current`, `cul/status/doorbell` (event),
`cul/status/living_room/temperature`, `cul/status/garden_temperature`. See
[example-map.json](example-map.json).

A value may also be an object: `{"name": "power_dryer", "timeout": 900}` — `name` renames as
above, `timeout` sets the offline detection timeout in seconds for that device (see below).

### `cul/status/<protocol>/<address>/online`

Retained, `1`/`0`. Offline detection (on by default, `--no-offline-detection` disables it): a
device that stays silent longer than its timeout is marked offline. The timeout per device is, in
order of precedence:

1. an explicit `timeout` (seconds) in the map file object value — always wins, disables interval
   learning for that device; `0` turns detection off for the device.
2. self-learned from the observed message gaps — only ever _wider_ than the protocol default
   (median of the recent gaps × 3, or the largest recent gap × 1.5, whichever is larger), so
   devices that send slower or lose more messages than expected don't flap. Disable with
   `--no-learn-intervals`.
3. a lenient per-protocol default: EM, WS and HMS 30 min, FHT 60 min. SlowRF reception routinely
   loses several transmissions in a row, so a missed cycle or three is normal, not offline.

Event-only protocols (FS20 remotes ring when someone presses them, not on a schedule) are never
marked offline unless a map file `timeout` opts them in. Learned intervals and last-seen times are
persisted in `--state-dir` (systemd sets `$STATE_DIRECTORY=/var/lib/cul2mqtt/<name>`; without a
state dir learning starts over on restart).

### `cul/set/fs20/<address>`

Sends an FS20 command. `<address>` is housecode + address as 6 hex digits (`6C4800`) or
`<housecode>/<address>` (`6C48/00`, ELV notation works too). Payload is a plain value or
mqtt-smarthome style JSON (`{"val": "on"}`):

| payload                                                                                               | sends                                                |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `on`, `off`, `true`, `false`, `1`, `0`                                                                | `on` / `off`                                         |
| `0`..`100`                                                                                            | nearest dim step (`dim06%` ... `dim100%`, 0 = `off`) |
| `toggle`, `dimup`, `dimdown`, `dimupdown`, `on-for-timer`, `off-for-timer`, `sendstate`, `reset`, ... | the FS20 command as culfw names it                   |
| `{"cmd": "on-for-timer", "time": 120}`                                                                | command with a timer in seconds                      |
| `11`..`ff` (2 hex digits)                                                                             | raw FS20 command byte                                |

```
mosquitto_pub -t cul/set/fs20/6C4800 -m on
mosquitto_pub -t cul/set/fs20/6C4801 -m 50
mosquitto_pub -t cul/set/fs20/6C4802 -m '{"cmd": "on-for-timer", "time": 300}'
```

### `cul/set/fht/<device>/<command>`

Sends an FHT command (`desired-temp`, `mode`, `day-temp`, `night-temp`, ... as in
[culfw](http://culfw.de/commandref.html)); needs `--fht-central <code>`. The payload is the value,
alternatively JSON `{"cmd": "desired-temp", "value": 21.5}` on `cul/set/fht/<device>`.

```
mosquitto_pub -t cul/set/fht/1234/desired-temp -m 21.5
```

### `cul/set/raw`

With `--raw-set`, any culfw command line is written to the CUL (`F6C480011`, `X21`, ...). This is
an unrestricted RF transmitter — protect your broker with authentication/ACLs before enabling it.
`--publish-raw` does the opposite: every line received from the CUL is published on `cul/raw`
(not retained), useful for unsupported protocols.

### `cul/maintenance/set/<command>`

| command    | payload                            |                                                                                           |
| ---------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `loglevel` | `error`, `warn`, `info` or `debug` | change the log level at runtime (e.g. to see `cul >`/`cul <` traffic without a restart)   |
| `restart`  | anything                           | graceful shutdown (`connected 0`) and exit 0; systemd (`Restart=always`) / Docker restart |

Anyone who can publish to your broker can use these. Use broker authentication and ACLs, or
disable them with `--no-maintenance`.

## Home Assistant

MQTT discovery is on by default (HA ≥ 2024.11, device-based discovery). Every RF address the CUL
hears becomes its own HA device — `ws/1` or, with a map file, `living_room` — with a sensor per
field (temperature, humidity, signal strength, power etc. get the matching device class and unit;
booleans like `open` or `battery_low` become binary sensors) and the
manufacturer/model derived from the protocol (`ELV S300TH`, `ELV EM1000`, `ELV FHT80b`, `eQ-3 MAX!`,
...). The devices are linked to the CUL itself, which appears as a bridge device with a
_Connected_ diagnostic. Devices are announced as they show up on air (each address has to send
once); availability follows `cul/connected` — and, with offline detection (the default), the
per-device `online` item: a device that stops sending becomes _unavailable_ in HA on its own.

FS20 is receive-only for the CUL, so actuators cannot be discovered and no switches are created
automatically; an FS20 remote appears as a device with one sensor holding the last command.
`--no-ha-discovery` disables discovery and removes all announcements on startup; `--ha-prefix`
changes the discovery prefix.

## Notes

- An unplugged or busy CUL is logged once at `warn`; the connection is retried every 10 s and
  `cul/connected` goes back to `2` when it is back. CUNO (telnet) connections have a watchdog; a
  silent link is reconnected the same way.
- The RF protocol parsing lives in the [cul](https://github.com/hobbyquaker/cul) library (1.x) —
  its README lists the supported devices and the parsed fields per protocol. Open parser issues
  there, with the raw line from `-v debug` or `cul/raw`. Messages it has no parser for are logged at
  `debug` only.
- serialport ships prebuilt binaries, so `npm install -g cul2mqtt` needs no compiler on the
  Raspberry Pi.
- Under systemd the log goes to the journal without timestamps and with proper priorities
  (`journalctl -u cul2mqtt@<name> -p warning`).

## License

[Licensed under GPLv2](LICENSE)

Copyright (c) 2015–2026 Sebastian Raff <hobbyquaker@gmail.com>

[gpl-badge]: https://img.shields.io/badge/License-GPL-blue.svg?style=flat
[gpl-url]: LICENSE
