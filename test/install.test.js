import {test, describe} from 'node:test';
import assert from 'node:assert/strict';

import {unitFile, envFile} from '../lib/install.js';
import {OPTIONS} from '../config.js';
import {SHARED_OPTIONS} from 'mqtt-interfaces-core';

describe('install', () => {
    test('unit joins dialout and uses the shared layout', () => {
        const unit = unitFile('/usr/bin/node /usr/local/lib/node_modules/cul2mqtt/index.js');
        assert.match(unit, /^SupplementaryGroups=dialout$/m);
        assert.match(unit, /^EnvironmentFile=-\/etc\/mqtt-interfaces\/broker\.env$/m);
        assert.match(unit, /^EnvironmentFile=\/etc\/cul2mqtt\/%i\.env$/m);
        assert.match(unit, /^Environment=CUL2MQTT_NAME=%i$/m);
        assert.match(unit, /^SyslogIdentifier=cul2mqtt@%i$/m);
        assert.match(unit, /^Restart=always$/m);
    });

    test('env file carries the cul options', () => {
        const argv = {name: 'cul', serialport: '/dev/ttyACM0', culMode: 'SlowRF', coc: true, mqttUrl: 'mqtt://b'};
        Object.defineProperty(argv, '$options', {value: {...OPTIONS, ...SHARED_OPTIONS}});
        const out = envFile(argv);
        assert.match(out, /^CUL2MQTT_SERIALPORT=\/dev\/ttyACM0$/m);
        assert.match(out, /^CUL2MQTT_CUL_MODE=SlowRF$/m);
        assert.match(out, /^CUL2MQTT_COC=true$/m);
        assert.doesNotMatch(out, /^CUL2MQTT_NAME=/m);
    });
});
