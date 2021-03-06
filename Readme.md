[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Dependency Status][deps-image]][deps-url]
[![Dev Dependency Status][deps-dev-image]][deps-dev-url]

# altpro

Elevation profile widget. See demo [here][demo].

## Install

```sh
$ npm install --save altpro
```

## Usage

```js

const data = [
  { elevation: 10, distance: 0 },
  { elevation: 15, distance: 10 },
  { elevation: 25, distance: 10 },
  // etc.
];

const altpro = require('altpro');

const container = document.querySelector('.altitude-profile-container');
altpro(container, data);

```

## API

### `altpro(parent, data, options)`

Creates new widget inside of `parent`. `parent` element has to exist, be visible and have desired size.

- `data` is an `Array` of items with `elevation` and `distance` properties. All other properties are
ignored, and `data` is not changed by `altpro`. `distance` means - distance from previous items.

The following `options` can be passed: 

- `fill` - [fillStyle] for main graph background
- `stroke` - [strokeStyle] for line at the top of the graph
- `selectedFill` - [fillStyle] for the selected item

### `altpro.select(index)`

Selects `index` element of data.

### `altpro.destroy()`

Removes altpro widget from DOM, unbinds all listeners.

## License

MIT © [Damian Krzeminski](https://pirxpilot.me)

[fillStyle]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle
[strokeStyle]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/strokeStyle

[demo]: https://pirxpilot.github.io/altpro

[npm-image]: https://img.shields.io/npm/v/altpro.svg
[npm-url]: https://npmjs.org/package/altpro

[travis-url]: https://travis-ci.com/pirxpilot/altpro
[travis-image]: https://img.shields.io/travis/com/pirxpilot/altpro.svg

[deps-image]: https://img.shields.io/david/pirxpilot/altpro.svg
[deps-url]: https://david-dm.org/pirxpilot/altpro

[deps-dev-image]: https://img.shields.io/david/dev/pirxpilot/altpro.svg
[deps-dev-url]: https://david-dm.org/pirxpilot/altpro?type=dev
