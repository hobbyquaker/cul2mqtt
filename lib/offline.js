/**
 * Device offline detection: a device that stays silent longer than its timeout is marked offline
 * (retained `<protocol>/<address>/online` item, used as per-device availability in HA discovery).
 *
 * Timeout precedence per device:
 *   1. explicit `timeout` (seconds) from a map file object value — 0 disables detection
 *   2. self-learned from the observed message gaps — only ever *wider* than the protocol default
 *      (SlowRF loses several transmissions in a row routinely, so observed gaps say how lossy or
 *      slow a device really is, not how fresh we can expect it: max(default, median × 3,
 *      largest recent gap × 1.5))
 *   3. per-protocol default, deliberately lenient (many missed transmit cycles)
 * Event-only protocols (FS20, ...) have no default and are only monitored with an explicit
 * timeout.
 */

/** protocol → default timeout in seconds; lenient, a missed cycle is normal on SlowRF */
export const SEEDS = {
    em: 1800, // EM1000 sends every 5 min
    ws: 1800, // S300TH / KS300 every ~3 min, irregular and easily lost at range
    hms: 1800,
    fht: 3600, // ~2 min actuator cycle, but notoriously lossy and retry-prone
};

const MIN_GAP = 5; // s — shorter gaps are RF repeats of one transmission, not a cycle
const MIN_GAPS = 3; // gaps needed before the learned timeout widens the default
const MAX_GAPS = 20;

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Explicit per-device timeouts from map file object values: `{"EM/0206": {"name": "dryer",
 * "timeout": 900}}` → `{"em/0206": 900}`. Only device-level keys (`<protocol>/<address>`) apply.
 */
export function timeoutsFromMap(map) {
    const timeouts = {};
    for (const [key, value] of Object.entries(map || {})) {
        if (value && typeof value === 'object' && typeof value.timeout === 'number') {
            timeouts[key.toLowerCase().replace(/^\/+|\/+$/g, '')] = value.timeout;
        }
    }
    return timeouts;
}

/**
 * Tracks when each device was last heard. Devices are keyed by the unmapped item base
 * (`<protocol>/<address>`, protocol lower case). Time is in seconds (pass `Date.now() / 1000`).
 */
export class OfflineTracker {
    /**
     * @param {object} [options]
     * @param {Object<string, number>} [options.timeouts] explicit seconds per device (from
     *        timeoutsFromMap), 0 disables the device
     * @param {boolean} [options.learn] widen timeouts from observed gaps (default true)
     */
    constructor({timeouts = {}, learn = true} = {}) {
        this.timeouts = timeouts;
        this.learn = learn;
        this.devices = new Map();
    }

    /** The active timeout in seconds, or undefined when the device is not monitored. */
    timeoutFor(device) {
        const key = device.toLowerCase();
        if (key in this.timeouts) {
            return this.timeouts[key] > 0 ? this.timeouts[key] : undefined;
        }
        const seed = SEEDS[key.split('/')[0]];
        const d = this.devices.get(device);
        if (seed !== undefined && this.learn && d && d.gaps.length >= MIN_GAPS) {
            return Math.max(seed, median(d.gaps) * 3, Math.max(...d.gaps) * 1.5);
        }
        return seed;
    }

    /**
     * Record a message from a device.
     * @returns {{changed: boolean} | null} whether the device just came (back) online;
     *          null when the device is not monitored
     */
    seen(device, now) {
        let d = this.devices.get(device);
        if (!d) {
            d = {gaps: []};
            this.devices.set(device, d);
        }
        if (d.lastSeen !== undefined) {
            const gap = now - d.lastSeen;
            if (gap >= MIN_GAP) {
                d.gaps.push(Math.round(gap));
                if (d.gaps.length > MAX_GAPS) {
                    d.gaps.shift();
                }
            }
        }
        d.lastSeen = now;
        if (this.timeoutFor(device) === undefined) {
            return null;
        }
        const changed = d.online !== true;
        d.online = true;
        return {changed};
    }

    /** Devices whose timeout just expired (each reported once until seen again). */
    check(now) {
        const offline = [];
        for (const [device, d] of this.devices) {
            if (d.online === false || d.lastSeen === undefined) {
                continue;
            }
            const timeout = this.timeoutFor(device);
            if (timeout !== undefined && now - d.lastSeen > timeout) {
                d.online = false;
                offline.push(device);
            }
        }
        return offline;
    }

    /** Serializable state (learned gaps, last seen) for the state dir. */
    state() {
        const devices = {};
        for (const [device, d] of this.devices) {
            devices[device] = {lastSeen: d.lastSeen, gaps: d.gaps, online: d.online};
        }
        return {devices};
    }

    load(state) {
        for (const [device, d] of Object.entries((state && state.devices) || {})) {
            this.devices.set(device, {
                lastSeen: typeof d.lastSeen === 'number' ? d.lastSeen : undefined,
                gaps: Array.isArray(d.gaps) ? d.gaps.slice(-MAX_GAPS) : [],
                online: typeof d.online === 'boolean' ? d.online : undefined,
            });
        }
    }
}
