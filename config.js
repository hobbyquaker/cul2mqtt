const path = require('path');
module.exports = require('yargs')
    .usage('Usage: $0 [options]')
    .describe('v', 'possible values: "error", "warn", "info", "debug"')
    .describe('n', 'topic prefix')
    .describe('u', 'mqtt broker url. See https://github.com/mqttjs/MQTT.js#connect-using-a-url')
    .describe('h', 'show help')
    .describe('m', 'file containing name mappings')
    .describe('s', 'CUL serial port')
    .describe('c', 'CUL mode')
    .alias({
        h: 'help',
        n: 'name',
        u: 'url',
        v: 'verbosity',
        s: 'serialport',
        m: 'map-file',
        c: 'cul-mode'
    })
    .default({
        u: 'mqtt://127.0.0.1',
        n: 'cul',
        v: 'info',
        s: '/dev/ttyACM0',
        m: path.join(__dirname, 'example-cul2mqtt.json'),
        c: 'SlowRF'
    })
    .version()
    .help('help')
    .argv;
