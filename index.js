#!/usr/bin/env node
var Mqtt =      require('mqtt');
var Cul =       require('cul');
var pkg =       require('./package.json');
var log =       require('yalm');
var config =    require('yargs')
    .usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 [options]')
    .describe('v', 'possible values: "error", "warn", "info", "debug"')
    .describe('n', 'topic prefix')
    .describe('u', 'mqtt broker url. See https://github.com/mqttjs/MQTT.js#connect-using-a-url')
    .describe('h', 'show help')
    .describe('s', 'CUL serial port')
    .alias({
        'h': 'help',
        'n': 'name',
        'u': 'url',
        'v': 'verbosity',
        's': 'serialport'
    })
    .default({
        'u': 'mqtt://127.0.0.1',
        'n': 'cul',
        'v': 'info',
        's': '/dev/ttyACM0'
    })
    //.config('config')
    .version()
    .help('help')
    .argv;

log.setLevel(config.verbosity);

log.info(pkg.name, pkg.version, 'starting');

log.info('mqtt trying to connect', config.url);
var mqtt = Mqtt.connect(config.url, {will: {topic: config.name + '/connected', payload: '0', retain: true}});
mqtt.publish(config.name + '/connected', '1', {retain: true});

var connected;

mqtt.on('connect', function () {
    connected = true;
    log.info('mqtt connected ' + config.url);
    mqtt.subscribe(config.prefix + '/set/#');
});

mqtt.on('close', function () {
    if (connected) {
        connected = false;
        log.info('mqtt closed ' + config.url);
    }
});

mqtt.on('error', function () {
    log.error('mqtt error ' + config.url);
});



var cul = new Cul({
    serialport: config.serialport,
    mode: 'SlowRF'
});

cul.on('ready', function () {

    log.info('cul ready');
    mqtt.publish(config.name + '/connected', '2', {retain: true});

});


// TODO - read topicMap from json file, remove hardcoded personal stuff here.
var topicMap = {
    'EM/0205': 'Leistung Spülmaschine',
    'EM/0206': 'Leistung Trockner',
    'EM/0309': 'Gaszähler',
    'FS20/6C4800': 'Klingel',
    'FS20/B33100': 'RC8:1',
    'FS20/B33101': 'RC8:2',
    'FS20/B33102': 'RC8:3',
    'FS20/B33103': 'RC8:4',
    'FS20/446000': 'Gastherme Brenner',
    'FS20/446001': 'Gastherme Brenner',
    'WS/1/temperature': 'Temperatur Wohnzimmer',
    'WS/1/humidity': 'Luftfeuchte Wohnzimmer',
    'WS/4/temperature': 'Temperatur Garten',
    'WS/4/humidity': 'Luftfeuchte Garten',
    'HMS/A5E3/temperature': 'Temperatur Aquarium'
};

function map(topic) {
    return topicMap[topic] || topic;
}

cul.on('data', function (raw, obj) {
    log.debug('<', raw, obj);

    var prefix = config.name + '/status/';
    var topic;
    var val = {
        ts: new Date().getTime()
    };


    if (obj && obj.protocol && obj.data) {

        switch (obj.protocol) {
            case 'EM':
                topic = prefix + map(obj.protocol + '/' + obj.address);
                val.val = obj.data.current;
                val.cul_em = obj.data;
                if (obj.rssi) val.cul_rssi = obj.rssi;
                if (obj.device) val.cul_device = obj.device;
                log.debug('>', topic, val);
                mqtt.publish(topic, JSON.stringify(val), {retain: true});
                break;

            case 'HMS':
            case 'WS':
                for (var el in obj.data) {
                    topic = prefix + map(obj.protocol + '/' + obj.address + '/' + el);
                    val.val = obj.data[el];
                    if (obj.rssi) val.cul_rssi = obj.rssi;
                    if (obj.device) val.cul_device = obj.device;
                    log.debug('>', topic, val);
                    mqtt.publish(topic, JSON.stringify(val), {retain: true});
                }
                break;

            case 'FS20':
                topic = prefix + map('FS20/' + obj.address);
                val.val = obj.data.cmdRaw;
                val.cul_fs20 = obj.data;
                if (obj.rssi) val.cul_rssi = obj.rssi;
                if (obj.device) val.cul_device = obj.device;
                log.debug('>', topic, val.val, val.cul_fs20.cmd);
                mqtt.publish(topic, JSON.stringify(val), {retain: false});
                break;

            default:
                log.warn('unknown protocol', obj.protocol);
        }
    }
});