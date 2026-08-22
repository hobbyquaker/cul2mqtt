import {test, describe} from 'node:test';
import assert from 'node:assert/strict';

import {commandFor, dimCommand} from '../lib/commands.js';

describe('commandFor fs20', () => {
    test('6 hex digit address, text / boolean / numeric commands', () => {
        assert.deepEqual(commandFor(['fs20', '6C4800'], 'on'), {
            type: 'fs20',
            housecode: '6C48',
            address: '00',
            cmd: 'on',
            time: undefined,
        });
        assert.equal(commandFor(['fs20', '6C4800'], false).cmd, 'off');
        assert.equal(commandFor(['fs20', '6C4800'], 'true').cmd, 'on');
        assert.equal(commandFor(['fs20', '6C4800'], 0).cmd, 'off');
        assert.equal(commandFor(['fs20', '6C4800'], 50).cmd, 'dim50%');
        assert.equal(commandFor(['fs20', '6C4800'], '100').cmd, 'dim100%');
        assert.equal(commandFor(['fs20', '6C4800'], 'TOGGLE').cmd, 'toggle');
        assert.equal(commandFor(['fs20', '6C4800'], '11').cmd, 'dim12%');
    });

    test('housecode/address split and ELV notation pass through', () => {
        const c = commandFor(['fs20', '2341 2131', '1112'], 'on');
        assert.equal(c.housecode, '2341 2131');
        assert.equal(c.address, '1112');
    });

    test('json with time', () => {
        assert.deepEqual(commandFor(['fs20', '6C4800'], {cmd: 'on-for-timer', time: 30}), {
            type: 'fs20',
            housecode: '6C48',
            address: '00',
            cmd: 'on-for-timer',
            time: 30,
        });
    });

    test('rejects garbage', () => {
        assert.throws(() => commandFor(['fs20'], 'on'), /address missing/);
        assert.throws(() => commandFor(['fs20', '6C48'], 'on'), /6 hex digits/);
        assert.throws(() => commandFor(['fs20', '6C4800'], 'explode'), /unknown command/);
    });
});

describe('commandFor fht / raw', () => {
    test('fht topic and json forms', () => {
        assert.deepEqual(commandFor(['fht', '4d3f', 'desired-temp'], 21.5), {
            type: 'fht',
            device: '4d3f',
            cmd: 'desired-temp',
            value: '21.5',
        });
        assert.deepEqual(commandFor(['fht', '4d3f'], {cmd: 'mode', value: 'AUTO'}), {
            type: 'fht',
            device: '4d3f',
            cmd: 'mode',
            value: 'AUTO',
        });
        assert.throws(() => commandFor(['fht', '4d3f'], 21), /command missing/);
    });

    test('raw only with --raw-set', () => {
        assert.throws(() => commandFor(['raw'], 'V'), /disabled/);
        assert.deepEqual(commandFor(['raw'], 'F6C480111', {rawSet: true}), {type: 'raw', data: 'F6C480111'});
        assert.throws(() => commandFor(['raw'], {a: 1}, {rawSet: true}), /command string/);
    });

    test('unknown protocol', () => {
        assert.throws(() => commandFor(['zigbee', '1'], 1), /unknown set item/);
    });
});

describe('dimCommand', () => {
    test('nearest step', () => {
        assert.equal(dimCommand(0), 'off');
        assert.equal(dimCommand(1), 'dim06%');
        assert.equal(dimCommand(33), 'dim31%');
        assert.equal(dimCommand(99), 'dim100%');
        assert.equal(dimCommand(250), 'dim100%');
    });
});
