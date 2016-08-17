
0.2.0 / 2016-08-17
==================

  * Reimplemented based on `loopback-connector-nosql`.

0.1.5 / 2016-06-28
==================

  * Updated modules.
  * Lock the ID before really create, and conflict if there's a lock already.

0.1.4 / 2016-05-30
==================

  * Coding style changes: use `Promise.bind()`, change `model` to `modelName`.
  * Fixed tests for `find()` with no arguments.

0.1.3 / 2016-05-12
==================

  * Add support to findAll without where filte.12 support.

0.1.2 / 2016-04-21
==================

  * Dropped Node 0.12 support.

0.1.1 / 2016-04-20
==================

  * Don't change the original settings.
  * add sentinel support - added a `sentinelMasterName` setting to map to `name` - needs a `sentinels` array setting

0.1.0 / 2016-04-19
==================

* First release.
