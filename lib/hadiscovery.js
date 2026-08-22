/**
 * Home Assistant discovery from the items seen so far: the CUL is a bridge device, every RF
 * address (`<protocol>/<address>`, or its map-file name) becomes its own device linked to the
 * bridge via `via_device`, with one sensor per scalar field. Devices announce themselves by
 * sending; device classes are derived from the field name. The scaffold (topics, availability,
 * origin) comes from mqtt-interfaces-core.
 */

import {discoveryId, entity} from 'mqtt-interfaces-core';

/** field name → HA sensor attributes */
const FIELDS = {
    temperature: {dev_cla: 'temperature', unit_of_meas: '°C', stat_cla: 'measurement'},
    desired_temperature: {dev_cla: 'temperature', unit_of_meas: '°C'},
    measured_temperature: {dev_cla: 'temperature', unit_of_meas: '°C', stat_cla: 'measurement'},
    heater_temperature: {dev_cla: 'temperature', unit_of_meas: '°C', stat_cla: 'measurement'},
    comfort_temperature: {dev_cla: 'temperature', unit_of_meas: '°C', ent_cat: 'config'},
    eco_temperature: {dev_cla: 'temperature', unit_of_meas: '°C', ent_cat: 'config'},
    day_temp: {dev_cla: 'temperature', unit_of_meas: '°C', ent_cat: 'config'},
    night_temp: {dev_cla: 'temperature', unit_of_meas: '°C', ent_cat: 'config'},
    desired_temp: {dev_cla: 'temperature', unit_of_meas: '°C'},
    measured_low: {dev_cla: 'temperature', unit_of_meas: '°C', stat_cla: 'measurement'},
    humidity: {dev_cla: 'humidity', unit_of_meas: '%', stat_cla: 'measurement'},
    valve_position: {unit_of_meas: '%', ic: 'mdi:valve'},
    actuator: {unit_of_meas: '%', ic: 'mdi:valve'},
    rssi: {dev_cla: 'signal_strength', unit_of_meas: 'dBm', ent_cat: 'diagnostic', stat_cla: 'measurement'},
    battery: {ic: 'mdi:battery', ent_cat: 'diagnostic'},
    battery_state: {ic: 'mdi:battery', ent_cat: 'diagnostic'},
    battery_low: {dev_cla: 'battery', ent_cat: 'diagnostic'},
    current: {ic: 'mdi:flash', stat_cla: 'measurement'},
    peak: {ic: 'mdi:flash'},
    total: {ic: 'mdi:counter', stat_cla: 'total_increasing'},
    voltage: {dev_cla: 'voltage', unit_of_meas: 'V', stat_cla: 'measurement'},
    power: {dev_cla: 'power', unit_of_meas: 'W', stat_cla: 'measurement'},
    energy: {dev_cla: 'energy', unit_of_meas: 'kWh', stat_cla: 'total_increasing'},
    frequency: {dev_cla: 'frequency', unit_of_meas: 'Hz', stat_cla: 'measurement'},
    power_factor: {dev_cla: 'power_factor', stat_cla: 'measurement'},
    open: {dev_cla: 'opening'},
    mode_str: {ic: 'mdi:thermostat'},
};

/** protocol → HA device manufacturer / model */
const MODELS = {
    fs20: {mf: 'ELV', mdl: 'FS20'},
    em: {mf: 'ELV', mdl: 'EM1000'},
    ws: {mf: 'ELV', mdl: 'S300TH / KS300'},
    hms: {mf: 'ELV', mdl: 'HMS'},
    fht: {mf: 'ELV', mdl: 'FHT80b'},
    moritz: {mf: 'eQ-3', mdl: 'MAX!'},
    asksin: {mf: 'eQ-3', mdl: 'HomeMatic'},
};

export function uidFor(item) {
    return item.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/**
 * Split a published item into its device part and field: `living_room/temperature` →
 * `living_room` + `temperature`; a single-segment item (fully mapped, or an FS20 event) is both.
 */
export function splitItem(item) {
    const i = item.lastIndexOf('/');
    return i < 0 ? {device: item, field: item} : {device: item.slice(0, i), field: item.slice(i + 1)};
}

/**
 * @param {object} input
 * @param {string} input.name instance name / topic prefix
 * @param {Map<string, {val: *, retain: boolean, raw?: string, device?: string}>} input.items items
 *        seen so far (published name → last value, `raw` = unmapped `<protocol>/<address>/<field>`)
 * @param {boolean} input.jsonPayloads
 * @returns {Array<{id: string, device: object, components: object, availabilityMin?: number}>}
 */
export function discoveryModel({name, items, jsonPayloads = true}) {
    const bridgeId = discoveryId('cul2mqtt', name);
    const devices = new Map();
    for (const [item, {val, raw, device: label}] of items) {
        if (!['string', 'number', 'boolean'].includes(typeof val)) {
            continue;
        }
        const {device, field} = splitItem(item);
        const protocol = String((raw || item).split('/')[0]).toLowerCase();
        if (!devices.has(device)) {
            devices.set(device, {
                id: `${bridgeId}_${uidFor(device)}`,
                device: {
                    name: device,
                    via_device: bridgeId,
                    ...(MODELS[protocol] || {mdl: protocol.toUpperCase()}),
                    // the cul parser names the device type for some protocols (S300TH, KS300, ...)
                    ...(label && {mdl: String(label)}),
                },
                components: {},
            });
        }
        const {ent_cat: category, ic: icon, ...extra} = FIELDS[field] || {};
        const dev = devices.get(device);
        const binary = typeof val === 'boolean';
        dev.components[uidFor(field)] = entity({
            id: dev.id,
            name,
            item,
            uid: uidFor(field),
            platform: binary ? 'binary_sensor' : 'sensor',
            label: field,
            icon,
            category,
            jsonPayloads,
            extra: binary
                ? {
                      ...extra,
                      // booleans (batteryLow, open, ...) as binary sensors
                      val_tpl: jsonPayloads
                          ? "{{ 'ON' if value_json.val else 'OFF' }}"
                          : "{{ 'ON' if value == 'true' else 'OFF' }}",
                  }
                : extra,
        });
    }

    const bridge = {
        id: bridgeId,
        device: {mf: 'Busware', mdl: 'CUL'},
        availabilityMin: 1,
        components: {
            connected: entity({
                id: bridgeId,
                name,
                item: 'connected',
                uid: 'connected',
                platform: 'binary_sensor',
                label: 'Connected',
                category: 'diagnostic',
                extra: {
                    stat_t: `${name}/connected`,
                    val_tpl: "{{ 'ON' if (value | int(0)) >= 2 else 'OFF' }}",
                    dev_cla: 'connectivity',
                },
            }),
        },
    };
    return [bridge, ...devices.values()];
}
