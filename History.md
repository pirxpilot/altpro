
2.0.1 / 2025-12-02
==================

 * upgrade `esbuild` to 0.27.0
 * update github actions
 * upgrade `jsdom` to ~27
 * upgrade `biome`

2.0.0 / 2025-04-24
==================

 * fix minor bug in example
 * use simpler test harness
 * transition to ESM module
 * use built-in `node:assert` instead of `should`
 * use biome for linting and formating
 * update dev dependencies

1.0.3 / 2024-01-31
==================

 * replace mocha with node:test
 * replace browserify with esbuild
 * replace jshint with @pirxpilot/jshint

1.0.2 / 2021-10-19
==================

 * convert elevation sent with altpro-select event to the configured units

1.0.1 / 2019-02-28
==================

 * support clearing current selection
 * send event altpro-select when selection is cleared on mouseleave
 * fix mouseleave handler (clear selected elevation)

1.0.0 / 2019-02-09
==================

 * improve graph for hi/res devices

0.2.1 / 2019-02-07
==================

 * ignore entries with no elevation

0.2.0 / 2019-02-04
==================

 * add method to change units on displayed profile
 * start Y axis at minimum elevation in a data set
 * externalize elevation label

0.1.1 / 2019-01-31
==================

 * use binary search to find segment to select
 * move canvas painting to requestAnimationFrame

0.1.0 / 2019-01-30
==================

 * add support for `altpro-select` event
 * add support for elevation label

0.0.1 / 2019-01-30
==================

 * initial implementation
