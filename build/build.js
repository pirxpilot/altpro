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

function drawPath(ctx, items, ref) {
  ctx.beginPath();

  const first = items[0];
  const last = items[items.length - 1];

  ctx.moveTo(0, first.elevation - ref);

  for(let i = 1; i < items.length; i++) {
    const { elevation, distance } = items[i];
    ctx.lineTo(distance, elevation - ref);
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
  ctx.lineTo(d1, e1 - ref);
  ctx.lineTo(d2, e2 - ref);
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

function create(parent, label) {

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

  if (!label) {
    label = document.createElement('div');
    label.className = 'altpro-label';
    wrapper.appendChild(label);
  }

  return { bg, fg, label, w, h,  };
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

  const { bg, fg, label, w, h } = create(parent, opts.label);

  const ctx = bg.getContext('2d');
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  const transformMatric = initMatrix({ w, h }, extent);
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
    drawSelected(fgCtx, items[selectedIndex - 1], items[selectedIndex], ref);
    displayLabel(items[selectedIndex]);
    notify(selectedIndex);
  }

  function displayLabel({ elevation }) {
    if (unit === 'ft') {
      elevation *= 3.28084;
    }
    elevation = Math.round(elevation);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL2ZpbmQtc2VnbWVudC5qcyIsImxpYi9tYXRyaXgyZC5qcyIsIm5vZGVfbW9kdWxlcy9iaW5hcnktc2VhcmNoL2luZGV4LmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJjb25zdCBmaW5kU2VnbWVudCA9IHJlcXVpcmUoJy4vZmluZC1zZWdtZW50Jyk7XG5jb25zdCBtYXRyaXgyZCA9IHJlcXVpcmUoJy4vbWF0cml4MmQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBhbHRwcm87XG5cbmNvbnN0IHJhZiA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgKGZuID0+IGZuKCkgfHwgZmFsc2UpO1xuXG5mdW5jdGlvbiBwcmVwYXJlKGRhdGEpIHtcbiAgcmV0dXJuIGRhdGEucmVkdWNlKChyLCB7IGVsZXZhdGlvbiwgZGlzdGFuY2UgfSkgPT4ge1xuICAgIGlmIChlbGV2YXRpb24gPCByLm1pbkVsZXZhdGlvbikge1xuICAgICAgci5taW5FbGV2YXRpb24gPSBlbGV2YXRpb247XG4gICAgfVxuICAgIGlmIChlbGV2YXRpb24gPiByLm1heEVsZXZhdGlvbikge1xuICAgICAgci5tYXhFbGV2YXRpb24gPSBlbGV2YXRpb247XG4gICAgfVxuICAgIHIudG90YWxEaXN0YW5jZSArPSBkaXN0YW5jZTtcbiAgICByLml0ZW1zLnB1c2goeyBlbGV2YXRpb24sIGRpc3RhbmNlOiByLnRvdGFsRGlzdGFuY2UgfSk7XG4gICAgcmV0dXJuIHI7XG4gIH0sIHtcbiAgICBpdGVtczogW10sXG4gICAgdG90YWxEaXN0YW5jZTogMCxcbiAgICBtaW5FbGV2YXRpb246IE51bWJlci5NQVhfVkFMVUUsXG4gICAgbWF4RWxldmF0aW9uOiAwXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbml0TWF0cml4KHsgdywgaCB9LCB7IHgsIHksIG1pbiB9KSB7XG4gIGNvbnN0IGhvcml6b250YWxQYWRkaW5nID0gMDtcbiAgY29uc3QgdmVydGljYWxQYWRkaW5nID0gMTU7XG5cbiAgdyAtPSAyICogaG9yaXpvbnRhbFBhZGRpbmc7XG4gIGggLT0gMiAqIHZlcnRpY2FsUGFkZGluZztcblxuICBjb25zdCBob3Jpem9udGFsU2NhbGluZyA9IHcgLyB4O1xuICBjb25zdCB2ZXJ0aWNhbFNjYWxpbmcgPSBoIC8geTtcblxuICByZXR1cm4gbWF0cml4MmQoKVxuICAgIC50cmFuc2xhdGUoaG9yaXpvbnRhbFBhZGRpbmcsIHZlcnRpY2FsUGFkZGluZylcbiAgICAuc2NhbGUoaG9yaXpvbnRhbFNjYWxpbmcsIC12ZXJ0aWNhbFNjYWxpbmcpXG4gICAgLnRyYW5zbGF0ZSgwLCAtKHkgKyBtaW4pKTtcbn1cblxuZnVuY3Rpb24gZHJhd1BhdGgoY3R4LCBpdGVtcywgcmVmKSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcblxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XG5cbiAgY3R4Lm1vdmVUbygwLCBmaXJzdC5lbGV2YXRpb24gLSByZWYpO1xuXG4gIGZvcihsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHsgZWxldmF0aW9uLCBkaXN0YW5jZSB9ID0gaXRlbXNbaV07XG4gICAgY3R4LmxpbmVUbyhkaXN0YW5jZSwgZWxldmF0aW9uIC0gcmVmKTtcbiAgfVxuXG4gIGN0eC5zdHJva2UoKTtcblxuICBjdHgubGluZVRvKGxhc3QuZGlzdGFuY2UsIDApO1xuICBjdHgubGluZVRvKDAsIDApO1xuXG4gIGN0eC5jbG9zZVBhdGgoKTtcbiAgY3R4LmZpbGwoKTtcbn1cblxuZnVuY3Rpb24gZHJhd1NlbGVjdGVkKGN0eCwgeyBkaXN0YW5jZTogZDEsIGVsZXZhdGlvbjogZTEgfSwgeyBkaXN0YW5jZTogZDIsIGVsZXZhdGlvbjogZTIgfSwgcmVmKSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4Lm1vdmVUbyhkMSwgMCk7XG4gIGN0eC5saW5lVG8oZDEsIGUxIC0gcmVmKTtcbiAgY3R4LmxpbmVUbyhkMiwgZTIgLSByZWYpO1xuICBjdHgubGluZVRvKGQyLCAwKTtcbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBjbGVhcihjdHgsIHsgdywgaCB9KSB7XG4gIGN0eC5zYXZlKCk7XG4gIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG4gIGN0eC5yZXN0b3JlKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZShwYXJlbnQsIGxhYmVsKSB7XG5cbiAgZnVuY3Rpb24gY2FudmFzKHdyYXBwZXIsIHcsIGgpIHtcbiAgICBjb25zdCBjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgYy5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgYy5zdHlsZS5sZWZ0ID0gMDtcbiAgICBjLnN0eWxlLmhlaWdodCA9IDA7XG4gICAgYy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBjLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgICBjLndpZHRoID0gdztcbiAgICBjLmhlaWdodCA9IGg7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZChjKTtcbiAgICByZXR1cm4gYztcbiAgfVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5jbGFzc05hbWUgPSAnYWx0cHJvLXdyYXBwZXInO1xuICB3cmFwcGVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgd3JhcHBlci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgd3JhcHBlci5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICBjb25zdCB7IGNsaWVudFdpZHRoOiB3LCBjbGllbnRIZWlnaHQ6IGggfSA9IHdyYXBwZXI7XG4gIGNvbnN0IGJnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgpO1xuICBjb25zdCBmZyA9IGNhbnZhcyh3cmFwcGVyLCB3LCBoKTtcblxuICBpZiAoIWxhYmVsKSB7XG4gICAgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBsYWJlbC5jbGFzc05hbWUgPSAnYWx0cHJvLWxhYmVsJztcbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgfVxuXG4gIHJldHVybiB7IGJnLCBmZywgbGFiZWwsIHcsIGgsICB9O1xufVxuXG5mdW5jdGlvbiBhbHRwcm8ocGFyZW50LCBkYXRhLCBvcHRzID0ge30pIHtcbiAgbGV0IHtcbiAgICBmaWxsID0gJ2NoYXJ0cmV1c2UnLFxuICAgIHN0cm9rZSA9ICdibGFjaycsXG4gICAgc2VsZWN0ZWRGaWxsID0gJ29yYW5nZScsXG4gICAgdW5pdCA9ICdtJ1xuICB9ID0gb3B0cztcbiAgY29uc3Qge1xuICAgIG1pbkVsZXZhdGlvbixcbiAgICBtYXhFbGV2YXRpb24sXG4gICAgdG90YWxEaXN0YW5jZSxcbiAgICBpdGVtc1xuICB9ID0gcHJlcGFyZShkYXRhKTtcblxuICBjb25zdCByZWYgPSBtaW5FbGV2YXRpb24gPCAwID8gMCA6IChtaW5FbGV2YXRpb24gLSAwLjA1ICogKG1heEVsZXZhdGlvbiAtIG1pbkVsZXZhdGlvbikpO1xuICBjb25zdCBleHRlbnQgPSB7XG4gICAgeDogdG90YWxEaXN0YW5jZSxcbiAgICB5OiBtYXhFbGV2YXRpb24gLSBNYXRoLm1pbihtaW5FbGV2YXRpb24sIHJlZiksXG4gICAgbWluOiBNYXRoLm1pbihtaW5FbGV2YXRpb24sIDApXG4gIH07XG5cbiAgY29uc3QgeyBiZywgZmcsIGxhYmVsLCB3LCBoIH0gPSBjcmVhdGUocGFyZW50LCBvcHRzLmxhYmVsKTtcblxuICBjb25zdCBjdHggPSBiZy5nZXRDb250ZXh0KCcyZCcpO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBzdHJva2U7XG4gIGN0eC5maWxsU3R5bGUgPSBmaWxsO1xuXG4gIGNvbnN0IHRyYW5zZm9ybU1hdHJpYyA9IGluaXRNYXRyaXgoeyB3LCBoIH0sIGV4dGVudCk7XG4gIGNvbnN0IGludmVydGVkTWF0cml4ID0gdHJhbnNmb3JtTWF0cmljLmNsb25lKCkuaW52ZXJ0KCk7XG4gIHRyYW5zZm9ybU1hdHJpYy5hcHBseShjdHgpO1xuICBkcmF3UGF0aChjdHgsIGl0ZW1zLCByZWYpO1xuXG4gIGNvbnN0IGZnQ3R4ID0gZmcuZ2V0Q29udGV4dCgnMmQnKTtcbiAgZmdDdHguZmlsbFN0eWxlID0gc2VsZWN0ZWRGaWxsO1xuICBmZ0N0eC5saW5lV2lkdGggPSAzO1xuICB0cmFuc2Zvcm1NYXRyaWMuYXBwbHkoZmdDdHgpO1xuXG4gIGZnLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9ubW91c2Vtb3ZlKTtcbiAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZXZlJywgb25tb3VzZWxlYXZlKTtcblxuICBsZXQgc2VsZWN0ZWRJbmRleCA9IC0xOyAvLyBub3RoaW5nIHNlbGVjdGVkXG4gIGxldCBhbmltYXRpb25GcmFtZTtcblxuICByZXR1cm4ge1xuICAgIHNlbGVjdCxcbiAgICBvcHRpb24sXG4gICAgZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIG9wdGlvbihrZXksIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBvcHRzW2tleV07XG4gICAgfVxuICAgIG9wdHNba2V5XSA9IHZhbHVlO1xuICAgIGlmIChrZXkgPT09ICd1bml0Jykge1xuICAgICAgdW5pdCA9IG9wdHMudW5pdDtcbiAgICAgIGlmIChzZWxlY3RlZEluZGV4ICE9PSAtMSkge1xuICAgICAgICBkaXNwbGF5TGFiZWwoaXRlbXNbc2VsZWN0ZWRJbmRleF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25tb3VzZW1vdmUpO1xuICAgIGZnLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbGV2ZScsIG9ubW91c2VsZWF2ZSk7XG4gICAgcGFyZW50LmlubmVySFRNTCA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZW1vdmUoeyBjbGllbnRYLCBjbGllbnRZLCB0YXJnZXQgfSkge1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGluZGV4ID0gaXRlbUluZGV4RnJvbVBvaW50KFtcbiAgICAgIGNsaWVudFggLSByZWN0LmxlZnQsXG4gICAgICBjbGllbnRZIC0gcmVjdC50b3BcbiAgICBdKTtcbiAgICBzZWxlY3QoaW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZWxlYXZlKCkge1xuICAgIGxhYmVsLmhpZGRlbiA9IHRydWU7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGl0ZW1JbmRleEZyb21Qb2ludChwb2ludCkge1xuICAgIGNvbnN0IFsgZGlzdGFuY2UgXSA9IHVucHJvamVjdChwb2ludCk7XG4gICAgcmV0dXJuIGZpbmRTZWdtZW50KGl0ZW1zLCBkaXN0YW5jZSk7XG4gIH1cblxuICBmdW5jdGlvbiB1bnByb2plY3QocG9pbnQpIHtcbiAgICByZXR1cm4gaW52ZXJ0ZWRNYXRyaXgucHJvamVjdChwb2ludCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3QoaW5kZXgpIHtcbiAgICBpZiAoaW5kZXggPCAxIHx8IGluZGV4ID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2VsZWN0ZWRJbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuICAgIGlmICghYW5pbWF0aW9uRnJhbWUpIHtcbiAgICAgIGFuaW1hdGlvbkZyYW1lID0gcmFmKHJlZnJlc2hTZWxlY3RlZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaFNlbGVjdGVkKCkge1xuICAgIGFuaW1hdGlvbkZyYW1lID0gdW5kZWZpbmVkO1xuICAgIGNsZWFyKGZnQ3R4LCB7IHcsIGggfSk7XG4gICAgZHJhd1NlbGVjdGVkKGZnQ3R4LCBpdGVtc1tzZWxlY3RlZEluZGV4IC0gMV0sIGl0ZW1zW3NlbGVjdGVkSW5kZXhdLCByZWYpO1xuICAgIGRpc3BsYXlMYWJlbChpdGVtc1tzZWxlY3RlZEluZGV4XSk7XG4gICAgbm90aWZ5KHNlbGVjdGVkSW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlzcGxheUxhYmVsKHsgZWxldmF0aW9uIH0pIHtcbiAgICBpZiAodW5pdCA9PT0gJ2Z0Jykge1xuICAgICAgZWxldmF0aW9uICo9IDMuMjgwODQ7XG4gICAgfVxuICAgIGVsZXZhdGlvbiA9IE1hdGgucm91bmQoZWxldmF0aW9uKTtcbiAgICBsYWJlbC5pbm5lclRleHQgPSBgJHtlbGV2YXRpb259YDtcbiAgICBsYWJlbC5oaWRkZW4gPSBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vdGlmeShpbmRleCkge1xuICAgIGNvbnN0IHsgZGlzdGFuY2UsIGVsZXZhdGlvbiB9ID0gaXRlbXNbaW5kZXhdO1xuICAgIGNvbnN0IGRldGFpbCA9IHtcbiAgICAgIGRpc3RhbmNlLFxuICAgICAgZWxldmF0aW9uLFxuICAgICAgaW5kZXhcbiAgICB9O1xuICAgIGNvbnN0IHNlbGVjdEV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdhbHRwcm8tc2VsZWN0JywgeyBkZXRhaWwgfSk7XG4gICAgcGFyZW50LmRpc3BhdGNoRXZlbnQoc2VsZWN0RXZlbnQpO1xuICB9XG5cbn1cbiIsImNvbnN0IGZpbmRJbmRleCA9IHJlcXVpcmUoJ2JpbmFyeS1zZWFyY2gnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmaW5kU2VnbWVudDtcblxuZnVuY3Rpb24gY29tcGFyYXRvcihpdGVtLCBkaXN0YW5jZSwgaSwgaXRlbXMpIHtcbiAgaWYgKGRpc3RhbmNlID4gaXRlbS5kaXN0YW5jZSkgeyByZXR1cm4gLTE7IH0gLy8gdG8gYmlnXG4gIGxldCBwcmV2RGlzdGFuY2UgPSBpID4gMCA/IGl0ZW1zW2kgLSAxXS5kaXN0YW5jZSA6IDA7XG4gIGlmIChkaXN0YW5jZSA8PSBwcmV2RGlzdGFuY2UpIHsgcmV0dXJuIDE7IH0gLy8gdG8gc21hbGxcbiAgcmV0dXJuIDA7IC8vIGZvdW5kIGl0XG59XG5cbmZ1bmN0aW9uIGZpbmRTZWdtZW50KGl0ZW1zLCBkaXN0YW5jZSkge1xuICBpZiAoZGlzdGFuY2UgPT09IDApIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICByZXR1cm4gZmluZEluZGV4KGl0ZW1zLCBkaXN0YW5jZSwgY29tcGFyYXRvcik7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IG1hdHJpeDJkO1xuXG4vKlxuQmFzZWQgb246IGh0dHBzOi8vZ2l0aHViLmNvbS9zaW1vbnNhcnJpcy9DYW52YXMtdHV0b3JpYWxzL2Jsb2IvbWFzdGVyL3RyYW5zZm9ybS5qc1xuKi9cblxuZnVuY3Rpb24gbWF0cml4MmQoaW5pdCkge1xuICBsZXQgbTtcblxuICBjb25zdCBzZWxmID0ge1xuICAgIHJlc2V0LFxuICAgIG11bHRpcGx5LFxuICAgIGludmVydCxcbiAgICByb3RhdGUsXG4gICAgdHJhbnNsYXRlLFxuICAgIHNjYWxlLFxuICAgIHByb2plY3QsXG4gICAgY2xvbmUsXG4gICAgYXBwbHlcbiAgfTtcblxuICByZXR1cm4gcmVzZXQoaW5pdCk7XG5cbiAgZnVuY3Rpb24gcmVzZXQoaW5pdCA9IFsxLCAwLCAwLCAxLCAwLCAwXSkge1xuICAgIG0gPSBbLi4uaW5pdF07XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBjbG9uZSgpIHtcbiAgICByZXR1cm4gbWF0cml4MmQobSk7XG4gIH1cblxuICBmdW5jdGlvbiBtdWx0aXBseShtYXRyaXgpIHtcbiAgICBjb25zdCBtMTEgPSBtWzBdICogbWF0cml4WzBdICsgbVsyXSAqIG1hdHJpeFsxXTtcbiAgICBjb25zdCBtMTIgPSBtWzFdICogbWF0cml4WzBdICsgbVszXSAqIG1hdHJpeFsxXTtcblxuICAgIGNvbnN0IG0yMSA9IG1bMF0gKiBtYXRyaXhbMl0gKyBtWzJdICogbWF0cml4WzNdO1xuICAgIGNvbnN0IG0yMiA9IG1bMV0gKiBtYXRyaXhbMl0gKyBtWzNdICogbWF0cml4WzNdO1xuXG4gICAgY29uc3QgZHggPSBtWzBdICogbWF0cml4WzRdICsgbVsyXSAqIG1hdHJpeFs1XSArIG1bNF07XG4gICAgY29uc3QgZHkgPSBtWzFdICogbWF0cml4WzRdICsgbVszXSAqIG1hdHJpeFs1XSArIG1bNV07XG5cbiAgICBtWzBdID0gbTExO1xuICAgIG1bMV0gPSBtMTI7XG4gICAgbVsyXSA9IG0yMTtcbiAgICBtWzNdID0gbTIyO1xuICAgIG1bNF0gPSBkeDtcbiAgICBtWzVdID0gZHk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludmVydCgpIHtcbiAgICBjb25zdCBkID0gMSAvIChtWzBdICogbVszXSAtIG1bMV0gKiBtWzJdKTtcbiAgICBjb25zdCBtMCA9IG1bM10gKiBkO1xuICAgIGNvbnN0IG0xID0gLW1bMV0gKiBkO1xuICAgIGNvbnN0IG0yID0gLW1bMl0gKiBkO1xuICAgIGNvbnN0IG0zID0gbVswXSAqIGQ7XG4gICAgY29uc3QgbTQgPSBkICogKG1bMl0gKiBtWzVdIC0gbVszXSAqIG1bNF0pO1xuICAgIGNvbnN0IG01ID0gZCAqIChtWzFdICogbVs0XSAtIG1bMF0gKiBtWzVdKTtcblxuICAgIG1bMF0gPSBtMDtcbiAgICBtWzFdID0gbTE7XG4gICAgbVsyXSA9IG0yO1xuICAgIG1bM10gPSBtMztcbiAgICBtWzRdID0gbTQ7XG4gICAgbVs1XSA9IG01O1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiByb3RhdGUocmFkKSB7XG4gICAgY29uc3QgYyA9IE1hdGguY29zKHJhZCk7XG4gICAgY29uc3QgcyA9IE1hdGguc2luKHJhZCk7XG5cbiAgICBjb25zdCBtMTEgPSBtWzBdICogYyArIG1bMl0gKiBzO1xuICAgIGNvbnN0IG0xMiA9IG1bMV0gKiBjICsgbVszXSAqIHM7XG4gICAgY29uc3QgbTIxID0gbVswXSAqIC1zICsgbVsyXSAqIGM7XG4gICAgY29uc3QgbTIyID0gbVsxXSAqIC1zICsgbVszXSAqIGM7XG5cbiAgICBtWzBdID0gbTExO1xuICAgIG1bMV0gPSBtMTI7XG4gICAgbVsyXSA9IG0yMTtcbiAgICBtWzNdID0gbTIyO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhbnNsYXRlKHgsIHkpIHtcbiAgICBtWzRdICs9IG1bMF0gKiB4ICsgbVsyXSAqIHk7XG4gICAgbVs1XSArPSBtWzFdICogeCArIG1bM10gKiB5O1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gc2NhbGUoc3gsIHN5KSB7XG4gICAgbVswXSAqPSBzeDtcbiAgICBtWzFdICo9IHN4O1xuICAgIG1bMl0gKj0gc3k7XG4gICAgbVszXSAqPSBzeTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3QoW3gsIHldKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHggKiBtWzBdICsgeSAqIG1bMl0gKyBtWzRdLFxuICAgICAgeCAqIG1bMV0gKyB5ICogbVszXSArIG1bNV1cbiAgICBdO1xuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHkoY3R4KSB7XG4gICAgY3R4LnNldFRyYW5zZm9ybSguLi5tKTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihoYXlzdGFjaywgbmVlZGxlLCBjb21wYXJhdG9yLCBsb3csIGhpZ2gpIHtcbiAgdmFyIG1pZCwgY21wO1xuXG4gIGlmKGxvdyA9PT0gdW5kZWZpbmVkKVxuICAgIGxvdyA9IDA7XG5cbiAgZWxzZSB7XG4gICAgbG93ID0gbG93fDA7XG4gICAgaWYobG93IDwgMCB8fCBsb3cgPj0gaGF5c3RhY2subGVuZ3RoKVxuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJpbnZhbGlkIGxvd2VyIGJvdW5kXCIpO1xuICB9XG5cbiAgaWYoaGlnaCA9PT0gdW5kZWZpbmVkKVxuICAgIGhpZ2ggPSBoYXlzdGFjay5sZW5ndGggLSAxO1xuXG4gIGVsc2Uge1xuICAgIGhpZ2ggPSBoaWdofDA7XG4gICAgaWYoaGlnaCA8IGxvdyB8fCBoaWdoID49IGhheXN0YWNrLmxlbmd0aClcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiaW52YWxpZCB1cHBlciBib3VuZFwiKTtcbiAgfVxuXG4gIHdoaWxlKGxvdyA8PSBoaWdoKSB7XG4gICAgLyogTm90ZSB0aGF0IFwiKGxvdyArIGhpZ2gpID4+PiAxXCIgbWF5IG92ZXJmbG93LCBhbmQgcmVzdWx0cyBpbiBhIHR5cGVjYXN0XG4gICAgICogdG8gZG91YmxlICh3aGljaCBnaXZlcyB0aGUgd3JvbmcgcmVzdWx0cykuICovXG4gICAgbWlkID0gbG93ICsgKGhpZ2ggLSBsb3cgPj4gMSk7XG4gICAgY21wID0gK2NvbXBhcmF0b3IoaGF5c3RhY2tbbWlkXSwgbmVlZGxlLCBtaWQsIGhheXN0YWNrKTtcblxuICAgIC8qIFRvbyBsb3cuICovXG4gICAgaWYoY21wIDwgMC4wKVxuICAgICAgbG93ICA9IG1pZCArIDE7XG5cbiAgICAvKiBUb28gaGlnaC4gKi9cbiAgICBlbHNlIGlmKGNtcCA+IDAuMClcbiAgICAgIGhpZ2ggPSBtaWQgLSAxO1xuXG4gICAgLyogS2V5IGZvdW5kLiAqL1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBtaWQ7XG4gIH1cblxuICAvKiBLZXkgbm90IGZvdW5kLiAqL1xuICByZXR1cm4gfmxvdztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvYWx0cHJvJyk7XG4iXX0=
