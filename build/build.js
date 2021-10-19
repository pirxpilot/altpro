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
  fg.addEventListener('mouseleave', onmouseleave);

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
    fg.removeEventListener('mouseleave', onmouseleave);
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
    parent.dispatchEvent(new CustomEvent('altpro-select', {}));
  }

  function itemIndexFromPoint(point) {
    const [ distance ] = unproject(point);
    return findSegment(items, distance);
  }

  function unproject(point) {
    return invertedMatrix.project(point);
  }

  function select(index = -1) {
    if (index < 1 || index >= items.length) {
      label.hidden = true;
      clear(fgCtx, { w, h }, dpr);
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

  function calcElevation(elevation) {
    if (elevation === undefined) {
      return;
    }
    if (unit === 'ft') {
      elevation *= 3.28084;
    }
    return Math.round(elevation);
  }

  function displayLabel({ elevation }) {
    elevation = calcElevation(elevation);
    if (elevation === undefined) {
      elevation = '';
    }
    label.innerText = `${elevation}`;
    label.hidden = false;
  }

  function notify(index) {
    const { distance, elevation } = items[index];
    const detail = {
      distance,
      elevation: calcElevation(elevation),
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
    // The naive `low + high >>> 1` could fail for array lengths > 2**31
    // because `>>>` converts its operands to int32. `low + (high - low >>> 1)`
    // works for array lengths <= 2**32-1 which is also Javascript's max array
    // length.
    mid = low + ((high - low) >>> 1);
    cmp = +comparator(haystack[mid], needle, mid, haystack);

    // Too low.
    if(cmp < 0.0)
      low  = mid + 1;

    // Too high.
    else if(cmp > 0.0)
      high = mid - 1;

    // Key found.
    else
      return mid;
  }

  // Key not found.
  return ~low;
}

},{}],"altpro":[function(require,module,exports){
module.exports = require('./lib/altpro');

},{"./lib/altpro":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL2ZpbmQtc2VnbWVudC5qcyIsImxpYi9tYXRyaXgyZC5qcyIsIm5vZGVfbW9kdWxlcy9iaW5hcnktc2VhcmNoL2luZGV4LmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJjb25zdCBmaW5kU2VnbWVudCA9IHJlcXVpcmUoJy4vZmluZC1zZWdtZW50Jyk7XG5jb25zdCBtYXRyaXgyZCA9IHJlcXVpcmUoJy4vbWF0cml4MmQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBhbHRwcm87XG5cbmNvbnN0IHJhZiA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgKGZuID0+IGZuKCkgfHwgZmFsc2UpO1xuXG5mdW5jdGlvbiBwcmVwYXJlKGRhdGEpIHtcbiAgcmV0dXJuIGRhdGEucmVkdWNlKChyLCB7IGVsZXZhdGlvbiwgZGlzdGFuY2UgfSkgPT4ge1xuICAgIGlmIChlbGV2YXRpb24gPCByLm1pbkVsZXZhdGlvbikge1xuICAgICAgci5taW5FbGV2YXRpb24gPSBlbGV2YXRpb247XG4gICAgfVxuICAgIGlmIChlbGV2YXRpb24gPiByLm1heEVsZXZhdGlvbikge1xuICAgICAgci5tYXhFbGV2YXRpb24gPSBlbGV2YXRpb247XG4gICAgfVxuICAgIHIudG90YWxEaXN0YW5jZSArPSBkaXN0YW5jZTtcbiAgICByLml0ZW1zLnB1c2goeyBlbGV2YXRpb24sIGRpc3RhbmNlOiByLnRvdGFsRGlzdGFuY2UgfSk7XG4gICAgcmV0dXJuIHI7XG4gIH0sIHtcbiAgICBpdGVtczogW10sXG4gICAgdG90YWxEaXN0YW5jZTogMCxcbiAgICBtaW5FbGV2YXRpb246IE51bWJlci5NQVhfVkFMVUUsXG4gICAgbWF4RWxldmF0aW9uOiAwXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbml0TWF0cml4KHsgdywgaCB9LCB7IHgsIHksIG1pbiB9LCBkcHIpIHtcbiAgY29uc3QgaG9yaXpvbnRhbFBhZGRpbmcgPSAwO1xuICBjb25zdCB2ZXJ0aWNhbFBhZGRpbmcgPSAxNTtcblxuICB3IC09IDIgKiBob3Jpem9udGFsUGFkZGluZztcbiAgaCAtPSAyICogdmVydGljYWxQYWRkaW5nO1xuXG4gIGNvbnN0IGhvcml6b250YWxTY2FsaW5nID0gdyAvIHg7XG4gIGNvbnN0IHZlcnRpY2FsU2NhbGluZyA9IGggLyB5O1xuXG4gIHJldHVybiBtYXRyaXgyZCgpXG4gICAgLnNjYWxlKGRwciwgZHByKVxuICAgIC50cmFuc2xhdGUoaG9yaXpvbnRhbFBhZGRpbmcsIHZlcnRpY2FsUGFkZGluZylcbiAgICAuc2NhbGUoaG9yaXpvbnRhbFNjYWxpbmcsIC12ZXJ0aWNhbFNjYWxpbmcpXG4gICAgLnRyYW5zbGF0ZSgwLCAtKHkgKyBtaW4pKTtcbn1cblxuZnVuY3Rpb24gZHJhd1BhdGgoY3R4LCBpdGVtcywgcmVmKSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XG5cbiAgY3R4Lm1vdmVUbygwLCBmaXJzdC5lbGV2YXRpb24gPT09IHVuZGVmaW5lZCA/IDAgOiAoZmlyc3QuZWxldmF0aW9uIC0gcmVmKSk7XG5cbiAgZm9yKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0gPSBpdGVtc1tpXTtcbiAgICBpZiAoZWxldmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGN0eC5saW5lVG8oZGlzdGFuY2UsIGVsZXZhdGlvbiAtIHJlZik7XG4gICAgfVxuICB9XG4gIGlmIChsYXN0LmVsZXZhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY3R4LmxpbmVUbyhsYXN0LmRpc3RhbmNlLCAwKTtcbiAgfVxuXG4gIGN0eC5zdHJva2UoKTtcblxuICBjdHgubGluZVRvKGxhc3QuZGlzdGFuY2UsIDApO1xuICBjdHgubGluZVRvKDAsIDApO1xuXG4gIGN0eC5jbG9zZVBhdGgoKTtcbiAgY3R4LmZpbGwoKTtcbn1cblxuZnVuY3Rpb24gZHJhd1NlbGVjdGVkKGN0eCwgeyBkaXN0YW5jZTogZDEsIGVsZXZhdGlvbjogZTEgfSwgeyBkaXN0YW5jZTogZDIsIGVsZXZhdGlvbjogZTIgfSwgcmVmKSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4Lm1vdmVUbyhkMSwgMCk7XG4gIGlmIChlMSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY3R4LmxpbmVUbyhkMSwgZTEgLSByZWYpO1xuICB9XG4gIGlmIChlMiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY3R4LmxpbmVUbyhkMiwgZTIgLSByZWYpO1xuICB9XG4gIGN0eC5saW5lVG8oZDIsIDApO1xuICBjdHguY2xvc2VQYXRoKCk7XG4gIGN0eC5maWxsKCk7XG59XG5cbmZ1bmN0aW9uIGNsZWFyKGN0eCwgeyB3LCBoIH0sIGRwcikge1xuICBjdHguc2F2ZSgpO1xuICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xuICBjdHguY2xlYXJSZWN0KDAsIDAsIHcgKiBkcHIsIGggKiBkcHIpO1xuICBjdHgucmVzdG9yZSgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGUocGFyZW50LCBsYWJlbCkge1xuXG4gIGZ1bmN0aW9uIGNhbnZhcyh3cmFwcGVyLCB3LCBoLCBkcHIpIHtcbiAgICBjb25zdCBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgYy5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgYy5zdHlsZS5sZWZ0ID0gMDtcbiAgICBjLnN0eWxlLmhlaWdodCA9IDA7XG4gICAgYy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBjLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgICBjLndpZHRoID0gdyAqIGRwcjtcbiAgICBjLmhlaWdodCA9IGggKiBkcHI7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChjKTtcbiAgICByZXR1cm4gYztcbiAgfVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5jbGFzc05hbWUgPSAnYWx0cHJvLXdyYXBwZXInO1xuICB3cmFwcGVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgd3JhcHBlci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgd3JhcHBlci5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICBjb25zdCB7IGNsaWVudFdpZHRoOiB3LCBjbGllbnRIZWlnaHQ6IGggfSA9IHdyYXBwZXI7XG4gIGNvbnN0IGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG5cbiAgY29uc3QgYmcgPSBjYW52YXMod3JhcHBlciwgdywgaCwgZHByKTtcbiAgY29uc3QgZmcgPSBjYW52YXMod3JhcHBlciwgdywgaCwgZHByKTtcblxuICBpZiAoIWxhYmVsKSB7XG4gICAgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBsYWJlbC5jbGFzc05hbWUgPSAnYWx0cHJvLWxhYmVsJztcbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgfVxuXG4gIHJldHVybiB7IGJnLCBmZywgbGFiZWwsIHcsIGgsIGRwciB9O1xufVxuXG5mdW5jdGlvbiBhbHRwcm8ocGFyZW50LCBkYXRhLCBvcHRzID0ge30pIHtcbiAgbGV0IHtcbiAgICBmaWxsID0gJ2NoYXJ0cmV1c2UnLFxuICAgIHN0cm9rZSA9ICdibGFjaycsXG4gICAgc2VsZWN0ZWRGaWxsID0gJ29yYW5nZScsXG4gICAgdW5pdCA9ICdtJ1xuICB9ID0gb3B0cztcbiAgY29uc3Qge1xuICAgIG1pbkVsZXZhdGlvbixcbiAgICBtYXhFbGV2YXRpb24sXG4gICAgdG90YWxEaXN0YW5jZSxcbiAgICBpdGVtc1xuICB9ID0gcHJlcGFyZShkYXRhKTtcblxuICBjb25zdCByZWYgPSBtaW5FbGV2YXRpb24gPCAwID8gMCA6IChtaW5FbGV2YXRpb24gLSAwLjA1ICogKG1heEVsZXZhdGlvbiAtIG1pbkVsZXZhdGlvbikpO1xuICBjb25zdCBleHRlbnQgPSB7XG4gICAgeDogdG90YWxEaXN0YW5jZSxcbiAgICB5OiBtYXhFbGV2YXRpb24gLSBNYXRoLm1pbihtaW5FbGV2YXRpb24sIHJlZiksXG4gICAgbWluOiBNYXRoLm1pbihtaW5FbGV2YXRpb24sIDApXG4gIH07XG5cbiAgY29uc3QgeyBiZywgZmcsIGxhYmVsLCB3LCBoLCBkcHIgfSA9IGNyZWF0ZShwYXJlbnQsIG9wdHMubGFiZWwpO1xuXG4gIGNvbnN0IGN0eCA9IGJnLmdldENvbnRleHQoJzJkJyk7XG4gIGN0eC5zdHJva2VTdHlsZSA9IHN0cm9rZTtcbiAgY3R4LmZpbGxTdHlsZSA9IGZpbGw7XG5cbiAgY29uc3QgdHJhbnNmb3JtTWF0cmljID0gaW5pdE1hdHJpeCh7IHcsIGggfSwgZXh0ZW50LCBkcHIpO1xuICBjb25zdCBpbnZlcnRlZE1hdHJpeCA9IHRyYW5zZm9ybU1hdHJpYy5jbG9uZSgpLmludmVydCgpO1xuICB0cmFuc2Zvcm1NYXRyaWMuYXBwbHkoY3R4KTtcbiAgZHJhd1BhdGgoY3R4LCBpdGVtcywgcmVmKTtcblxuICBjb25zdCBmZ0N0eCA9IGZnLmdldENvbnRleHQoJzJkJyk7XG4gIGZnQ3R4LmZpbGxTdHlsZSA9IHNlbGVjdGVkRmlsbDtcbiAgZmdDdHgubGluZVdpZHRoID0gMztcbiAgdHJhbnNmb3JtTWF0cmljLmFwcGx5KGZnQ3R4KTtcblxuICBmZy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbm1vdXNlbW92ZSk7XG4gIGZnLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCBvbm1vdXNlbGVhdmUpO1xuXG4gIGxldCBzZWxlY3RlZEluZGV4ID0gLTE7IC8vIG5vdGhpbmcgc2VsZWN0ZWRcbiAgbGV0IGFuaW1hdGlvbkZyYW1lO1xuXG4gIHJldHVybiB7XG4gICAgc2VsZWN0LFxuICAgIG9wdGlvbixcbiAgICBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gb3B0aW9uKGtleSwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG9wdHNba2V5XTtcbiAgICB9XG4gICAgb3B0c1trZXldID0gdmFsdWU7XG4gICAgaWYgKGtleSA9PT0gJ3VuaXQnKSB7XG4gICAgICB1bml0ID0gb3B0cy51bml0O1xuICAgICAgaWYgKHNlbGVjdGVkSW5kZXggIT09IC0xKSB7XG4gICAgICAgIGRpc3BsYXlMYWJlbChpdGVtc1tzZWxlY3RlZEluZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICBmZy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbm1vdXNlbW92ZSk7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIG9ubW91c2VsZWF2ZSk7XG4gICAgcGFyZW50LmlubmVySFRNTCA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZW1vdmUoeyBjbGllbnRYLCBjbGllbnRZLCB0YXJnZXQgfSkge1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGluZGV4ID0gaXRlbUluZGV4RnJvbVBvaW50KFtcbiAgICAgIGRwciAqIChjbGllbnRYIC0gcmVjdC5sZWZ0KSxcbiAgICAgIGRwciAqIChjbGllbnRZIC0gcmVjdC50b3ApXG4gICAgXSk7XG4gICAgc2VsZWN0KGluZGV4KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9ubW91c2VsZWF2ZSgpIHtcbiAgICBsYWJlbC5oaWRkZW4gPSB0cnVlO1xuICAgIGNsZWFyKGZnQ3R4LCB7IHcsIGggfSwgZHByKTtcbiAgICBwYXJlbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ2FsdHByby1zZWxlY3QnLCB7fSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXRlbUluZGV4RnJvbVBvaW50KHBvaW50KSB7XG4gICAgY29uc3QgWyBkaXN0YW5jZSBdID0gdW5wcm9qZWN0KHBvaW50KTtcbiAgICByZXR1cm4gZmluZFNlZ21lbnQoaXRlbXMsIGRpc3RhbmNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVucHJvamVjdChwb2ludCkge1xuICAgIHJldHVybiBpbnZlcnRlZE1hdHJpeC5wcm9qZWN0KHBvaW50KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdChpbmRleCA9IC0xKSB7XG4gICAgaWYgKGluZGV4IDwgMSB8fCBpbmRleCA+PSBpdGVtcy5sZW5ndGgpIHtcbiAgICAgIGxhYmVsLmhpZGRlbiA9IHRydWU7XG4gICAgICBjbGVhcihmZ0N0eCwgeyB3LCBoIH0sIGRwcik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChzZWxlY3RlZEluZGV4ID09PSBpbmRleCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZWxlY3RlZEluZGV4ID0gaW5kZXg7XG4gICAgaWYgKCFhbmltYXRpb25GcmFtZSkge1xuICAgICAgYW5pbWF0aW9uRnJhbWUgPSByYWYocmVmcmVzaFNlbGVjdGVkKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoU2VsZWN0ZWQoKSB7XG4gICAgYW5pbWF0aW9uRnJhbWUgPSB1bmRlZmluZWQ7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9LCBkcHIpO1xuICAgIGRyYXdTZWxlY3RlZChmZ0N0eCwgaXRlbXNbc2VsZWN0ZWRJbmRleCAtIDFdLCBpdGVtc1tzZWxlY3RlZEluZGV4XSwgcmVmKTtcbiAgICBkaXNwbGF5TGFiZWwoaXRlbXNbc2VsZWN0ZWRJbmRleF0pO1xuICAgIG5vdGlmeShzZWxlY3RlZEluZGV4KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhbGNFbGV2YXRpb24oZWxldmF0aW9uKSB7XG4gICAgaWYgKGVsZXZhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh1bml0ID09PSAnZnQnKSB7XG4gICAgICBlbGV2YXRpb24gKj0gMy4yODA4NDtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgucm91bmQoZWxldmF0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc3BsYXlMYWJlbCh7IGVsZXZhdGlvbiB9KSB7XG4gICAgZWxldmF0aW9uID0gY2FsY0VsZXZhdGlvbihlbGV2YXRpb24pO1xuICAgIGlmIChlbGV2YXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgZWxldmF0aW9uID0gJyc7XG4gICAgfVxuICAgIGxhYmVsLmlubmVyVGV4dCA9IGAke2VsZXZhdGlvbn1gO1xuICAgIGxhYmVsLmhpZGRlbiA9IGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gbm90aWZ5KGluZGV4KSB7XG4gICAgY29uc3QgeyBkaXN0YW5jZSwgZWxldmF0aW9uIH0gPSBpdGVtc1tpbmRleF07XG4gICAgY29uc3QgZGV0YWlsID0ge1xuICAgICAgZGlzdGFuY2UsXG4gICAgICBlbGV2YXRpb246IGNhbGNFbGV2YXRpb24oZWxldmF0aW9uKSxcbiAgICAgIGluZGV4XG4gICAgfTtcbiAgICBjb25zdCBzZWxlY3RFdmVudCA9IG5ldyBDdXN0b21FdmVudCgnYWx0cHJvLXNlbGVjdCcsIHsgZGV0YWlsIH0pO1xuICAgIHBhcmVudC5kaXNwYXRjaEV2ZW50KHNlbGVjdEV2ZW50KTtcbiAgfVxuXG59XG4iLCJjb25zdCBmaW5kSW5kZXggPSByZXF1aXJlKCdiaW5hcnktc2VhcmNoJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZFNlZ21lbnQ7XG5cbmZ1bmN0aW9uIGNvbXBhcmF0b3IoaXRlbSwgZGlzdGFuY2UsIGksIGl0ZW1zKSB7XG4gIGlmIChkaXN0YW5jZSA+IGl0ZW0uZGlzdGFuY2UpIHsgcmV0dXJuIC0xOyB9IC8vIHRvIGJpZ1xuICBsZXQgcHJldkRpc3RhbmNlID0gaSA+IDAgPyBpdGVtc1tpIC0gMV0uZGlzdGFuY2UgOiAwO1xuICBpZiAoZGlzdGFuY2UgPD0gcHJldkRpc3RhbmNlKSB7IHJldHVybiAxOyB9IC8vIHRvIHNtYWxsXG4gIHJldHVybiAwOyAvLyBmb3VuZCBpdFxufVxuXG5mdW5jdGlvbiBmaW5kU2VnbWVudChpdGVtcywgZGlzdGFuY2UpIHtcbiAgaWYgKGRpc3RhbmNlID09PSAwKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgcmV0dXJuIGZpbmRJbmRleChpdGVtcywgZGlzdGFuY2UsIGNvbXBhcmF0b3IpO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBtYXRyaXgyZDtcblxuLypcbkJhc2VkIG9uOiBodHRwczovL2dpdGh1Yi5jb20vc2ltb25zYXJyaXMvQ2FudmFzLXR1dG9yaWFscy9ibG9iL21hc3Rlci90cmFuc2Zvcm0uanNcbiovXG5cbmZ1bmN0aW9uIG1hdHJpeDJkKGluaXQpIHtcbiAgbGV0IG07XG5cbiAgY29uc3Qgc2VsZiA9IHtcbiAgICByZXNldCxcbiAgICBtdWx0aXBseSxcbiAgICBpbnZlcnQsXG4gICAgcm90YXRlLFxuICAgIHRyYW5zbGF0ZSxcbiAgICBzY2FsZSxcbiAgICBwcm9qZWN0LFxuICAgIGNsb25lLFxuICAgIGFwcGx5XG4gIH07XG5cbiAgcmV0dXJuIHJlc2V0KGluaXQpO1xuXG4gIGZ1bmN0aW9uIHJlc2V0KGluaXQgPSBbMSwgMCwgMCwgMSwgMCwgMF0pIHtcbiAgICBtID0gWy4uLmluaXRdO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xvbmUoKSB7XG4gICAgcmV0dXJuIG1hdHJpeDJkKG0pO1xuICB9XG5cbiAgZnVuY3Rpb24gbXVsdGlwbHkobWF0cml4KSB7XG4gICAgY29uc3QgbTExID0gbVswXSAqIG1hdHJpeFswXSArIG1bMl0gKiBtYXRyaXhbMV07XG4gICAgY29uc3QgbTEyID0gbVsxXSAqIG1hdHJpeFswXSArIG1bM10gKiBtYXRyaXhbMV07XG5cbiAgICBjb25zdCBtMjEgPSBtWzBdICogbWF0cml4WzJdICsgbVsyXSAqIG1hdHJpeFszXTtcbiAgICBjb25zdCBtMjIgPSBtWzFdICogbWF0cml4WzJdICsgbVszXSAqIG1hdHJpeFszXTtcblxuICAgIGNvbnN0IGR4ID0gbVswXSAqIG1hdHJpeFs0XSArIG1bMl0gKiBtYXRyaXhbNV0gKyBtWzRdO1xuICAgIGNvbnN0IGR5ID0gbVsxXSAqIG1hdHJpeFs0XSArIG1bM10gKiBtYXRyaXhbNV0gKyBtWzVdO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICBtWzRdID0gZHg7XG4gICAgbVs1XSA9IGR5O1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBpbnZlcnQoKSB7XG4gICAgY29uc3QgZCA9IDEgLyAobVswXSAqIG1bM10gLSBtWzFdICogbVsyXSk7XG4gICAgY29uc3QgbTAgPSBtWzNdICogZDtcbiAgICBjb25zdCBtMSA9IC1tWzFdICogZDtcbiAgICBjb25zdCBtMiA9IC1tWzJdICogZDtcbiAgICBjb25zdCBtMyA9IG1bMF0gKiBkO1xuICAgIGNvbnN0IG00ID0gZCAqIChtWzJdICogbVs1XSAtIG1bM10gKiBtWzRdKTtcbiAgICBjb25zdCBtNSA9IGQgKiAobVsxXSAqIG1bNF0gLSBtWzBdICogbVs1XSk7XG5cbiAgICBtWzBdID0gbTA7XG4gICAgbVsxXSA9IG0xO1xuICAgIG1bMl0gPSBtMjtcbiAgICBtWzNdID0gbTM7XG4gICAgbVs0XSA9IG00O1xuICAgIG1bNV0gPSBtNTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcm90YXRlKHJhZCkge1xuICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhyYWQpO1xuICAgIGNvbnN0IHMgPSBNYXRoLnNpbihyYWQpO1xuXG4gICAgY29uc3QgbTExID0gbVswXSAqIGMgKyBtWzJdICogcztcbiAgICBjb25zdCBtMTIgPSBtWzFdICogYyArIG1bM10gKiBzO1xuICAgIGNvbnN0IG0yMSA9IG1bMF0gKiAtcyArIG1bMl0gKiBjO1xuICAgIGNvbnN0IG0yMiA9IG1bMV0gKiAtcyArIG1bM10gKiBjO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zbGF0ZSh4LCB5KSB7XG4gICAgbVs0XSArPSBtWzBdICogeCArIG1bMl0gKiB5O1xuICAgIG1bNV0gKz0gbVsxXSAqIHggKyBtWzNdICogeTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNjYWxlKHN4LCBzeSkge1xuICAgIG1bMF0gKj0gc3g7XG4gICAgbVsxXSAqPSBzeDtcbiAgICBtWzJdICo9IHN5O1xuICAgIG1bM10gKj0gc3k7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0KFt4LCB5XSkge1xuICAgIHJldHVybiBbXG4gICAgICB4ICogbVswXSArIHkgKiBtWzJdICsgbVs0XSxcbiAgICAgIHggKiBtWzFdICsgeSAqIG1bM10gKyBtWzVdXG4gICAgXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5KGN0eCkge1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oLi4ubSk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaGF5c3RhY2ssIG5lZWRsZSwgY29tcGFyYXRvciwgbG93LCBoaWdoKSB7XG4gIHZhciBtaWQsIGNtcDtcblxuICBpZihsb3cgPT09IHVuZGVmaW5lZClcbiAgICBsb3cgPSAwO1xuXG4gIGVsc2Uge1xuICAgIGxvdyA9IGxvd3wwO1xuICAgIGlmKGxvdyA8IDAgfHwgbG93ID49IGhheXN0YWNrLmxlbmd0aClcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiaW52YWxpZCBsb3dlciBib3VuZFwiKTtcbiAgfVxuXG4gIGlmKGhpZ2ggPT09IHVuZGVmaW5lZClcbiAgICBoaWdoID0gaGF5c3RhY2subGVuZ3RoIC0gMTtcblxuICBlbHNlIHtcbiAgICBoaWdoID0gaGlnaHwwO1xuICAgIGlmKGhpZ2ggPCBsb3cgfHwgaGlnaCA+PSBoYXlzdGFjay5sZW5ndGgpXG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImludmFsaWQgdXBwZXIgYm91bmRcIik7XG4gIH1cblxuICB3aGlsZShsb3cgPD0gaGlnaCkge1xuICAgIC8vIFRoZSBuYWl2ZSBgbG93ICsgaGlnaCA+Pj4gMWAgY291bGQgZmFpbCBmb3IgYXJyYXkgbGVuZ3RocyA+IDIqKjMxXG4gICAgLy8gYmVjYXVzZSBgPj4+YCBjb252ZXJ0cyBpdHMgb3BlcmFuZHMgdG8gaW50MzIuIGBsb3cgKyAoaGlnaCAtIGxvdyA+Pj4gMSlgXG4gICAgLy8gd29ya3MgZm9yIGFycmF5IGxlbmd0aHMgPD0gMioqMzItMSB3aGljaCBpcyBhbHNvIEphdmFzY3JpcHQncyBtYXggYXJyYXlcbiAgICAvLyBsZW5ndGguXG4gICAgbWlkID0gbG93ICsgKChoaWdoIC0gbG93KSA+Pj4gMSk7XG4gICAgY21wID0gK2NvbXBhcmF0b3IoaGF5c3RhY2tbbWlkXSwgbmVlZGxlLCBtaWQsIGhheXN0YWNrKTtcblxuICAgIC8vIFRvbyBsb3cuXG4gICAgaWYoY21wIDwgMC4wKVxuICAgICAgbG93ICA9IG1pZCArIDE7XG5cbiAgICAvLyBUb28gaGlnaC5cbiAgICBlbHNlIGlmKGNtcCA+IDAuMClcbiAgICAgIGhpZ2ggPSBtaWQgLSAxO1xuXG4gICAgLy8gS2V5IGZvdW5kLlxuICAgIGVsc2VcbiAgICAgIHJldHVybiBtaWQ7XG4gIH1cblxuICAvLyBLZXkgbm90IGZvdW5kLlxuICByZXR1cm4gfmxvdztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvYWx0cHJvJyk7XG4iXX0=
