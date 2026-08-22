/**
 * --install / --uninstall: systemd template service cul2mqtt@<name> (mqtt-interfaces-core
 * installer). The service user joins `dialout` for the serial port.
 */

import {createInstaller} from 'mqtt-interfaces-core';

export const SERVICE = 'cul2mqtt';
export const ENV_PREFIX = 'CUL2MQTT';

const installer = createInstaller({
    service: SERVICE,
    envPrefix: ENV_PREFIX,
    description: `${SERVICE} %i - Busware CUL to MQTT bridge`,
    documentation: 'https://github.com/hobbyquaker/cul2mqtt',
    serviceExtra: ['SupplementaryGroups=dialout'],
});

export const {unitFile, envFile, installService, uninstallService, handle} = installer;
