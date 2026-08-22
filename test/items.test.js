import {test, describe} from 'node:test';
import assert from 'node:assert/strict';

import {itemsFor, mapItem, snakeCase} from '../lib/items.js';

describe('itemsFor', () => {
    test('FS20 command is a non-retained event, rssi retained', () => {
        const items = itemsFor({
            protocol: 'FS20',
            address: '6C4800',
            device: 'FS20',
            rssi: -87.5,
            data: {addressCode: '6C48', addressDevice: '00', cmdRaw: '11', cmd: 'on', time: null},
        });
        assert.deepEqual(items, [
            {item: 'fs20/6C4800', val: 'on', retain: false},
            {item: 'fs20/6C4800/rssi', val: -87.5, retain: true},
        ]);
    });

    test('EM: one item per value, meta fields skipped', () => {
        const items = itemsFor({
            protocol: 'EM',
            address: '0205',
            device: 'EM1000-EM',
            rssi: -84,
            data: {seq: 99, total: 31235, current: 1, peak: 2},
        });
        assert.deepEqual(
            items.map((i) => i.item),
            ['em/0205/total', 'em/0205/current', 'em/0205/peak', 'em/0205/rssi'],
        );
        assert.ok(items.every((i) => i.retain));
    });

    test('WS/HMS values, numeric address', () => {
        const items = itemsFor({
            protocol: 'WS',
            address: 1,
            device: 'S300TH',
            data: {temperature: 24.5, humidity: 58.5},
        });
        assert.deepEqual(items, [
            {item: 'ws/1/temperature', val: 24.5, retain: true},
            {item: 'ws/1/humidity', val: 58.5, retain: true},
        ]);
    });

    test('MORITZ: camelCase → snake_case, objects skipped', () => {
        const items = itemsFor({
            protocol: 'MORITZ',
            address: '113ad3',
            device: 'WallMountedThermostat',
            rssi: -59.5,
            data: {
                len: 12,
                msgcnt: 0,
                msgFlag: '04',
                msgTypeRaw: '42',
                msgType: 'WallThermostatControl',
                src: '113ad3',
                dst: '0c4f0d',
                groupid: 0,
                payload: '1CB41D',
                desiredTemperature: 14,
                measuredTemperature: 18,
                linkPartner: {a: 1},
            },
        });
        assert.deepEqual(
            items.map((i) => i.item),
            [
                'moritz/113ad3/msg_type',
                'moritz/113ad3/groupid',
                'moritz/113ad3/desired_temperature',
                'moritz/113ad3/measured_temperature',
                'moritz/113ad3/rssi',
            ],
        );
    });

    test('FHT: cmd becomes the item, value numeric where possible', () => {
        assert.deepEqual(
            itemsFor({
                protocol: 'FHT',
                address: '4d3f',
                data: {cmdRaw: '41', cmd: 'desired-temp', valueRaw: '2a', value: '21'},
            }),
            [{item: 'fht/4d3f/desired_temp', val: 21, retain: true}],
        );
        assert.deepEqual(
            itemsFor({
                protocol: 'FHT',
                address: '4d3f',
                data: {cmdRaw: '28', cmd: 'sat-from1', valueRaw: '24', value: '6:00'},
            }),
            [{item: 'fht/4d3f/sat_from1', val: '6:00', retain: true}],
        );
        assert.deepEqual(itemsFor({protocol: 'FHT', address: '4d3f', data: {cmdRaw: 'ff', cmd: 'UNKNOWN'}}), []);
    });

    test('messages without address (culfw replies) and parse errors yield nothing', () => {
        assert.deepEqual(itemsFor({protocol: 'culfw', data: {version: '1.66', hardware: 'CSM868'}}), []);
        assert.deepEqual(itemsFor({protocol: 'TCM97001', address: '159', data: {error: 'no matching decoder'}}), []);
        assert.deepEqual(itemsFor(undefined), []);
        assert.deepEqual(itemsFor({}), []);
    });

    test('cul 1.0 normalised fields: booleans kept, meta fields skipped', () => {
        const items = itemsFor({
            protocol: 'FHTTK',
            address: '123456',
            device: 'FHT80TF',
            rssi: -54,
            data: {stateRaw: '02', repetition: false, state: 'Window Closed', batteryLow: false, open: false},
        });
        assert.deepEqual(items, [
            {item: 'fhttk/123456/state', val: 'Window Closed', retain: true},
            {item: 'fhttk/123456/battery_low', val: false, retain: true},
            {item: 'fhttk/123456/open', val: false, retain: true},
            {item: 'fhttk/123456/rssi', val: -54, retain: true},
        ]);
        const moritz = itemsFor({
            protocol: 'MORITZ',
            address: '0a1b2c',
            data: {
                len: 11,
                msgcnt: 1,
                msgFlag: '06',
                msgTypeRaw: '30',
                msgType: 'ShutterContactState',
                src: '0a1b2c',
                dst: '000000',
                payload: '12',
                unknownBits: 0,
                open: true,
                batteryLow: false,
                batteryState: 'ok',
                until: {day: 1},
            },
        });
        assert.deepEqual(
            moritz.map((i) => i.item),
            [
                'moritz/0a1b2c/msg_type',
                'moritz/0a1b2c/open',
                'moritz/0a1b2c/battery_low',
                'moritz/0a1b2c/battery_state',
            ],
        );
    });
});

describe('mapItem', () => {
    const map = {'EM/0205': 'dishwasher', 'WS/1/temperature': 'living_room_temperature', 'fs20/6C4800': 'doorbell'};
    test('prefix and exact matches, case-insensitive, longest wins', () => {
        assert.equal(mapItem('em/0205/current', map), 'dishwasher/current');
        assert.equal(mapItem('em/0205', map), 'dishwasher');
        assert.equal(mapItem('ws/1/temperature', map), 'living_room_temperature');
        assert.equal(mapItem('ws/1/humidity', map), 'ws/1/humidity');
        assert.equal(mapItem('fs20/6C4800', map), 'doorbell');
        assert.equal(mapItem('em/02051/current', map), 'em/02051/current');
        assert.equal(mapItem('em/0205/current', undefined), 'em/0205/current');
    });
});

describe('snakeCase', () => {
    test('converts camelCase and punctuation', () => {
        assert.equal(snakeCase('desiredTemperature'), 'desired_temperature');
        assert.equal(snakeCase('desired-temp'), 'desired_temp');
        assert.equal(snakeCase('modeStr'), 'mode_str');
        assert.equal(snakeCase('total'), 'total');
    });
});
