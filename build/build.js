require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const matrix2d = require('./matrix2d');

module.exports = altpro;

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
    return items.findIndex(item => distance < item.distance);
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
    clear(fgCtx, { w, h });
    drawSelected(fgCtx, items[index - 1], items[index]);
    displayLabel(items[index]);
    notify(index);
    selectedIndex = index;
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

},{"./matrix2d":2}],2:[function(require,module,exports){
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

},{}],"altpro":[function(require,module,exports){
module.exports = require('./lib/altpro');

},{"./lib/altpro":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL21hdHJpeDJkLmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IG1hdHJpeDJkID0gcmVxdWlyZSgnLi9tYXRyaXgyZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFsdHBybztcblxuZnVuY3Rpb24gcHJlcGFyZShkYXRhKSB7XG4gIHJldHVybiBkYXRhLnJlZHVjZSgociwgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0pID0+IHtcbiAgICBpZiAoZWxldmF0aW9uIDwgci5taW5FbGV2YXRpb24pIHtcbiAgICAgIHIubWluRWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICBpZiAoZWxldmF0aW9uID4gci5tYXhFbGV2YXRpb24pIHtcbiAgICAgIHIubWF4RWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICByLnRvdGFsRGlzdGFuY2UgKz0gZGlzdGFuY2U7XG4gICAgci5pdGVtcy5wdXNoKHsgZWxldmF0aW9uLCBkaXN0YW5jZTogci50b3RhbERpc3RhbmNlIH0pO1xuICAgIHJldHVybiByO1xuICB9LCB7XG4gICAgaXRlbXM6IFtdLFxuICAgIHRvdGFsRGlzdGFuY2U6IDAsXG4gICAgbWluRWxldmF0aW9uOiAwLFxuICAgIG1heEVsZXZhdGlvbjogMFxuICB9KTtcbn1cblxuZnVuY3Rpb24gaW5pdE1hdHJpeCh7IHcsIGggfSwgeyB4LCB5LCBtaW4gfSkge1xuICBjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IDA7XG4gIGNvbnN0IHZlcnRpY2FsUGFkZGluZyA9IDE1O1xuXG4gIHcgLT0gMiAqIGhvcml6b250YWxQYWRkaW5nO1xuICBoIC09IDIgKiB2ZXJ0aWNhbFBhZGRpbmc7XG5cbiAgY29uc3QgaG9yaXpvbnRhbFNjYWxpbmcgPSB3IC8geDtcbiAgY29uc3QgdmVydGljYWxTY2FsaW5nID0gaCAvIHk7XG5cbiAgcmV0dXJuIG1hdHJpeDJkKClcbiAgICAudHJhbnNsYXRlKGhvcml6b250YWxQYWRkaW5nLCB2ZXJ0aWNhbFBhZGRpbmcpXG4gICAgLnNjYWxlKGhvcml6b250YWxTY2FsaW5nLCAtdmVydGljYWxTY2FsaW5nKVxuICAgIC50cmFuc2xhdGUoMCwgLSh5ICsgbWluKSk7XG59XG5cbmZ1bmN0aW9uIGRyYXdQYXRoKGN0eCwgaXRlbXMpIHtcbiAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gIGNvbnN0IGZpcnN0ID0gaXRlbXNbMF07XG4gIGNvbnN0IGxhc3QgPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcblxuICBjdHgubW92ZVRvKDAsIGZpcnN0LmVsZXZhdGlvbik7XG5cbiAgZm9yKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0gPSBpdGVtc1tpXTtcbiAgICBjdHgubGluZVRvKGRpc3RhbmNlLCBlbGV2YXRpb24pO1xuICB9XG5cbiAgY3R4LnN0cm9rZSgpO1xuXG4gIGN0eC5saW5lVG8obGFzdC5kaXN0YW5jZSwgMCk7XG4gIGN0eC5saW5lVG8oMCwgMCk7XG5cbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBkcmF3U2VsZWN0ZWQoY3R4LCB7IGRpc3RhbmNlOiBkMSwgZWxldmF0aW9uOiBlMSB9LCB7IGRpc3RhbmNlOiBkMiwgZWxldmF0aW9uOiBlMiB9KSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4Lm1vdmVUbyhkMSwgMCk7XG4gIGN0eC5saW5lVG8oZDEsIGUxKTtcbiAgY3R4LmxpbmVUbyhkMiwgZTIpO1xuICBjdHgubGluZVRvKGQyLCAwKTtcbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBjbGVhcihjdHgsIHsgdywgaCB9KSB7XG4gIGN0eC5zYXZlKCk7XG4gIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG4gIGN0eC5yZXN0b3JlKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZShwYXJlbnQpIHtcblxuICBmdW5jdGlvbiBjYW52YXMod3JhcHBlciwgdywgaCkge1xuICAgIGNvbnN0IGMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBjLnN0eWxlLmxlZnQgPSAwO1xuICAgIGMuc3R5bGUuaGVpZ2h0ID0gMDtcbiAgICBjLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGMuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgIGMud2lkdGggPSB3O1xuICAgIGMuaGVpZ2h0ID0gaDtcbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGMpO1xuICAgIHJldHVybiBjO1xuICB9XG5cbiAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdhbHRwcm8td3JhcHBlcic7XG4gIHdyYXBwZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICB3cmFwcGVyLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICB3cmFwcGVyLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgcGFyZW50LmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG4gIGNvbnN0IHsgY2xpZW50V2lkdGg6IHcsIGNsaWVudEhlaWdodDogaCB9ID0gd3JhcHBlcjtcbiAgY29uc3QgYmcgPSBjYW52YXMod3JhcHBlciwgdywgaCk7XG4gIGNvbnN0IGZnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgpO1xuXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdhbHRwcm8tbGFiZWwnO1xuICB3cmFwcGVyLmFwcGVuZENoaWxkKGxhYmVsKTtcblxuICByZXR1cm4geyBiZywgZmcsIGxhYmVsLCB3LCBoLCAgfTtcbn1cblxuZnVuY3Rpb24gYWx0cHJvKHBhcmVudCwgZGF0YSwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IHtcbiAgICBmaWxsID0gJ2NoYXJ0cmV1c2UnLFxuICAgIHN0cm9rZSA9ICdibGFjaycsXG4gICAgc2VsZWN0ZWRGaWxsID0gJ29yYW5nZScsXG4gICAgdW5pdCA9ICdtJ1xuICB9ID0gb3B0cztcbiAgY29uc3Qge1xuICAgIG1pbkVsZXZhdGlvbixcbiAgICBtYXhFbGV2YXRpb24sXG4gICAgdG90YWxEaXN0YW5jZSxcbiAgICBpdGVtc1xuICB9ID0gcHJlcGFyZShkYXRhKTtcblxuICBjb25zdCBleHRlbnQgPSB7XG4gICAgeDogdG90YWxEaXN0YW5jZSxcbiAgICB5OiBtYXhFbGV2YXRpb24gLSBtaW5FbGV2YXRpb24sXG4gICAgbWluOiBtaW5FbGV2YXRpb25cbiAgfTtcblxuICBjb25zdCB7IGJnLCBmZywgbGFiZWwsIHcsIGggfSA9IGNyZWF0ZShwYXJlbnQpO1xuXG4gIGNvbnN0IGN0eCA9IGJnLmdldENvbnRleHQoJzJkJyk7XG4gIGN0eC5zdHJva2VTdHlsZSA9IHN0cm9rZTtcbiAgY3R4LmZpbGxTdHlsZSA9IGZpbGw7XG5cbiAgY29uc3QgdHJhbnNmb3JtTWF0cmljID0gaW5pdE1hdHJpeCh7IHcsIGggfSwgZXh0ZW50KTtcbiAgY29uc3QgaW52ZXJ0ZWRNYXRyaXggPSB0cmFuc2Zvcm1NYXRyaWMuY2xvbmUoKS5pbnZlcnQoKTtcbiAgdHJhbnNmb3JtTWF0cmljLmFwcGx5KGN0eCk7XG4gIGRyYXdQYXRoKGN0eCwgaXRlbXMpO1xuXG4gIGNvbnN0IGZnQ3R4ID0gZmcuZ2V0Q29udGV4dCgnMmQnKTtcbiAgZmdDdHguZmlsbFN0eWxlID0gc2VsZWN0ZWRGaWxsO1xuICBmZ0N0eC5saW5lV2lkdGggPSAzO1xuICB0cmFuc2Zvcm1NYXRyaWMuYXBwbHkoZmdDdHgpO1xuXG4gIGZnLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9ubW91c2Vtb3ZlKTtcbiAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZXZlJywgb25tb3VzZWxlYXZlKTtcblxuICBsZXQgc2VsZWN0ZWRJbmRleCA9IC0xOyAvLyBub3RoaW5nIHNlbGVjdGVkXG5cbiAgcmV0dXJuIHtcbiAgICBzZWxlY3QsXG4gICAgZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25tb3VzZW1vdmUpO1xuICAgIGZnLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbGV2ZScsIG9ubW91c2VsZWF2ZSk7XG4gICAgcGFyZW50LmlubmVySFRNTCA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZW1vdmUoeyBjbGllbnRYLCBjbGllbnRZLCB0YXJnZXQgfSkge1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGluZGV4ID0gaXRlbUluZGV4RnJvbVBvaW50KFtcbiAgICAgIGNsaWVudFggLSByZWN0LmxlZnQsXG4gICAgICBjbGllbnRZIC0gcmVjdC50b3BcbiAgICBdKTtcbiAgICBzZWxlY3QoaW5kZXgpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25tb3VzZWxlYXZlKCkge1xuICAgIGxhYmVsLmhpZGRlbiA9IHRydWU7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGl0ZW1JbmRleEZyb21Qb2ludChwb2ludCkge1xuICAgIGNvbnN0IFsgZGlzdGFuY2UgXSA9IHVucHJvamVjdChwb2ludCk7XG4gICAgcmV0dXJuIGl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGRpc3RhbmNlIDwgaXRlbS5kaXN0YW5jZSk7XG4gIH1cblxuICBmdW5jdGlvbiB1bnByb2plY3QocG9pbnQpIHtcbiAgICByZXR1cm4gaW52ZXJ0ZWRNYXRyaXgucHJvamVjdChwb2ludCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3QoaW5kZXgpIHtcbiAgICBpZiAoaW5kZXggPCAxIHx8IGluZGV4ID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc2VsZWN0ZWRJbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9KTtcbiAgICBkcmF3U2VsZWN0ZWQoZmdDdHgsIGl0ZW1zW2luZGV4IC0gMV0sIGl0ZW1zW2luZGV4XSk7XG4gICAgZGlzcGxheUxhYmVsKGl0ZW1zW2luZGV4XSk7XG4gICAgbm90aWZ5KGluZGV4KTtcbiAgICBzZWxlY3RlZEluZGV4ID0gaW5kZXg7XG4gIH1cblxuICBmdW5jdGlvbiBkaXNwbGF5TGFiZWwoeyBlbGV2YXRpb24gfSkge1xuICAgIGlmICh1bml0ID09PSAnZnQnKSB7XG4gICAgICBlbGV2YXRpb24gKj0gMy4yODA4NDtcbiAgICB9XG4gICAgZWxldmF0aW9uID0gTWF0aC5yb3VuZChlbGV2YXRpb24pO1xuICAgIGxhYmVsLmlubmVyVGV4dCA9IGAke2VsZXZhdGlvbn0ke3VuaXR9YDtcbiAgICBsYWJlbC5oaWRkZW4gPSBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vdGlmeShpbmRleCkge1xuICAgIGNvbnN0IHsgZGlzdGFuY2UsIGVsZXZhdGlvbiB9ID0gaXRlbXNbaW5kZXhdO1xuICAgIGNvbnN0IGRldGFpbCA9IHtcbiAgICAgIGRpc3RhbmNlLFxuICAgICAgZWxldmF0aW9uLFxuICAgICAgaW5kZXhcbiAgICB9O1xuICAgIGNvbnN0IHNlbGVjdEV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdhbHRwcm8tc2VsZWN0JywgeyBkZXRhaWwgfSk7XG4gICAgcGFyZW50LmRpc3BhdGNoRXZlbnQoc2VsZWN0RXZlbnQpO1xuICB9XG5cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gbWF0cml4MmQ7XG5cbi8qXG5CYXNlZCBvbjogaHR0cHM6Ly9naXRodWIuY29tL3NpbW9uc2FycmlzL0NhbnZhcy10dXRvcmlhbHMvYmxvYi9tYXN0ZXIvdHJhbnNmb3JtLmpzXG4qL1xuXG5mdW5jdGlvbiBtYXRyaXgyZChpbml0KSB7XG4gIGxldCBtO1xuXG4gIGNvbnN0IHNlbGYgPSB7XG4gICAgcmVzZXQsXG4gICAgbXVsdGlwbHksXG4gICAgaW52ZXJ0LFxuICAgIHJvdGF0ZSxcbiAgICB0cmFuc2xhdGUsXG4gICAgc2NhbGUsXG4gICAgcHJvamVjdCxcbiAgICBjbG9uZSxcbiAgICBhcHBseVxuICB9O1xuXG4gIHJldHVybiByZXNldChpbml0KTtcblxuICBmdW5jdGlvbiByZXNldChpbml0ID0gWzEsIDAsIDAsIDEsIDAsIDBdKSB7XG4gICAgbSA9IFsuLi5pbml0XTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb25lKCkge1xuICAgIHJldHVybiBtYXRyaXgyZChtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG11bHRpcGx5KG1hdHJpeCkge1xuICAgIGNvbnN0IG0xMSA9IG1bMF0gKiBtYXRyaXhbMF0gKyBtWzJdICogbWF0cml4WzFdO1xuICAgIGNvbnN0IG0xMiA9IG1bMV0gKiBtYXRyaXhbMF0gKyBtWzNdICogbWF0cml4WzFdO1xuXG4gICAgY29uc3QgbTIxID0gbVswXSAqIG1hdHJpeFsyXSArIG1bMl0gKiBtYXRyaXhbM107XG4gICAgY29uc3QgbTIyID0gbVsxXSAqIG1hdHJpeFsyXSArIG1bM10gKiBtYXRyaXhbM107XG5cbiAgICBjb25zdCBkeCA9IG1bMF0gKiBtYXRyaXhbNF0gKyBtWzJdICogbWF0cml4WzVdICsgbVs0XTtcbiAgICBjb25zdCBkeSA9IG1bMV0gKiBtYXRyaXhbNF0gKyBtWzNdICogbWF0cml4WzVdICsgbVs1XTtcblxuICAgIG1bMF0gPSBtMTE7XG4gICAgbVsxXSA9IG0xMjtcbiAgICBtWzJdID0gbTIxO1xuICAgIG1bM10gPSBtMjI7XG4gICAgbVs0XSA9IGR4O1xuICAgIG1bNV0gPSBkeTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gaW52ZXJ0KCkge1xuICAgIGNvbnN0IGQgPSAxIC8gKG1bMF0gKiBtWzNdIC0gbVsxXSAqIG1bMl0pO1xuICAgIGNvbnN0IG0wID0gbVszXSAqIGQ7XG4gICAgY29uc3QgbTEgPSAtbVsxXSAqIGQ7XG4gICAgY29uc3QgbTIgPSAtbVsyXSAqIGQ7XG4gICAgY29uc3QgbTMgPSBtWzBdICogZDtcbiAgICBjb25zdCBtNCA9IGQgKiAobVsyXSAqIG1bNV0gLSBtWzNdICogbVs0XSk7XG4gICAgY29uc3QgbTUgPSBkICogKG1bMV0gKiBtWzRdIC0gbVswXSAqIG1bNV0pO1xuXG4gICAgbVswXSA9IG0wO1xuICAgIG1bMV0gPSBtMTtcbiAgICBtWzJdID0gbTI7XG4gICAgbVszXSA9IG0zO1xuICAgIG1bNF0gPSBtNDtcbiAgICBtWzVdID0gbTU7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJvdGF0ZShyYWQpIHtcbiAgICBjb25zdCBjID0gTWF0aC5jb3MocmFkKTtcbiAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkKTtcblxuICAgIGNvbnN0IG0xMSA9IG1bMF0gKiBjICsgbVsyXSAqIHM7XG4gICAgY29uc3QgbTEyID0gbVsxXSAqIGMgKyBtWzNdICogcztcbiAgICBjb25zdCBtMjEgPSBtWzBdICogLXMgKyBtWzJdICogYztcbiAgICBjb25zdCBtMjIgPSBtWzFdICogLXMgKyBtWzNdICogYztcblxuICAgIG1bMF0gPSBtMTE7XG4gICAgbVsxXSA9IG0xMjtcbiAgICBtWzJdID0gbTIxO1xuICAgIG1bM10gPSBtMjI7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFuc2xhdGUoeCwgeSkge1xuICAgIG1bNF0gKz0gbVswXSAqIHggKyBtWzJdICogeTtcbiAgICBtWzVdICs9IG1bMV0gKiB4ICsgbVszXSAqIHk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBzY2FsZShzeCwgc3kpIHtcbiAgICBtWzBdICo9IHN4O1xuICAgIG1bMV0gKj0gc3g7XG4gICAgbVsyXSAqPSBzeTtcbiAgICBtWzNdICo9IHN5O1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdChbeCwgeV0pIHtcbiAgICByZXR1cm4gW1xuICAgICAgeCAqIG1bMF0gKyB5ICogbVsyXSArIG1bNF0sXG4gICAgICB4ICogbVsxXSArIHkgKiBtWzNdICsgbVs1XVxuICAgIF07XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseShjdHgpIHtcbiAgICBjdHguc2V0VHJhbnNmb3JtKC4uLm0pO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2FsdHBybycpO1xuIl19
