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

    test('learning only widens: fast clean devices keep the protocol default', () => {
        const tracker = new OfflineTracker();
        for (const t of [0, 150, 300, 450, 600]) {
            tracker.seen('ws/1', t);
        }
        // median 150 x 3 = 450 and max gap 150 x 1.5 = 225 are both tighter than the default
        assert.equal(tracker.timeoutFor('ws/1'), SEEDS.ws);
    });

    test('learning widens for slow devices (median x 3) and lossy ones (max gap x 1.5)', () => {
        const tracker = new OfflineTracker();
        for (const t of [0, 900, 1800, 2700, 3600]) {
            tracker.seen('em/0309', t);
        }
        assert.equal(tracker.timeoutFor('em/0309'), 2700);
        const lossy = new OfflineTracker();
        for (const t of [0, 150, 300, 1800, 1950, 2100]) {
            lossy.seen('ws/2', t);
        }
        // one observed 1500s outage: 1500 x 1.5 = 2250 beats median 150 x 3 and the 1800s default
        assert.equal(lossy.timeoutFor('ws/2'), 2250);
    });

    test('default until enough gaps, RF repeats within 5s are not gaps, learn: false disables', () => {
        const tracker = new OfflineTracker();
        tracker.seen('ws/3', 0);
        tracker.seen('ws/3', 2);
        tracker.seen('ws/3', 900);
        tracker.seen('ws/3', 1800);
        // the 2s repeat is not a gap, so only 2 gaps were seen: still the default
        assert.equal(tracker.timeoutFor('ws/3'), SEEDS.ws);
        const off = new OfflineTracker({learn: false});
        for (const t of [0, 900, 1800, 2700, 3600]) {
            off.seen('em/0309', t);
        }
        assert.equal(off.timeoutFor('em/0309'), SEEDS.em);
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
        for (const t of [0, 900, 1800, 2700, 3600]) {
            tracker.seen('em/0309', t);
        }
        const restored = new OfflineTracker();
        restored.load(JSON.parse(JSON.stringify(tracker.state())));
        assert.equal(restored.timeoutFor('em/0309'), 2700);
        assert.deepEqual(restored.check(3600 + 2701), ['em/0309']);
        assert.deepEqual(restored.check(3600 + 2702), []);
    });
});
