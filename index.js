#!/usr/bin/env node

const Mqtt = require('mqtt');
const Cul = require('cul');
const log = require('yalm');
const pkg = require('./package.json');
const config = require('./config.js');

const topicMap = require(config.mapFile);

function map(topic) {
    return topicMap[topic] || topic;
}

let mqttConnected;
let culConnected;

log.setLevel(config.verbosity);

log.info(pkg.name, pkg.version, 'starting');

log.info('mqtt trying to connect', config.url);
const mqtt = Mqtt.connect(config.url, {will: {topic: config.name + '/connected', payload: '0', retain: true}});

const cul = new Cul({
    serialport: config.serialport,
    mode: config.culMode
});

mqtt.publish(config.name + '/connected', culConnected ? '2' : '1', {retain: true});

mqtt.on('connect', () => {
    mqttConnected = true;
    log.info('mqtt connected ' + config.url);
    mqtt.subscribe(config.prefix + '/set/#');
});

mqtt.on('close', () => {
    if (mqttConnected) {
        mqttConnected = false;
        log.info('mqtt closed ' + config.url);
    }
});

mqtt.on('error', () => {
    log.error('mqtt error ' + config.url);
});

cul.on('ready', () => {
    log.info('cul ready');
    culConnected = true;
    mqtt.publish(config.name + '/connected', '2', {retain: true});
});

cul.on('data', (raw, obj) => {
    log.debug('<', raw, obj);

    const prefix = config.name + '/status/';
    let topic;
    const payload = {
        ts: new Date().getTime(),
        cul: {}
    };

    if (obj && obj.protocol && obj.data) {
        switch (obj.protocol) {
            case 'EM':
                topic = prefix + map(obj.protocol + '/' + obj.address);
                payload.val = obj.data.current;
                payload.cul.em = obj.data;
                if (obj.rssi) {
                    payload.cul.rssi = obj.rssi;
                }
                if (obj.device) {
                    payload.cul.device = obj.device;
                }
                log.debug('>', topic, payload);
                mqtt.publish(topic, JSON.stringify(payload), {retain: true});
                break;

            case 'HMS':
            case 'WS':
                Object.keys(obj.data).forEach(el => {
                    topic = prefix + map(obj.protocol + '/' + obj.address + '/' + el);
                    payload.val = obj.data[el];
                    if (obj.rssi) {
                        payload.cul.rssi = obj.rssi;
                    }
                    if (obj.device) {
                        payload.cul.device = obj.device;
                    }
                    log.debug('>', topic, payload);
                    mqtt.publish(topic, JSON.stringify(payload), {retain: true});
                });
                break;

            case 'FS20':
                topic = prefix + map('FS20/' + obj.address);
                payload.val = obj.data.cmdRaw;
                payload.cul.fs20 = obj.data;
                if (obj.rssi) {
                    payload.cul.rssi = obj.rssi;
                }
                if (obj.device) {
                    payload.cul.device = obj.device;
                }
                log.debug('>', topic, payload.val, payload.cul.fs20.cmd);
                mqtt.publish(topic, JSON.stringify(payload), {retain: false});
                break;

            default:
                log.warn('unknown protocol', obj.protocol);
        }
    }

    cul.on('close', () => {
        culConnected = false;
        mqtt.publish(config.name + '/connected', '1', {retain: true});
    });
});
