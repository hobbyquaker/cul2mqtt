import {parseConfig} from 'mqtt-interfaces-core';
import pkg from './package.json' with {type: 'json'};

export const OPTIONS = {
    serialport: {
        alias: 's',
        type: 'string',
        describe: 'serial port of the CUL / COC / SCC',
        default: '/dev/ttyACM0',
    },
    baudrate: {
        type: 'number',
        describe: 'serial baud rate (default 9600, 38400 with --coc/--scc)',
    },
    'cul-mode': {
        alias: 'c',
        type: 'string',
        describe: 'RF mode: SlowRF (FS20, HMS, EM, S300TH, FHT, ...), MORITZ (MAX!) or AskSin (HomeMatic)',
        choices: ['SlowRF', 'MORITZ', 'AskSin'],
        default: 'SlowRF',
    },
    coc: {type: 'boolean', describe: 'device is a Busware COC (Raspberry Pi)', default: false},
    scc: {type: 'boolean', describe: 'device is a Busware SCC (Raspberry Pi)', default: false},
    host: {type: 'string', describe: 'CUNO / CUNO2 hostname or ip (telnet instead of serial port)'},
    port: {type: 'number', describe: 'CUNO telnet port', default: 2323},
    'map-file': {
        alias: 'm',
        type: 'string',
        describe: 'JSON file mapping <protocol>/<address>[/<field>] to friendly item names (see example-map.json)',
    },
    'fht-central': {
        type: 'string',
        describe: 'FHT central code (4 hex digits) needed to send set/fht commands',
    },
    'publish-raw': {
        type: 'boolean',
        describe: 'additionally publish every raw culfw line on <name>/raw (not retained)',
        default: false,
    },
    'raw-set': {
        type: 'boolean',
        describe: 'accept raw culfw commands on <name>/set/raw (unrestricted RF transmitter!)',
        default: false,
    },
};

export default parseConfig({
    pkg,
    options: OPTIONS,
    defaults: {name: 'cul'},
    examples: [
        ['$0 -s /dev/ttyACM0 -u mqtt://broker', 'run in the foreground'],
        ['$0 --host cuno.lan -u mqtt://broker', 'CUNO via telnet'],
        ['sudo $0 --install -n cul -s /dev/ttyACM0 -u mqtt://broker', 'install as service cul2mqtt@cul'],
    ],
});
