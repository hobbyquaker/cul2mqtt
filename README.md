# cul2mqtt

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[![NPM version](https://badge.fury.io/js/cul2mqtt.svg)](http://badge.fury.io/js/cul2mqtt)
[![Dependency Status](https://img.shields.io/gemnasium/hobbyquaker/cul2mqtt.svg?maxAge=2592000)](https://gemnasium.com/github.com/hobbyquaker/cul2mqtt)
[![Build Status](https://travis-ci.org/hobbyquaker/cul2mqtt.svg?branch=master)](https://travis-ci.org/hobbyquaker/cul2mqtt)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License][gpl-badge]][gpl-url]

> Connect [CUL](http://shop.busware.de/product_info.php/products_id/29) to MQTT (FS20, HMS, EM, ...)

## Installation

Node.js/npm needed.

`$ npm install -g cul2mqtt`

I suggest to use [pm2](http://pm2.keymetrics.io/) to manage the hm2mqtt process (start on system boot, manage log files, 
...)


## Command Line Options

`$ cul2mqtt --help`

``` 
Usage: cul2mqtt [options]
    
Options:
  -v, --verbosity   possible values: "error", "warn", "info", "debug"
                                                               [default: "info"]
  -n, --name        topic prefix                                [default: "cul"]
  -u, --url         mqtt broker url.               [default: "mqtt://127.0.0.1"]
  -h, --help        Show help                                          [boolean]
  -m, --map-file    file containing name mappings
                                              [default: "example-cul2mqtt.json"]
  -s, --serialport  CUL serial port                    [default: "/dev/ttyACM0"]
  -c, --cul-mode    CUL mode                                 [default: "SlowRF"]
  --version         Show version number                                [boolean]

```


## License

[Licensed under GPLv2](LICENSE)

Copyright (c) 2015, 2016 hobbyquaker <hq@ccu.io>

[gpl-badge]: https://img.shields.io/badge/License-GPL-blue.svg?style=flat
[gpl-url]: LICENSE
