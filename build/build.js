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
    minElevation: 0,
    maxElevation: 0
  });
}

function initMatrix({ w, h }, { x, y, min }) {
  const horizontalPadding = 0;
  const verticalPadding = 15;

  w -= 2 * horizontalPadding;
  h -= 2 * verticalPadding;

  const horizontalScaling = w / x;
  const verticalScaling = h / y;

  return matrix2d()
    .translate(horizontalPadding, verticalPadding)
    .scale(horizontalScaling, -verticalScaling)
    .translate(0, -(y + min));
}

function drawPath(ctx, items) {
  ctx.beginPath();

  const first = items[0];
  const last = items[items.length - 1];

  ctx.moveTo(0, first.elevation);

  for(let i = 1; i < items.length; i++) {
    const { elevation, distance } = items[i];
    ctx.lineTo(distance, elevation);
  }

  ctx.stroke();

  ctx.lineTo(last.distance, 0);
  ctx.lineTo(0, 0);

  ctx.closePath();
  ctx.fill();
}

function drawSelected(ctx, { distance: d1, elevation: e1 }, { distance: d2, elevation: e2 }) {
  ctx.beginPath();
  ctx.moveTo(d1, 0);
  ctx.lineTo(d1, e1);
  ctx.lineTo(d2, e2);
  ctx.lineTo(d2, 0);
  ctx.closePath();
  ctx.fill();
}

function clear(ctx, { w, h }) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.restore();
}

function create(parent) {

  function canvas(wrapper, w, h) {
    const c = document.createElement('canvas');
    c.style.position = 'absolute';
    c.style.left = 0;
    c.style.height = 0;
    c.style.width = '100%';
    c.style.height = '100%';
    c.width = w;
    c.height = h;
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
  const bg = canvas(wrapper, w, h);
  const fg = canvas(wrapper, w, h);

  const label = document.createElement('div');
  label.className = 'altpro-label';
  wrapper.appendChild(label);

  return { bg, fg, label, w, h,  };
}

function altpro(parent, data, opts = {}) {
  const {
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

  const extent = {
    x: totalDistance,
    y: maxElevation - minElevation,
    min: minElevation
  };

  const { bg, fg, label, w, h } = create(parent);

  const ctx = bg.getContext('2d');
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  const transformMatric = initMatrix({ w, h }, extent);
  const invertedMatrix = transformMatric.clone().invert();
  transformMatric.apply(ctx);
  drawPath(ctx, items);

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
    destroy
  };

  function destroy() {
    fg.removeEventListener('mousemove', onmousemove);
    fg.removeEventListener('mouseleve', onmouseleave);
    parent.innerHTML = '';
  }

  function onmousemove({ clientX, clientY, target }) {
    const rect = target.getBoundingClientRect();
    let index = itemIndexFromPoint([
      clientX - rect.left,
      clientY - rect.top
    ]);
    select(index);
  }

  function onmouseleave() {
    label.hidden = true;
    clear(fgCtx, { w, h });
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
    clear(fgCtx, { w, h });
    drawSelected(fgCtx, items[selectedIndex - 1], items[selectedIndex]);
    displayLabel(items[selectedIndex]);
    notify(selectedIndex);
  }

  function displayLabel({ elevation }) {
    if (unit === 'ft') {
      elevation *= 3.28084;
    }
    elevation = Math.round(elevation);
    label.innerText = `${elevation}${unit}`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL2ZpbmQtc2VnbWVudC5qcyIsImxpYi9tYXRyaXgyZC5qcyIsIm5vZGVfbW9kdWxlcy9iaW5hcnktc2VhcmNoL2luZGV4LmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IGZpbmRTZWdtZW50ID0gcmVxdWlyZSgnLi9maW5kLXNlZ21lbnQnKTtcbmNvbnN0IG1hdHJpeDJkID0gcmVxdWlyZSgnLi9tYXRyaXgyZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFsdHBybztcblxuY29uc3QgcmFmID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAoZm4gPT4gZm4oKSB8fCBmYWxzZSk7XG5cbmZ1bmN0aW9uIHByZXBhcmUoZGF0YSkge1xuICByZXR1cm4gZGF0YS5yZWR1Y2UoKHIsIHsgZWxldmF0aW9uLCBkaXN0YW5jZSB9KSA9PiB7XG4gICAgaWYgKGVsZXZhdGlvbiA8IHIubWluRWxldmF0aW9uKSB7XG4gICAgICByLm1pbkVsZXZhdGlvbiA9IGVsZXZhdGlvbjtcbiAgICB9XG4gICAgaWYgKGVsZXZhdGlvbiA+IHIubWF4RWxldmF0aW9uKSB7XG4gICAgICByLm1heEVsZXZhdGlvbiA9IGVsZXZhdGlvbjtcbiAgICB9XG4gICAgci50b3RhbERpc3RhbmNlICs9IGRpc3RhbmNlO1xuICAgIHIuaXRlbXMucHVzaCh7IGVsZXZhdGlvbiwgZGlzdGFuY2U6IHIudG90YWxEaXN0YW5jZSB9KTtcbiAgICByZXR1cm4gcjtcbiAgfSwge1xuICAgIGl0ZW1zOiBbXSxcbiAgICB0b3RhbERpc3RhbmNlOiAwLFxuICAgIG1pbkVsZXZhdGlvbjogMCxcbiAgICBtYXhFbGV2YXRpb246IDBcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGluaXRNYXRyaXgoeyB3LCBoIH0sIHsgeCwgeSwgbWluIH0pIHtcbiAgY29uc3QgaG9yaXpvbnRhbFBhZGRpbmcgPSAwO1xuICBjb25zdCB2ZXJ0aWNhbFBhZGRpbmcgPSAxNTtcblxuICB3IC09IDIgKiBob3Jpem9udGFsUGFkZGluZztcbiAgaCAtPSAyICogdmVydGljYWxQYWRkaW5nO1xuXG4gIGNvbnN0IGhvcml6b250YWxTY2FsaW5nID0gdyAvIHg7XG4gIGNvbnN0IHZlcnRpY2FsU2NhbGluZyA9IGggLyB5O1xuXG4gIHJldHVybiBtYXRyaXgyZCgpXG4gICAgLnRyYW5zbGF0ZShob3Jpem9udGFsUGFkZGluZywgdmVydGljYWxQYWRkaW5nKVxuICAgIC5zY2FsZShob3Jpem9udGFsU2NhbGluZywgLXZlcnRpY2FsU2NhbGluZylcbiAgICAudHJhbnNsYXRlKDAsIC0oeSArIG1pbikpO1xufVxuXG5mdW5jdGlvbiBkcmF3UGF0aChjdHgsIGl0ZW1zKSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XG5cbiAgY3R4Lm1vdmVUbygwLCBmaXJzdC5lbGV2YXRpb24pO1xuXG4gIGZvcihsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHsgZWxldmF0aW9uLCBkaXN0YW5jZSB9ID0gaXRlbXNbaV07XG4gICAgY3R4LmxpbmVUbyhkaXN0YW5jZSwgZWxldmF0aW9uKTtcbiAgfVxuXG4gIGN0eC5zdHJva2UoKTtcblxuICBjdHgubGluZVRvKGxhc3QuZGlzdGFuY2UsIDApO1xuICBjdHgubGluZVRvKDAsIDApO1xuXG4gIGN0eC5jbG9zZVBhdGgoKTtcbiAgY3R4LmZpbGwoKTtcbn1cblxuZnVuY3Rpb24gZHJhd1NlbGVjdGVkKGN0eCwgeyBkaXN0YW5jZTogZDEsIGVsZXZhdGlvbjogZTEgfSwgeyBkaXN0YW5jZTogZDIsIGVsZXZhdGlvbjogZTIgfSkge1xuICBjdHguYmVnaW5QYXRoKCk7XG4gIGN0eC5tb3ZlVG8oZDEsIDApO1xuICBjdHgubGluZVRvKGQxLCBlMSk7XG4gIGN0eC5saW5lVG8oZDIsIGUyKTtcbiAgY3R4LmxpbmVUbyhkMiwgMCk7XG4gIGN0eC5jbG9zZVBhdGgoKTtcbiAgY3R4LmZpbGwoKTtcbn1cblxuZnVuY3Rpb24gY2xlYXIoY3R4LCB7IHcsIGggfSkge1xuICBjdHguc2F2ZSgpO1xuICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xuICBjdHguY2xlYXJSZWN0KDAsIDAsIHcsIGgpO1xuICBjdHgucmVzdG9yZSgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGUocGFyZW50KSB7XG5cbiAgZnVuY3Rpb24gY2FudmFzKHdyYXBwZXIsIHcsIGgpIHtcbiAgICBjb25zdCBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgYy5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgYy5zdHlsZS5sZWZ0ID0gMDtcbiAgICBjLnN0eWxlLmhlaWdodCA9IDA7XG4gICAgYy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBjLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgICBjLndpZHRoID0gdztcbiAgICBjLmhlaWdodCA9IGg7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChjKTtcbiAgICByZXR1cm4gYztcbiAgfVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5jbGFzc05hbWUgPSAnYWx0cHJvLXdyYXBwZXInO1xuICB3cmFwcGVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgd3JhcHBlci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgd3JhcHBlci5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICBjb25zdCB7IGNsaWVudFdpZHRoOiB3LCBjbGllbnRIZWlnaHQ6IGggfSA9IHdyYXBwZXI7XG4gIGNvbnN0IGJnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgpO1xuICBjb25zdCBmZyA9IGNhbnZhcyh3cmFwcGVyLCB3LCBoKTtcblxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBsYWJlbC5jbGFzc05hbWUgPSAnYWx0cHJvLWxhYmVsJztcbiAgd3JhcHBlci5hcHBlbmRDaGlsZChsYWJlbCk7XG5cbiAgcmV0dXJuIHsgYmcsIGZnLCBsYWJlbCwgdywgaCwgIH07XG59XG5cbmZ1bmN0aW9uIGFsdHBybyhwYXJlbnQsIGRhdGEsIG9wdHMgPSB7fSkge1xuICBjb25zdCB7XG4gICAgZmlsbCA9ICdjaGFydHJldXNlJyxcbiAgICBzdHJva2UgPSAnYmxhY2snLFxuICAgIHNlbGVjdGVkRmlsbCA9ICdvcmFuZ2UnLFxuICAgIHVuaXQgPSAnbSdcbiAgfSA9IG9wdHM7XG4gIGNvbnN0IHtcbiAgICBtaW5FbGV2YXRpb24sXG4gICAgbWF4RWxldmF0aW9uLFxuICAgIHRvdGFsRGlzdGFuY2UsXG4gICAgaXRlbXNcbiAgfSA9IHByZXBhcmUoZGF0YSk7XG5cbiAgY29uc3QgZXh0ZW50ID0ge1xuICAgIHg6IHRvdGFsRGlzdGFuY2UsXG4gICAgeTogbWF4RWxldmF0aW9uIC0gbWluRWxldmF0aW9uLFxuICAgIG1pbjogbWluRWxldmF0aW9uXG4gIH07XG5cbiAgY29uc3QgeyBiZywgZmcsIGxhYmVsLCB3LCBoIH0gPSBjcmVhdGUocGFyZW50KTtcblxuICBjb25zdCBjdHggPSBiZy5nZXRDb250ZXh0KCcyZCcpO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBzdHJva2U7XG4gIGN0eC5maWxsU3R5bGUgPSBmaWxsO1xuXG4gIGNvbnN0IHRyYW5zZm9ybU1hdHJpYyA9IGluaXRNYXRyaXgoeyB3LCBoIH0sIGV4dGVudCk7XG4gIGNvbnN0IGludmVydGVkTWF0cml4ID0gdHJhbnNmb3JtTWF0cmljLmNsb25lKCkuaW52ZXJ0KCk7XG4gIHRyYW5zZm9ybU1hdHJpYy5hcHBseShjdHgpO1xuICBkcmF3UGF0aChjdHgsIGl0ZW1zKTtcblxuICBjb25zdCBmZ0N0eCA9IGZnLmdldENvbnRleHQoJzJkJyk7XG4gIGZnQ3R4LmZpbGxTdHlsZSA9IHNlbGVjdGVkRmlsbDtcbiAgZmdDdHgubGluZVdpZHRoID0gMztcbiAgdHJhbnNmb3JtTWF0cmljLmFwcGx5KGZnQ3R4KTtcblxuICBmZy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbm1vdXNlbW92ZSk7XG4gIGZnLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbGV2ZScsIG9ubW91c2VsZWF2ZSk7XG5cbiAgbGV0IHNlbGVjdGVkSW5kZXggPSAtMTsgLy8gbm90aGluZyBzZWxlY3RlZFxuICBsZXQgYW5pbWF0aW9uRnJhbWU7XG5cbiAgcmV0dXJuIHtcbiAgICBzZWxlY3QsXG4gICAgZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25tb3VzZW1vdmUpO1xuICAgIGZnLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbGV2ZScsIG9ubW91c2VsZWF2ZSk7XG4gICAgcGFyZW50LmlubmVySFRNTCA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZW1vdmUoeyBjbGllbnRYLCBjbGllbnRZLCB0YXJnZXQgfSkge1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGluZGV4ID0gaXRlbUluZGV4RnJvbVBvaW50KFtcbiAgICAgIGNsaWVudFggLSByZWN0LmxlZnQsXG4gICAgICBjbGllbnRZIC0gcmVjdC50b3BcbiAgICBdKTtcbiAgICBzZWxlY3QoaW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZWxlYXZlKCkge1xuICAgIGxhYmVsLmhpZGRlbiA9IHRydWU7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGl0ZW1JbmRleEZyb21Qb2ludChwb2ludCkge1xuICAgIGNvbnN0IFsgZGlzdGFuY2UgXSA9IHVucHJvamVjdChwb2ludCk7XG4gICAgcmV0dXJuIGZpbmRTZWdtZW50KGl0ZW1zLCBkaXN0YW5jZSk7XG4gIH1cblxuICBmdW5jdGlvbiB1bnByb2plY3QocG9pbnQpIHtcbiAgICByZXR1cm4gaW52ZXJ0ZWRNYXRyaXgucHJvamVjdChwb2ludCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3QoaW5kZXgpIHtcbiAgICBpZiAoaW5kZXggPCAxIHx8IGluZGV4ID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2VsZWN0ZWRJbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuICAgIGlmICghYW5pbWF0aW9uRnJhbWUpIHtcbiAgICAgIGFuaW1hdGlvbkZyYW1lID0gcmFmKHJlZnJlc2hTZWxlY3RlZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaFNlbGVjdGVkKCkge1xuICAgIGFuaW1hdGlvbkZyYW1lID0gdW5kZWZpbmVkO1xuICAgIGNsZWFyKGZnQ3R4LCB7IHcsIGggfSk7XG4gICAgZHJhd1NlbGVjdGVkKGZnQ3R4LCBpdGVtc1tzZWxlY3RlZEluZGV4IC0gMV0sIGl0ZW1zW3NlbGVjdGVkSW5kZXhdKTtcbiAgICBkaXNwbGF5TGFiZWwoaXRlbXNbc2VsZWN0ZWRJbmRleF0pO1xuICAgIG5vdGlmeShzZWxlY3RlZEluZGV4KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc3BsYXlMYWJlbCh7IGVsZXZhdGlvbiB9KSB7XG4gICAgaWYgKHVuaXQgPT09ICdmdCcpIHtcbiAgICAgIGVsZXZhdGlvbiAqPSAzLjI4MDg0O1xuICAgIH1cbiAgICBlbGV2YXRpb24gPSBNYXRoLnJvdW5kKGVsZXZhdGlvbik7XG4gICAgbGFiZWwuaW5uZXJUZXh0ID0gYCR7ZWxldmF0aW9ufSR7dW5pdH1gO1xuICAgIGxhYmVsLmhpZGRlbiA9IGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gbm90aWZ5KGluZGV4KSB7XG4gICAgY29uc3QgeyBkaXN0YW5jZSwgZWxldmF0aW9uIH0gPSBpdGVtc1tpbmRleF07XG4gICAgY29uc3QgZGV0YWlsID0ge1xuICAgICAgZGlzdGFuY2UsXG4gICAgICBlbGV2YXRpb24sXG4gICAgICBpbmRleFxuICAgIH07XG4gICAgY29uc3Qgc2VsZWN0RXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2FsdHByby1zZWxlY3QnLCB7IGRldGFpbCB9KTtcbiAgICBwYXJlbnQuZGlzcGF0Y2hFdmVudChzZWxlY3RFdmVudCk7XG4gIH1cblxufVxuIiwiY29uc3QgZmluZEluZGV4ID0gcmVxdWlyZSgnYmluYXJ5LXNlYXJjaCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRTZWdtZW50O1xuXG5mdW5jdGlvbiBjb21wYXJhdG9yKGl0ZW0sIGRpc3RhbmNlLCBpLCBpdGVtcykge1xuICBpZiAoZGlzdGFuY2UgPiBpdGVtLmRpc3RhbmNlKSB7IHJldHVybiAtMTsgfSAvLyB0byBiaWdcbiAgbGV0IHByZXZEaXN0YW5jZSA9IGkgPiAwID8gaXRlbXNbaSAtIDFdLmRpc3RhbmNlIDogMDtcbiAgaWYgKGRpc3RhbmNlIDw9IHByZXZEaXN0YW5jZSkgeyByZXR1cm4gMTsgfSAvLyB0byBzbWFsbFxuICByZXR1cm4gMDsgLy8gZm91bmQgaXRcbn1cblxuZnVuY3Rpb24gZmluZFNlZ21lbnQoaXRlbXMsIGRpc3RhbmNlKSB7XG4gIGlmIChkaXN0YW5jZSA9PT0gMCkge1xuICAgIHJldHVybiAxO1xuICB9XG4gIHJldHVybiBmaW5kSW5kZXgoaXRlbXMsIGRpc3RhbmNlLCBjb21wYXJhdG9yKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gbWF0cml4MmQ7XG5cbi8qXG5CYXNlZCBvbjogaHR0cHM6Ly9naXRodWIuY29tL3NpbW9uc2FycmlzL0NhbnZhcy10dXRvcmlhbHMvYmxvYi9tYXN0ZXIvdHJhbnNmb3JtLmpzXG4qL1xuXG5mdW5jdGlvbiBtYXRyaXgyZChpbml0KSB7XG4gIGxldCBtO1xuXG4gIGNvbnN0IHNlbGYgPSB7XG4gICAgcmVzZXQsXG4gICAgbXVsdGlwbHksXG4gICAgaW52ZXJ0LFxuICAgIHJvdGF0ZSxcbiAgICB0cmFuc2xhdGUsXG4gICAgc2NhbGUsXG4gICAgcHJvamVjdCxcbiAgICBjbG9uZSxcbiAgICBhcHBseVxuICB9O1xuXG4gIHJldHVybiByZXNldChpbml0KTtcblxuICBmdW5jdGlvbiByZXNldChpbml0ID0gWzEsIDAsIDAsIDEsIDAsIDBdKSB7XG4gICAgbSA9IFsuLi5pbml0XTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb25lKCkge1xuICAgIHJldHVybiBtYXRyaXgyZChtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG11bHRpcGx5KG1hdHJpeCkge1xuICAgIGNvbnN0IG0xMSA9IG1bMF0gKiBtYXRyaXhbMF0gKyBtWzJdICogbWF0cml4WzFdO1xuICAgIGNvbnN0IG0xMiA9IG1bMV0gKiBtYXRyaXhbMF0gKyBtWzNdICogbWF0cml4WzFdO1xuXG4gICAgY29uc3QgbTIxID0gbVswXSAqIG1hdHJpeFsyXSArIG1bMl0gKiBtYXRyaXhbM107XG4gICAgY29uc3QgbTIyID0gbVsxXSAqIG1hdHJpeFsyXSArIG1bM10gKiBtYXRyaXhbM107XG5cbiAgICBjb25zdCBkeCA9IG1bMF0gKiBtYXRyaXhbNF0gKyBtWzJdICogbWF0cml4WzVdICsgbVs0XTtcbiAgICBjb25zdCBkeSA9IG1bMV0gKiBtYXRyaXhbNF0gKyBtWzNdICogbWF0cml4WzVdICsgbVs1XTtcblxuICAgIG1bMF0gPSBtMTE7XG4gICAgbVsxXSA9IG0xMjtcbiAgICBtWzJdID0gbTIxO1xuICAgIG1bM10gPSBtMjI7XG4gICAgbVs0XSA9IGR4O1xuICAgIG1bNV0gPSBkeTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gaW52ZXJ0KCkge1xuICAgIGNvbnN0IGQgPSAxIC8gKG1bMF0gKiBtWzNdIC0gbVsxXSAqIG1bMl0pO1xuICAgIGNvbnN0IG0wID0gbVszXSAqIGQ7XG4gICAgY29uc3QgbTEgPSAtbVsxXSAqIGQ7XG4gICAgY29uc3QgbTIgPSAtbVsyXSAqIGQ7XG4gICAgY29uc3QgbTMgPSBtWzBdICogZDtcbiAgICBjb25zdCBtNCA9IGQgKiAobVsyXSAqIG1bNV0gLSBtWzNdICogbVs0XSk7XG4gICAgY29uc3QgbTUgPSBkICogKG1bMV0gKiBtWzRdIC0gbVswXSAqIG1bNV0pO1xuXG4gICAgbVswXSA9IG0wO1xuICAgIG1bMV0gPSBtMTtcbiAgICBtWzJdID0gbTI7XG4gICAgbVszXSA9IG0zO1xuICAgIG1bNF0gPSBtNDtcbiAgICBtWzVdID0gbTU7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJvdGF0ZShyYWQpIHtcbiAgICBjb25zdCBjID0gTWF0aC5jb3MocmFkKTtcbiAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkKTtcblxuICAgIGNvbnN0IG0xMSA9IG1bMF0gKiBjICsgbVsyXSAqIHM7XG4gICAgY29uc3QgbTEyID0gbVsxXSAqIGMgKyBtWzNdICogcztcbiAgICBjb25zdCBtMjEgPSBtWzBdICogLXMgKyBtWzJdICogYztcbiAgICBjb25zdCBtMjIgPSBtWzFdICogLXMgKyBtWzNdICogYztcblxuICAgIG1bMF0gPSBtMTE7XG4gICAgbVsxXSA9IG0xMjtcbiAgICBtWzJdID0gbTIxO1xuICAgIG1bM10gPSBtMjI7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFuc2xhdGUoeCwgeSkge1xuICAgIG1bNF0gKz0gbVswXSAqIHggKyBtWzJdICogeTtcbiAgICBtWzVdICs9IG1bMV0gKiB4ICsgbVszXSAqIHk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBzY2FsZShzeCwgc3kpIHtcbiAgICBtWzBdICo9IHN4O1xuICAgIG1bMV0gKj0gc3g7XG4gICAgbVsyXSAqPSBzeTtcbiAgICBtWzNdICo9IHN5O1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdChbeCwgeV0pIHtcbiAgICByZXR1cm4gW1xuICAgICAgeCAqIG1bMF0gKyB5ICogbVsyXSArIG1bNF0sXG4gICAgICB4ICogbVsxXSArIHkgKiBtWzNdICsgbVs1XVxuICAgIF07XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseShjdHgpIHtcbiAgICBjdHguc2V0VHJhbnNmb3JtKC4uLm0pO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGhheXN0YWNrLCBuZWVkbGUsIGNvbXBhcmF0b3IsIGxvdywgaGlnaCkge1xuICB2YXIgbWlkLCBjbXA7XG5cbiAgaWYobG93ID09PSB1bmRlZmluZWQpXG4gICAgbG93ID0gMDtcblxuICBlbHNlIHtcbiAgICBsb3cgPSBsb3d8MDtcbiAgICBpZihsb3cgPCAwIHx8IGxvdyA+PSBoYXlzdGFjay5sZW5ndGgpXG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImludmFsaWQgbG93ZXIgYm91bmRcIik7XG4gIH1cblxuICBpZihoaWdoID09PSB1bmRlZmluZWQpXG4gICAgaGlnaCA9IGhheXN0YWNrLmxlbmd0aCAtIDE7XG5cbiAgZWxzZSB7XG4gICAgaGlnaCA9IGhpZ2h8MDtcbiAgICBpZihoaWdoIDwgbG93IHx8IGhpZ2ggPj0gaGF5c3RhY2subGVuZ3RoKVxuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJpbnZhbGlkIHVwcGVyIGJvdW5kXCIpO1xuICB9XG5cbiAgd2hpbGUobG93IDw9IGhpZ2gpIHtcbiAgICAvKiBOb3RlIHRoYXQgXCIobG93ICsgaGlnaCkgPj4+IDFcIiBtYXkgb3ZlcmZsb3csIGFuZCByZXN1bHRzIGluIGEgdHlwZWNhc3RcbiAgICAgKiB0byBkb3VibGUgKHdoaWNoIGdpdmVzIHRoZSB3cm9uZyByZXN1bHRzKS4gKi9cbiAgICBtaWQgPSBsb3cgKyAoaGlnaCAtIGxvdyA+PiAxKTtcbiAgICBjbXAgPSArY29tcGFyYXRvcihoYXlzdGFja1ttaWRdLCBuZWVkbGUsIG1pZCwgaGF5c3RhY2spO1xuXG4gICAgLyogVG9vIGxvdy4gKi9cbiAgICBpZihjbXAgPCAwLjApXG4gICAgICBsb3cgID0gbWlkICsgMTtcblxuICAgIC8qIFRvbyBoaWdoLiAqL1xuICAgIGVsc2UgaWYoY21wID4gMC4wKVxuICAgICAgaGlnaCA9IG1pZCAtIDE7XG5cbiAgICAvKiBLZXkgZm91bmQuICovXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIG1pZDtcbiAgfVxuXG4gIC8qIEtleSBub3QgZm91bmQuICovXG4gIHJldHVybiB+bG93O1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9hbHRwcm8nKTtcbiJdfQ==
