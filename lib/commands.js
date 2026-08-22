/**
 * Translates `set/<parts...>` requests into cul commands.
 *
 * commandFor(parts, value, options) returns one of
 *   {type: 'fs20', housecode, address, cmd, time}   cul.cmd('FS20', ...)
 *   {type: 'fht', device, cmd, value}               cul.cmd('FHT', central, ...)
 *   {type: 'raw', data}                             cul.write(data)  (only with --raw-set)
 * or throws an Error for unknown items / invalid values.
 */

import {toBoolean} from 'mqtt-interfaces-core';

/** FS20 dim steps in percent (dim06% ... dim100%). */
export const DIM_STEPS = [6, 12, 18, 25, 31, 37, 43, 50, 56, 62, 68, 75, 81, 87, 93, 100];

export const FS20_COMMANDS = [
    'off',
    ...DIM_STEPS.map((p) => `dim${String(p).padStart(2, '0')}%`),
    'on',
    'toggle',
    'dimup',
    'dimdown',
    'dimupdown',
    'sendstate',
    'off-for-timer',
    'on-for-timer',
    'on-old-for-timer',
    'reset',
    'ramp-on-time',
    'ramp-off-time',
    'on-old-for-timer-prev',
    'on-100-for-timer-prev',
];

/** Percent → nearest FS20 dim command (0 → off, 100 → dim100%). */
export function dimCommand(percent) {
    const p = Math.max(0, Math.min(100, Number(percent)));
    if (p === 0) {
        return 'off';
    }
    const step = DIM_STEPS.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
    return `dim${String(step).padStart(2, '0')}%`;
}

function fs20Command(value) {
    let cmd = value;
    let time;
    if (value && typeof value === 'object') {
        cmd = value.cmd;
        time = value.time;
    }
    if (typeof cmd === 'boolean') {
        cmd = cmd ? 'on' : 'off';
    } else if (typeof cmd === 'number') {
        cmd = dimCommand(cmd);
    } else {
        cmd = String(cmd).trim().toLowerCase();
        const bool = toBoolean(cmd);
        if (/^\d+$/.test(cmd)) {
            cmd = dimCommand(Number(cmd));
        } else if (bool !== undefined && !FS20_COMMANDS.includes(cmd)) {
            cmd = bool ? 'on' : 'off';
        }
    }
    if (!FS20_COMMANDS.includes(cmd) && !/^[0-9a-f]{2}$/.test(cmd)) {
        throw new Error(`set/fs20: unknown command "${value && value.cmd !== undefined ? value.cmd : value}"`);
    }
    return {cmd, time: time === undefined ? undefined : Number(time)};
}

function fs20Address(parts) {
    // set/fs20/<housecode><address> (6 hex) or set/fs20/<housecode>/<address> (4 + 2 hex or ELV notation)
    const joined = parts.join('').replace(/\s+/g, '');
    if (parts.length === 1 && /^[0-9a-fA-F]{6}$/.test(joined)) {
        return {housecode: joined.slice(0, 4), address: joined.slice(4, 6)};
    }
    if (parts.length === 2 && parts[0].replace(/\s+/g, '') && parts[1].replace(/\s+/g, '')) {
        return {housecode: parts[0], address: parts[1]};
    }
    throw new Error(`set/fs20: address "${parts.join('/')}" must be <housecode><address> (6 hex digits)`);
}

/**
 * @param {string[]} parts topic parts after `set/`
 * @param {*} value parsed payload
 * @param {{rawSet?: boolean}} [options]
 */
export function commandFor(parts, value, {rawSet = false} = {}) {
    const [protocol, ...rest] = parts.map((p) => String(p));
    switch (protocol.toLowerCase()) {
        case 'fs20': {
            if (rest.length < 1) {
                throw new Error('set/fs20: address missing');
            }
            const {housecode, address} = fs20Address(rest);
            const {cmd, time} = fs20Command(value);
            return {type: 'fs20', housecode, address, cmd, time};
        }
        case 'fht': {
            // set/fht/<device>/<cmd> value   or   set/fht/<device> {"cmd": ..., "value": ...}
            if (rest.length < 1) {
                throw new Error('set/fht: device missing');
            }
            const device = rest[0];
            let cmd = rest[1];
            let val = value;
            if (value && typeof value === 'object') {
                cmd = value.cmd || cmd;
                val = value.value;
            }
            if (!cmd) {
                throw new Error('set/fht: command missing (set/fht/<device>/<cmd>)');
            }
            return {type: 'fht', device, cmd: String(cmd), value: val === undefined ? undefined : String(val)};
        }
        case 'raw':
            if (!rawSet) {
                throw new Error('set/raw is disabled (see --raw-set)');
            }
            if (value === undefined || value === null || typeof value === 'object') {
                throw new Error('set/raw: payload must be a culfw command string');
            }
            return {type: 'raw', data: String(value).trim()};
        default:
            throw new Error(`unknown set item "${parts.join('/')}" (fs20, fht, raw)`);
    }
}
