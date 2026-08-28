/**
 * Finding the CUL on the network and on the USB bus (core B-2).
 *
 * A CUL is a USB stick, so there is nothing to scan for — udev already named it. busware's
 * sticks (CUL433, CUL868, CUN, COC, SCC) show up in `/dev/serial/by-id` as
 * `usb-busware.de_CUL868-if00`, and that name is what the adapter wants to be configured with:
 * it survives a replug and a reboot, while the `/dev/ttyACM0` it points at can swap places with
 * another stick's.
 *
 * Sticks from other vendors that speak culfw (nanoCUL and the like) do not carry busware in
 * their name — `--serialport` is there for those.
 */

/** Words every busware serial name has; both must be present, case does not matter. */
export const SERIAL_WORDS = ['busware', 'CUL'];

/** The hint `--discover` and `--serialport auto` scan with. */
export function discoveryHint() {
    return {
        serial: {contains: SERIAL_WORDS},
    };
}
