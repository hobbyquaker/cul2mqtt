/**
 * Recognising the stick (core B-2): busware names its sticks so udev writes
 * `usb-busware.de_CUL868-if00` — both words are what makes it ours.
 */

import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {serialMatches} from 'mqtt-interfaces-core';

import {SERIAL_WORDS, discoveryHint} from '../lib/discovery.js';

/** by-id names seen in the wild */
const NAMES = {
    cul868: 'usb-busware.de_CUL868-if00',
    cul433: 'usb-busware.de_CUL433-if00',
    cun: 'usb-busware.de_CUN-if00',
    coc: 'usb-busware.de_COC-if00',
    nanocul: 'usb-1a86_USB2.0-Serial-if00-port0',
    zigbee: 'usb-ITead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_abc-if00-port0',
    ftdi: 'usb-FTDI_FT232R_USB_UART_A50285BI-if00-port0',
};

const matches = (id) => serialMatches({id}, discoveryHint().serial);

describe('the hint', () => {
    test('looks for busware and CUL in the serial name', () => {
        assert.deepEqual(discoveryHint().serial, {contains: SERIAL_WORDS});
        assert.deepEqual(SERIAL_WORDS, ['busware', 'CUL']);
    });

    test('scans nothing on the network — a CUL is a usb stick (a CUNO is --host)', () => {
        const hint = discoveryHint();
        assert.deepEqual(Object.keys(hint), ['serial']);
    });
});

describe('which sticks are recognised', () => {
    test('the CUL868 of the README', () => {
        assert.equal(matches(NAMES.cul868), true);
    });

    test('and the other CUL variants', () => {
        assert.equal(matches(NAMES.cul433), true);
    });

    test('but not the busware sticks that are not CULs', () => {
        // a CUN or COC has its own name; --serialport names them
        assert.equal(matches(NAMES.cun), false);
        assert.equal(matches(NAMES.coc), false);
    });

    test('not a nanoCUL or another vendor’s culfw clone', () => {
        assert.equal(matches(NAMES.nanocul), false);
        assert.equal(matches(NAMES.ftdi), false);
    });

    test('and not the zigbee stick in the next usb port', () => {
        assert.equal(matches(NAMES.zigbee), false);
    });

    test('case does not matter', () => {
        assert.equal(matches('USB-BUSWARE.DE_cul868-IF00'), true);
    });
});
