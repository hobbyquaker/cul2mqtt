import {test, describe} from 'node:test';
import assert from 'node:assert/strict';

import {OfflineTracker, timeoutsFromMap, SEEDS} from '../lib/offline.js';

describe('timeoutsFromMap', () => {
    test('extracts timeouts from object values, normalises keys', () => {
        assert.deepEqual(
            timeoutsFromMap({
                'EM/0206': {name: 'dryer', timeout: 900},
                '/WS/1/': {timeout: 0},
                'FS20/6C4800': 'doorbell',
                'HMS/A5E3': {name: 'aquarium'},
            }),
            {'em/0206': 900, 'ws/1': 0},
        );
        assert.deepEqual(timeoutsFromMap(undefined), {});
    });
});

describe('OfflineTracker', () => {
    test('protocol seeds; event-only protocols are not monitored', () => {
        const tracker = new OfflineTracker();
        assert.equal(tracker.seen('em/0206', 1000).changed, true);
        assert.equal(tracker.timeoutFor('em/0206'), SEEDS.em);
        assert.equal(tracker.seen('fs20/6C4800', 1000), null);
        assert.equal(tracker.timeoutFor('fs20/6C4800'), undefined);
    });

    test('offline after the timeout, reported once, back online on the next message', () => {
        const tracker = new OfflineTracker();
        tracker.seen('em/0206', 1000);
        assert.deepEqual(tracker.check(1000 + SEEDS.em), []);
        assert.deepEqual(tracker.check(1001 + SEEDS.em), ['em/0206']);
        assert.deepEqual(tracker.check(2000 + SEEDS.em), []);
        assert.equal(tracker.seen('em/0206', 3000 + SEEDS.em).changed, true);
        assert.equal(tracker.seen('em/0206', 3300 + SEEDS.em).changed, false);
    });

    test('learns the interval for WS/EM after 3 gaps: median x 3', () => {
        const tracker = new OfflineTracker();
        for (const t of [0, 150, 300, 450, 600]) {
            tracker.seen('ws/1', t);
        }
        assert.equal(tracker.timeoutFor('ws/1'), 450);
        // a single outlier gap does not poison the median
        tracker.seen('ws/1', 600 + 7200);
        assert.equal(tracker.timeoutFor('ws/1'), 450);
    });

    test('learned timeouts are floored, RF repeats within 5s are not gaps', () => {
        const tracker = new OfflineTracker();
        for (const t of [0, 2, 30, 32, 60, 90]) {
            tracker.seen('ws/2', t);
        }
        // gaps of 2s ignored; 28..30s gaps learn 120s (floor), not ~90s
        assert.equal(tracker.timeoutFor('ws/2'), 120);
    });

    test('seed until enough gaps; no learning for HMS/FHT or with learn: false', () => {
        const tracker = new OfflineTracker();
        tracker.seen('ws/3', 0);
        tracker.seen('ws/3', 150);
        assert.equal(tracker.timeoutFor('ws/3'), SEEDS.ws);
        for (const t of [0, 100, 200, 300, 400]) {
            tracker.seen('hms/A5E3', t);
        }
        assert.equal(tracker.timeoutFor('hms/A5E3'), SEEDS.hms);
        const off = new OfflineTracker({learn: false});
        for (const t of [0, 150, 300, 450, 600]) {
            off.seen('ws/1', t);
        }
        assert.equal(off.timeoutFor('ws/1'), SEEDS.ws);
    });

    test('explicit timeout wins and disables learning, 0 disables the device', () => {
        const tracker = new OfflineTracker({timeouts: {'em/0206': 60, 'ws/1': 0, 'fs20/6c4800': 3600}});
        for (const t of [0, 150, 300, 450, 600]) {
            tracker.seen('em/0206', t);
            tracker.seen('ws/1', t);
        }
        assert.equal(tracker.timeoutFor('em/0206'), 60);
        assert.deepEqual(tracker.check(661), ['em/0206']);
        assert.equal(tracker.timeoutFor('ws/1'), undefined);
        assert.equal(tracker.seen('ws/1', 700), null);
        // event-only device opted in via explicit timeout (case-insensitive)
        assert.equal(tracker.seen('fs20/6C4800', 0).changed, true);
        assert.deepEqual(tracker.check(3601), ['fs20/6C4800']);
    });

    test('state roundtrip keeps learned gaps and flags stale devices offline', () => {
        const tracker = new OfflineTracker();
        for (const t of [0, 150, 300, 450, 600]) {
            tracker.seen('ws/1', t);
        }
        const restored = new OfflineTracker();
        restored.load(JSON.parse(JSON.stringify(tracker.state())));
        assert.equal(restored.timeoutFor('ws/1'), 450);
        assert.deepEqual(restored.check(600 + 451), ['ws/1']);
        assert.deepEqual(restored.check(600 + 452), []);
    });
});
