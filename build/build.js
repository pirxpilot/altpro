require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const findSegment = require('./find-segment');
const matrix2d = require('./matrix2d');

module.exports = altpro;

const raf = window.requestAnimationFrame || (fn => fn() || false);

function prepare(data) {
  return data.reduce((r, { elevation, distance }) => {
    if (elevation < r.minElevation) {
      r.minElevation = elevation;
    }
    if (elevation > r.maxElevation) {
      r.maxElevation = elevation;
    }
    r.totalDistance += distance;
    r.items.push({ elevation, distance: r.totalDistance });
    return r;
  }, {
    items: [],
    totalDistance: 0,
    minElevation: Number.MAX_VALUE,
    maxElevation: 0
  });
}

function initMatrix({ w, h }, { x, y, min }, dpr) {
  const horizontalPadding = 0;
  const verticalPadding = 15;

  w -= 2 * horizontalPadding;
  h -= 2 * verticalPadding;

  const horizontalScaling = w / x;
  const verticalScaling = h / y;

  return matrix2d()
    .scale(dpr, dpr)
    .translate(horizontalPadding, verticalPadding)
    .scale(horizontalScaling, -verticalScaling)
    .translate(0, -(y + min));
}

function drawPath(ctx, items, ref) {
  ctx.beginPath();

  const first = items[0];
  const last = items[items.length - 1];

  ctx.moveTo(0, first.elevation === undefined ? 0 : (first.elevation - ref));

  for(let i = 1; i < items.length; i++) {
    const { elevation, distance } = items[i];
    if (elevation !== undefined) {
      ctx.lineTo(distance, elevation - ref);
    }
  }
  if (last.elevation === undefined) {
    ctx.lineTo(last.distance, 0);
  }

  ctx.stroke();

  ctx.lineTo(last.distance, 0);
  ctx.lineTo(0, 0);

  ctx.closePath();
  ctx.fill();
}

function drawSelected(ctx, { distance: d1, elevation: e1 }, { distance: d2, elevation: e2 }, ref) {
  ctx.beginPath();
  ctx.moveTo(d1, 0);
  if (e1 !== undefined) {
    ctx.lineTo(d1, e1 - ref);
  }
  if (e2 !== undefined) {
    ctx.lineTo(d2, e2 - ref);
  }
  ctx.lineTo(d2, 0);
  ctx.closePath();
  ctx.fill();
}

function clear(ctx, { w, h }, dpr) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.restore();
}

function create(parent, label) {

  function canvas(wrapper, w, h, dpr) {
    const c = document.createElement('canvas');
    c.style.position = 'absolute';
    c.style.left = 0;
    c.style.height = 0;
    c.style.width = '100%';
    c.style.height = '100%';
    c.width = w * dpr;
    c.height = h * dpr;
    wrapper.appendChild(c);
    return c;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'altpro-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  parent.appendChild(wrapper);

  const { clientWidth: w, clientHeight: h } = wrapper;
  const dpr = window.devicePixelRatio || 1;

  const bg = canvas(wrapper, w, h, dpr);
  const fg = canvas(wrapper, w, h, dpr);

  if (!label) {
    label = document.createElement('div');
    label.className = 'altpro-label';
    wrapper.appendChild(label);
  }

  return { bg, fg, label, w, h, dpr };
}

function altpro(parent, data, opts = {}) {
  let {
    fill = 'chartreuse',
    stroke = 'black',
    selectedFill = 'orange',
    unit = 'm'
  } = opts;
  const {
    minElevation,
    maxElevation,
    totalDistance,
    items
  } = prepare(data);

  const ref = minElevation < 0 ? 0 : (minElevation - 0.05 * (maxElevation - minElevation));
  const extent = {
    x: totalDistance,
    y: maxElevation - Math.min(minElevation, ref),
    min: Math.min(minElevation, 0)
  };

  const { bg, fg, label, w, h, dpr } = create(parent, opts.label);

  const ctx = bg.getContext('2d');
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  const transformMatric = initMatrix({ w, h }, extent, dpr);
  const invertedMatrix = transformMatric.clone().invert();
  transformMatric.apply(ctx);
  drawPath(ctx, items, ref);

  const fgCtx = fg.getContext('2d');
  fgCtx.fillStyle = selectedFill;
  fgCtx.lineWidth = 3;
  transformMatric.apply(fgCtx);

  fg.addEventListener('mousemove', onmousemove);
  fg.removeEventListener('mouseleve', onmouseleave);

  let selectedIndex = -1; // nothing selected
  let animationFrame;

  return {
    select,
    option,
    destroy
  };

  function option(key, value) {
    if (value === undefined) {
      return opts[key];
    }
    opts[key] = value;
    if (key === 'unit') {
      unit = opts.unit;
      if (selectedIndex !== -1) {
        displayLabel(items[selectedIndex]);
      }
    }
  }

  function destroy() {
    fg.removeEventListener('mousemove', onmousemove);
    fg.removeEventListener('mouseleve', onmouseleave);
    parent.innerHTML = '';
  }

  function onmousemove({ clientX, clientY, target }) {
    const rect = target.getBoundingClientRect();
    let index = itemIndexFromPoint([
      dpr * (clientX - rect.left),
      dpr * (clientY - rect.top)
    ]);
    select(index);
  }

  function onmouseleave() {
    label.hidden = true;
    clear(fgCtx, { w, h }, dpr);
  }

  function itemIndexFromPoint(point) {
    const [ distance ] = unproject(point);
    return findSegment(items, distance);
  }

  function unproject(point) {
    return invertedMatrix.project(point);
  }

  function select(index) {
    if (index < 1 || index >= items.length) {
      return;
    }
    if (selectedIndex === index) {
      return;
    }
    selectedIndex = index;
    if (!animationFrame) {
      animationFrame = raf(refreshSelected);
    }
  }

  function refreshSelected() {
    animationFrame = undefined;
    clear(fgCtx, { w, h }, dpr);
    drawSelected(fgCtx, items[selectedIndex - 1], items[selectedIndex], ref);
    displayLabel(items[selectedIndex]);
    notify(selectedIndex);
  }

  function displayLabel({ elevation }) {
    if (elevation !== undefined) {
      if (unit === 'ft') {
        elevation *= 3.28084;
      }
      elevation = Math.round(elevation);
    }
    else {
      elevation = '';
    }
    label.innerText = `${elevation}`;
    label.hidden = false;
  }

  function notify(index) {
    const { distance, elevation } = items[index];
    const detail = {
      distance,
      elevation,
      index
    };
    const selectEvent = new CustomEvent('altpro-select', { detail });
    parent.dispatchEvent(selectEvent);
  }

}

},{"./find-segment":2,"./matrix2d":3}],2:[function(require,module,exports){
const findIndex = require('binary-search');

module.exports = findSegment;

function comparator(item, distance, i, items) {
  if (distance > item.distance) { return -1; } // to big
  let prevDistance = i > 0 ? items[i - 1].distance : 0;
  if (distance <= prevDistance) { return 1; } // to small
  return 0; // found it
}

function findSegment(items, distance) {
  if (distance === 0) {
    return 1;
  }
  return findIndex(items, distance, comparator);
}

},{"binary-search":4}],3:[function(require,module,exports){
module.exports = matrix2d;

/*
Based on: https://github.com/simonsarris/Canvas-tutorials/blob/master/transform.js
*/

function matrix2d(init) {
  let m;

  const self = {
    reset,
    multiply,
    invert,
    rotate,
    translate,
    scale,
    project,
    clone,
    apply
  };

  return reset(init);

  function reset(init = [1, 0, 0, 1, 0, 0]) {
    m = [...init];
    return self;
  }

  function clone() {
    return matrix2d(m);
  }

  function multiply(matrix) {
    const m11 = m[0] * matrix[0] + m[2] * matrix[1];
    const m12 = m[1] * matrix[0] + m[3] * matrix[1];

    const m21 = m[0] * matrix[2] + m[2] * matrix[3];
    const m22 = m[1] * matrix[2] + m[3] * matrix[3];

    const dx = m[0] * matrix[4] + m[2] * matrix[5] + m[4];
    const dy = m[1] * matrix[4] + m[3] * matrix[5] + m[5];

    m[0] = m11;
    m[1] = m12;
    m[2] = m21;
    m[3] = m22;
    m[4] = dx;
    m[5] = dy;

    return self;
  }

  function invert() {
    const d = 1 / (m[0] * m[3] - m[1] * m[2]);
    const m0 = m[3] * d;
    const m1 = -m[1] * d;
    const m2 = -m[2] * d;
    const m3 = m[0] * d;
    const m4 = d * (m[2] * m[5] - m[3] * m[4]);
    const m5 = d * (m[1] * m[4] - m[0] * m[5]);

    m[0] = m0;
    m[1] = m1;
    m[2] = m2;
    m[3] = m3;
    m[4] = m4;
    m[5] = m5;

    return self;
  }

  function rotate(rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    const m11 = m[0] * c + m[2] * s;
    const m12 = m[1] * c + m[3] * s;
    const m21 = m[0] * -s + m[2] * c;
    const m22 = m[1] * -s + m[3] * c;

    m[0] = m11;
    m[1] = m12;
    m[2] = m21;
    m[3] = m22;
    return self;
  }

  function translate(x, y) {
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
    return self;
  }

  function scale(sx, sy) {
    m[0] *= sx;
    m[1] *= sx;
    m[2] *= sy;
    m[3] *= sy;
    return self;
  }

  function project([x, y]) {
    return [
      x * m[0] + y * m[2] + m[4],
      x * m[1] + y * m[3] + m[5]
    ];
  }

  function apply(ctx) {
    ctx.setTransform(...m);
    return self;
  }
}

},{}],4:[function(require,module,exports){
module.exports = function(haystack, needle, comparator, low, high) {
  var mid, cmp;

  if(low === undefined)
    low = 0;

  else {
    low = low|0;
    if(low < 0 || low >= haystack.length)
      throw new RangeError("invalid lower bound");
  }

  if(high === undefined)
    high = haystack.length - 1;

  else {
    high = high|0;
    if(high < low || high >= haystack.length)
      throw new RangeError("invalid upper bound");
  }

  while(low <= high) {
    /* Note that "(low + high) >>> 1" may overflow, and results in a typecast
     * to double (which gives the wrong results). */
    mid = low + (high - low >> 1);
    cmp = +comparator(haystack[mid], needle, mid, haystack);

    /* Too low. */
    if(cmp < 0.0)
      low  = mid + 1;

    /* Too high. */
    else if(cmp > 0.0)
      high = mid - 1;

    /* Key found. */
    else
      return mid;
  }

  /* Key not found. */
  return ~low;
}

},{}],"altpro":[function(require,module,exports){
module.exports = require('./lib/altpro');

},{"./lib/altpro":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL2ZpbmQtc2VnbWVudC5qcyIsImxpYi9tYXRyaXgyZC5qcyIsIm5vZGVfbW9kdWxlcy9iaW5hcnktc2VhcmNoL2luZGV4LmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiY29uc3QgZmluZFNlZ21lbnQgPSByZXF1aXJlKCcuL2ZpbmQtc2VnbWVudCcpO1xuY29uc3QgbWF0cml4MmQgPSByZXF1aXJlKCcuL21hdHJpeDJkJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYWx0cHJvO1xuXG5jb25zdCByYWYgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IChmbiA9PiBmbigpIHx8IGZhbHNlKTtcblxuZnVuY3Rpb24gcHJlcGFyZShkYXRhKSB7XG4gIHJldHVybiBkYXRhLnJlZHVjZSgociwgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0pID0+IHtcbiAgICBpZiAoZWxldmF0aW9uIDwgci5taW5FbGV2YXRpb24pIHtcbiAgICAgIHIubWluRWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICBpZiAoZWxldmF0aW9uID4gci5tYXhFbGV2YXRpb24pIHtcbiAgICAgIHIubWF4RWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICByLnRvdGFsRGlzdGFuY2UgKz0gZGlzdGFuY2U7XG4gICAgci5pdGVtcy5wdXNoKHsgZWxldmF0aW9uLCBkaXN0YW5jZTogci50b3RhbERpc3RhbmNlIH0pO1xuICAgIHJldHVybiByO1xuICB9LCB7XG4gICAgaXRlbXM6IFtdLFxuICAgIHRvdGFsRGlzdGFuY2U6IDAsXG4gICAgbWluRWxldmF0aW9uOiBOdW1iZXIuTUFYX1ZBTFVFLFxuICAgIG1heEVsZXZhdGlvbjogMFxuICB9KTtcbn1cblxuZnVuY3Rpb24gaW5pdE1hdHJpeCh7IHcsIGggfSwgeyB4LCB5LCBtaW4gfSwgZHByKSB7XG4gIGNvbnN0IGhvcml6b250YWxQYWRkaW5nID0gMDtcbiAgY29uc3QgdmVydGljYWxQYWRkaW5nID0gMTU7XG5cbiAgdyAtPSAyICogaG9yaXpvbnRhbFBhZGRpbmc7XG4gIGggLT0gMiAqIHZlcnRpY2FsUGFkZGluZztcblxuICBjb25zdCBob3Jpem9udGFsU2NhbGluZyA9IHcgLyB4O1xuICBjb25zdCB2ZXJ0aWNhbFNjYWxpbmcgPSBoIC8geTtcblxuICByZXR1cm4gbWF0cml4MmQoKVxuICAgIC5zY2FsZShkcHIsIGRwcilcbiAgICAudHJhbnNsYXRlKGhvcml6b250YWxQYWRkaW5nLCB2ZXJ0aWNhbFBhZGRpbmcpXG4gICAgLnNjYWxlKGhvcml6b250YWxTY2FsaW5nLCAtdmVydGljYWxTY2FsaW5nKVxuICAgIC50cmFuc2xhdGUoMCwgLSh5ICsgbWluKSk7XG59XG5cbmZ1bmN0aW9uIGRyYXdQYXRoKGN0eCwgaXRlbXMsIHJlZikge1xuICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgY29uc3QgZmlyc3QgPSBpdGVtc1swXTtcbiAgY29uc3QgbGFzdCA9IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdO1xuXG4gIGN0eC5tb3ZlVG8oMCwgZmlyc3QuZWxldmF0aW9uID09PSB1bmRlZmluZWQgPyAwIDogKGZpcnN0LmVsZXZhdGlvbiAtIHJlZikpO1xuXG4gIGZvcihsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHsgZWxldmF0aW9uLCBkaXN0YW5jZSB9ID0gaXRlbXNbaV07XG4gICAgaWYgKGVsZXZhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjdHgubGluZVRvKGRpc3RhbmNlLCBlbGV2YXRpb24gLSByZWYpO1xuICAgIH1cbiAgfVxuICBpZiAobGFzdC5lbGV2YXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgIGN0eC5saW5lVG8obGFzdC5kaXN0YW5jZSwgMCk7XG4gIH1cblxuICBjdHguc3Ryb2tlKCk7XG5cbiAgY3R4LmxpbmVUbyhsYXN0LmRpc3RhbmNlLCAwKTtcbiAgY3R4LmxpbmVUbygwLCAwKTtcblxuICBjdHguY2xvc2VQYXRoKCk7XG4gIGN0eC5maWxsKCk7XG59XG5cbmZ1bmN0aW9uIGRyYXdTZWxlY3RlZChjdHgsIHsgZGlzdGFuY2U6IGQxLCBlbGV2YXRpb246IGUxIH0sIHsgZGlzdGFuY2U6IGQyLCBlbGV2YXRpb246IGUyIH0sIHJlZikge1xuICBjdHguYmVnaW5QYXRoKCk7XG4gIGN0eC5tb3ZlVG8oZDEsIDApO1xuICBpZiAoZTEgIT09IHVuZGVmaW5lZCkge1xuICAgIGN0eC5saW5lVG8oZDEsIGUxIC0gcmVmKTtcbiAgfVxuICBpZiAoZTIgIT09IHVuZGVmaW5lZCkge1xuICAgIGN0eC5saW5lVG8oZDIsIGUyIC0gcmVmKTtcbiAgfVxuICBjdHgubGluZVRvKGQyLCAwKTtcbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBjbGVhcihjdHgsIHsgdywgaCB9LCBkcHIpIHtcbiAgY3R4LnNhdmUoKTtcbiAgY3R4LnNldFRyYW5zZm9ybSgxLCAwLCAwLCAxLCAwLCAwKTtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3ICogZHByLCBoICogZHByKTtcbiAgY3R4LnJlc3RvcmUoKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlKHBhcmVudCwgbGFiZWwpIHtcblxuICBmdW5jdGlvbiBjYW52YXMod3JhcHBlciwgdywgaCwgZHByKSB7XG4gICAgY29uc3QgYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIGMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGMuc3R5bGUubGVmdCA9IDA7XG4gICAgYy5zdHlsZS5oZWlnaHQgPSAwO1xuICAgIGMuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgYy5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gICAgYy53aWR0aCA9IHcgKiBkcHI7XG4gICAgYy5oZWlnaHQgPSBoICogZHByO1xuICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoYyk7XG4gICAgcmV0dXJuIGM7XG4gIH1cblxuICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2FsdHByby13cmFwcGVyJztcbiAgd3JhcHBlci5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIHdyYXBwZXIuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gIHdyYXBwZXIuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICBwYXJlbnQuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cbiAgY29uc3QgeyBjbGllbnRXaWR0aDogdywgY2xpZW50SGVpZ2h0OiBoIH0gPSB3cmFwcGVyO1xuICBjb25zdCBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyB8fCAxO1xuXG4gIGNvbnN0IGJnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgsIGRwcik7XG4gIGNvbnN0IGZnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgsIGRwcik7XG5cbiAgaWYgKCFsYWJlbCkge1xuICAgIGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbGFiZWwuY2xhc3NOYW1lID0gJ2FsdHByby1sYWJlbCc7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChsYWJlbCk7XG4gIH1cblxuICByZXR1cm4geyBiZywgZmcsIGxhYmVsLCB3LCBoLCBkcHIgfTtcbn1cblxuZnVuY3Rpb24gYWx0cHJvKHBhcmVudCwgZGF0YSwgb3B0cyA9IHt9KSB7XG4gIGxldCB7XG4gICAgZmlsbCA9ICdjaGFydHJldXNlJyxcbiAgICBzdHJva2UgPSAnYmxhY2snLFxuICAgIHNlbGVjdGVkRmlsbCA9ICdvcmFuZ2UnLFxuICAgIHVuaXQgPSAnbSdcbiAgfSA9IG9wdHM7XG4gIGNvbnN0IHtcbiAgICBtaW5FbGV2YXRpb24sXG4gICAgbWF4RWxldmF0aW9uLFxuICAgIHRvdGFsRGlzdGFuY2UsXG4gICAgaXRlbXNcbiAgfSA9IHByZXBhcmUoZGF0YSk7XG5cbiAgY29uc3QgcmVmID0gbWluRWxldmF0aW9uIDwgMCA/IDAgOiAobWluRWxldmF0aW9uIC0gMC4wNSAqIChtYXhFbGV2YXRpb24gLSBtaW5FbGV2YXRpb24pKTtcbiAgY29uc3QgZXh0ZW50ID0ge1xuICAgIHg6IHRvdGFsRGlzdGFuY2UsXG4gICAgeTogbWF4RWxldmF0aW9uIC0gTWF0aC5taW4obWluRWxldmF0aW9uLCByZWYpLFxuICAgIG1pbjogTWF0aC5taW4obWluRWxldmF0aW9uLCAwKVxuICB9O1xuXG4gIGNvbnN0IHsgYmcsIGZnLCBsYWJlbCwgdywgaCwgZHByIH0gPSBjcmVhdGUocGFyZW50LCBvcHRzLmxhYmVsKTtcblxuICBjb25zdCBjdHggPSBiZy5nZXRDb250ZXh0KCcyZCcpO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBzdHJva2U7XG4gIGN0eC5maWxsU3R5bGUgPSBmaWxsO1xuXG4gIGNvbnN0IHRyYW5zZm9ybU1hdHJpYyA9IGluaXRNYXRyaXgoeyB3LCBoIH0sIGV4dGVudCwgZHByKTtcbiAgY29uc3QgaW52ZXJ0ZWRNYXRyaXggPSB0cmFuc2Zvcm1NYXRyaWMuY2xvbmUoKS5pbnZlcnQoKTtcbiAgdHJhbnNmb3JtTWF0cmljLmFwcGx5KGN0eCk7XG4gIGRyYXdQYXRoKGN0eCwgaXRlbXMsIHJlZik7XG5cbiAgY29uc3QgZmdDdHggPSBmZy5nZXRDb250ZXh0KCcyZCcpO1xuICBmZ0N0eC5maWxsU3R5bGUgPSBzZWxlY3RlZEZpbGw7XG4gIGZnQ3R4LmxpbmVXaWR0aCA9IDM7XG4gIHRyYW5zZm9ybU1hdHJpYy5hcHBseShmZ0N0eCk7XG5cbiAgZmcuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25tb3VzZW1vdmUpO1xuICBmZy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWxldmUnLCBvbm1vdXNlbGVhdmUpO1xuXG4gIGxldCBzZWxlY3RlZEluZGV4ID0gLTE7IC8vIG5vdGhpbmcgc2VsZWN0ZWRcbiAgbGV0IGFuaW1hdGlvbkZyYW1lO1xuXG4gIHJldHVybiB7XG4gICAgc2VsZWN0LFxuICAgIG9wdGlvbixcbiAgICBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gb3B0aW9uKGtleSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG9wdHNba2V5XTtcbiAgICB9XG4gICAgb3B0c1trZXldID0gdmFsdWU7XG4gICAgaWYgKGtleSA9PT0gJ3VuaXQnKSB7XG4gICAgICB1bml0ID0gb3B0cy51bml0O1xuICAgICAgaWYgKHNlbGVjdGVkSW5kZXggIT09IC0xKSB7XG4gICAgICAgIGRpc3BsYXlMYWJlbChpdGVtc1tzZWxlY3RlZEluZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICBmZy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbm1vdXNlbW92ZSk7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZXZlJywgb25tb3VzZWxlYXZlKTtcbiAgICBwYXJlbnQuaW5uZXJIVE1MID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBvbm1vdXNlbW92ZSh7IGNsaWVudFgsIGNsaWVudFksIHRhcmdldCB9KSB7XG4gICAgY29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBsZXQgaW5kZXggPSBpdGVtSW5kZXhGcm9tUG9pbnQoW1xuICAgICAgZHByICogKGNsaWVudFggLSByZWN0LmxlZnQpLFxuICAgICAgZHByICogKGNsaWVudFkgLSByZWN0LnRvcClcbiAgICBdKTtcbiAgICBzZWxlY3QoaW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZWxlYXZlKCkge1xuICAgIGxhYmVsLmhpZGRlbiA9IHRydWU7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9LCBkcHIpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXRlbUluZGV4RnJvbVBvaW50KHBvaW50KSB7XG4gICAgY29uc3QgWyBkaXN0YW5jZSBdID0gdW5wcm9qZWN0KHBvaW50KTtcbiAgICByZXR1cm4gZmluZFNlZ21lbnQoaXRlbXMsIGRpc3RhbmNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVucHJvamVjdChwb2ludCkge1xuICAgIHJldHVybiBpbnZlcnRlZE1hdHJpeC5wcm9qZWN0KHBvaW50KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdChpbmRleCkge1xuICAgIGlmIChpbmRleCA8IDEgfHwgaW5kZXggPj0gaXRlbXMubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChzZWxlY3RlZEluZGV4ID09PSBpbmRleCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZWxlY3RlZEluZGV4ID0gaW5kZXg7XG4gICAgaWYgKCFhbmltYXRpb25GcmFtZSkge1xuICAgICAgYW5pbWF0aW9uRnJhbWUgPSByYWYocmVmcmVzaFNlbGVjdGVkKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoU2VsZWN0ZWQoKSB7XG4gICAgYW5pbWF0aW9uRnJhbWUgPSB1bmRlZmluZWQ7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9LCBkcHIpO1xuICAgIGRyYXdTZWxlY3RlZChmZ0N0eCwgaXRlbXNbc2VsZWN0ZWRJbmRleCAtIDFdLCBpdGVtc1tzZWxlY3RlZEluZGV4XSwgcmVmKTtcbiAgICBkaXNwbGF5TGFiZWwoaXRlbXNbc2VsZWN0ZWRJbmRleF0pO1xuICAgIG5vdGlmeShzZWxlY3RlZEluZGV4KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc3BsYXlMYWJlbCh7IGVsZXZhdGlvbiB9KSB7XG4gICAgaWYgKGVsZXZhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodW5pdCA9PT0gJ2Z0Jykge1xuICAgICAgICBlbGV2YXRpb24gKj0gMy4yODA4NDtcbiAgICAgIH1cbiAgICAgIGVsZXZhdGlvbiA9IE1hdGgucm91bmQoZWxldmF0aW9uKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBlbGV2YXRpb24gPSAnJztcbiAgICB9XG4gICAgbGFiZWwuaW5uZXJUZXh0ID0gYCR7ZWxldmF0aW9ufWA7XG4gICAgbGFiZWwuaGlkZGVuID0gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBub3RpZnkoaW5kZXgpIHtcbiAgICBjb25zdCB7IGRpc3RhbmNlLCBlbGV2YXRpb24gfSA9IGl0ZW1zW2luZGV4XTtcbiAgICBjb25zdCBkZXRhaWwgPSB7XG4gICAgICBkaXN0YW5jZSxcbiAgICAgIGVsZXZhdGlvbixcbiAgICAgIGluZGV4XG4gICAgfTtcbiAgICBjb25zdCBzZWxlY3RFdmVudCA9IG5ldyBDdXN0b21FdmVudCgnYWx0cHJvLXNlbGVjdCcsIHsgZGV0YWlsIH0pO1xuICAgIHBhcmVudC5kaXNwYXRjaEV2ZW50KHNlbGVjdEV2ZW50KTtcbiAgfVxuXG59XG4iLCJjb25zdCBmaW5kSW5kZXggPSByZXF1aXJlKCdiaW5hcnktc2VhcmNoJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZFNlZ21lbnQ7XG5cbmZ1bmN0aW9uIGNvbXBhcmF0b3IoaXRlbSwgZGlzdGFuY2UsIGksIGl0ZW1zKSB7XG4gIGlmIChkaXN0YW5jZSA+IGl0ZW0uZGlzdGFuY2UpIHsgcmV0dXJuIC0xOyB9IC8vIHRvIGJpZ1xuICBsZXQgcHJldkRpc3RhbmNlID0gaSA+IDAgPyBpdGVtc1tpIC0gMV0uZGlzdGFuY2UgOiAwO1xuICBpZiAoZGlzdGFuY2UgPD0gcHJldkRpc3RhbmNlKSB7IHJldHVybiAxOyB9IC8vIHRvIHNtYWxsXG4gIHJldHVybiAwOyAvLyBmb3VuZCBpdFxufVxuXG5mdW5jdGlvbiBmaW5kU2VnbWVudChpdGVtcywgZGlzdGFuY2UpIHtcbiAgaWYgKGRpc3RhbmNlID09PSAwKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgcmV0dXJuIGZpbmRJbmRleChpdGVtcywgZGlzdGFuY2UsIGNvbXBhcmF0b3IpO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBtYXRyaXgyZDtcblxuLypcbkJhc2VkIG9uOiBodHRwczovL2dpdGh1Yi5jb20vc2ltb25zYXJyaXMvQ2FudmFzLXR1dG9yaWFscy9ibG9iL21hc3Rlci90cmFuc2Zvcm0uanNcbiovXG5cbmZ1bmN0aW9uIG1hdHJpeDJkKGluaXQpIHtcbiAgbGV0IG07XG5cbiAgY29uc3Qgc2VsZiA9IHtcbiAgICByZXNldCxcbiAgICBtdWx0aXBseSxcbiAgICBpbnZlcnQsXG4gICAgcm90YXRlLFxuICAgIHRyYW5zbGF0ZSxcbiAgICBzY2FsZSxcbiAgICBwcm9qZWN0LFxuICAgIGNsb25lLFxuICAgIGFwcGx5XG4gIH07XG5cbiAgcmV0dXJuIHJlc2V0KGluaXQpO1xuXG4gIGZ1bmN0aW9uIHJlc2V0KGluaXQgPSBbMSwgMCwgMCwgMSwgMCwgMF0pIHtcbiAgICBtID0gWy4uLmluaXRdO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xvbmUoKSB7XG4gICAgcmV0dXJuIG1hdHJpeDJkKG0pO1xuICB9XG5cbiAgZnVuY3Rpb24gbXVsdGlwbHkobWF0cml4KSB7XG4gICAgY29uc3QgbTExID0gbVswXSAqIG1hdHJpeFswXSArIG1bMl0gKiBtYXRyaXhbMV07XG4gICAgY29uc3QgbTEyID0gbVsxXSAqIG1hdHJpeFswXSArIG1bM10gKiBtYXRyaXhbMV07XG5cbiAgICBjb25zdCBtMjEgPSBtWzBdICogbWF0cml4WzJdICsgbVsyXSAqIG1hdHJpeFszXTtcbiAgICBjb25zdCBtMjIgPSBtWzFdICogbWF0cml4WzJdICsgbVszXSAqIG1hdHJpeFszXTtcblxuICAgIGNvbnN0IGR4ID0gbVswXSAqIG1hdHJpeFs0XSArIG1bMl0gKiBtYXRyaXhbNV0gKyBtWzRdO1xuICAgIGNvbnN0IGR5ID0gbVsxXSAqIG1hdHJpeFs0XSArIG1bM10gKiBtYXRyaXhbNV0gKyBtWzVdO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICBtWzRdID0gZHg7XG4gICAgbVs1XSA9IGR5O1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBpbnZlcnQoKSB7XG4gICAgY29uc3QgZCA9IDEgLyAobVswXSAqIG1bM10gLSBtWzFdICogbVsyXSk7XG4gICAgY29uc3QgbTAgPSBtWzNdICogZDtcbiAgICBjb25zdCBtMSA9IC1tWzFdICogZDtcbiAgICBjb25zdCBtMiA9IC1tWzJdICogZDtcbiAgICBjb25zdCBtMyA9IG1bMF0gKiBkO1xuICAgIGNvbnN0IG00ID0gZCAqIChtWzJdICogbVs1XSAtIG1bM10gKiBtWzRdKTtcbiAgICBjb25zdCBtNSA9IGQgKiAobVsxXSAqIG1bNF0gLSBtWzBdICogbVs1XSk7XG5cbiAgICBtWzBdID0gbTA7XG4gICAgbVsxXSA9IG0xO1xuICAgIG1bMl0gPSBtMjtcbiAgICBtWzNdID0gbTM7XG4gICAgbVs0XSA9IG00O1xuICAgIG1bNV0gPSBtNTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcm90YXRlKHJhZCkge1xuICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhyYWQpO1xuICAgIGNvbnN0IHMgPSBNYXRoLnNpbihyYWQpO1xuXG4gICAgY29uc3QgbTExID0gbVswXSAqIGMgKyBtWzJdICogcztcbiAgICBjb25zdCBtMTIgPSBtWzFdICogYyArIG1bM10gKiBzO1xuICAgIGNvbnN0IG0yMSA9IG1bMF0gKiAtcyArIG1bMl0gKiBjO1xuICAgIGNvbnN0IG0yMiA9IG1bMV0gKiAtcyArIG1bM10gKiBjO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zbGF0ZSh4LCB5KSB7XG4gICAgbVs0XSArPSBtWzBdICogeCArIG1bMl0gKiB5O1xuICAgIG1bNV0gKz0gbVsxXSAqIHggKyBtWzNdICogeTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNjYWxlKHN4LCBzeSkge1xuICAgIG1bMF0gKj0gc3g7XG4gICAgbVsxXSAqPSBzeDtcbiAgICBtWzJdICo9IHN5O1xuICAgIG1bM10gKj0gc3k7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0KFt4LCB5XSkge1xuICAgIHJldHVybiBbXG4gICAgICB4ICogbVswXSArIHkgKiBtWzJdICsgbVs0XSxcbiAgICAgIHggKiBtWzFdICsgeSAqIG1bM10gKyBtWzVdXG4gICAgXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5KGN0eCkge1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oLi4ubSk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaGF5c3RhY2ssIG5lZWRsZSwgY29tcGFyYXRvciwgbG93LCBoaWdoKSB7XG4gIHZhciBtaWQsIGNtcDtcblxuICBpZihsb3cgPT09IHVuZGVmaW5lZClcbiAgICBsb3cgPSAwO1xuXG4gIGVsc2Uge1xuICAgIGxvdyA9IGxvd3wwO1xuICAgIGlmKGxvdyA8IDAgfHwgbG93ID49IGhheXN0YWNrLmxlbmd0aClcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiaW52YWxpZCBsb3dlciBib3VuZFwiKTtcbiAgfVxuXG4gIGlmKGhpZ2ggPT09IHVuZGVmaW5lZClcbiAgICBoaWdoID0gaGF5c3RhY2subGVuZ3RoIC0gMTtcblxuICBlbHNlIHtcbiAgICBoaWdoID0gaGlnaHwwO1xuICAgIGlmKGhpZ2ggPCBsb3cgfHwgaGlnaCA+PSBoYXlzdGFjay5sZW5ndGgpXG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImludmFsaWQgdXBwZXIgYm91bmRcIik7XG4gIH1cblxuICB3aGlsZShsb3cgPD0gaGlnaCkge1xuICAgIC8qIE5vdGUgdGhhdCBcIihsb3cgKyBoaWdoKSA+Pj4gMVwiIG1heSBvdmVyZmxvdywgYW5kIHJlc3VsdHMgaW4gYSB0eXBlY2FzdFxuICAgICAqIHRvIGRvdWJsZSAod2hpY2ggZ2l2ZXMgdGhlIHdyb25nIHJlc3VsdHMpLiAqL1xuICAgIG1pZCA9IGxvdyArIChoaWdoIC0gbG93ID4+IDEpO1xuICAgIGNtcCA9ICtjb21wYXJhdG9yKGhheXN0YWNrW21pZF0sIG5lZWRsZSwgbWlkLCBoYXlzdGFjayk7XG5cbiAgICAvKiBUb28gbG93LiAqL1xuICAgIGlmKGNtcCA8IDAuMClcbiAgICAgIGxvdyAgPSBtaWQgKyAxO1xuXG4gICAgLyogVG9vIGhpZ2guICovXG4gICAgZWxzZSBpZihjbXAgPiAwLjApXG4gICAgICBoaWdoID0gbWlkIC0gMTtcblxuICAgIC8qIEtleSBmb3VuZC4gKi9cbiAgICBlbHNlXG4gICAgICByZXR1cm4gbWlkO1xuICB9XG5cbiAgLyogS2V5IG5vdCBmb3VuZC4gKi9cbiAgcmV0dXJuIH5sb3c7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2FsdHBybycpO1xuIl19
