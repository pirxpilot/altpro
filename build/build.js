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

function createCanvas(parent) {

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
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  parent.appendChild(wrapper);

  const { clientWidth: w, clientHeight: h } = wrapper;
  const bg = canvas(wrapper, w, h);
  const fg = canvas(wrapper, w, h);

  return { bg, fg, w, h };
}

function altpro(parent, data, opts = {}) {
  const {
    fill = 'chartreuse',
    stroke = 'black',
    selectedFill = 'orange'
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

  const { bg, fg, w, h } = createCanvas(parent);

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
    clear(fgCtx, { w, h });
    drawSelected(fgCtx, items[index - 1], items[index]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYWx0cHJvLmpzIiwibGliL21hdHJpeDJkLmpzIiwiaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IG1hdHJpeDJkID0gcmVxdWlyZSgnLi9tYXRyaXgyZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFsdHBybztcblxuZnVuY3Rpb24gcHJlcGFyZShkYXRhKSB7XG4gIHJldHVybiBkYXRhLnJlZHVjZSgociwgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0pID0+IHtcbiAgICBpZiAoZWxldmF0aW9uIDwgci5taW5FbGV2YXRpb24pIHtcbiAgICAgIHIubWluRWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICBpZiAoZWxldmF0aW9uID4gci5tYXhFbGV2YXRpb24pIHtcbiAgICAgIHIubWF4RWxldmF0aW9uID0gZWxldmF0aW9uO1xuICAgIH1cbiAgICByLnRvdGFsRGlzdGFuY2UgKz0gZGlzdGFuY2U7XG4gICAgci5pdGVtcy5wdXNoKHsgZWxldmF0aW9uLCBkaXN0YW5jZTogci50b3RhbERpc3RhbmNlIH0pO1xuICAgIHJldHVybiByO1xuICB9LCB7XG4gICAgaXRlbXM6IFtdLFxuICAgIHRvdGFsRGlzdGFuY2U6IDAsXG4gICAgbWluRWxldmF0aW9uOiAwLFxuICAgIG1heEVsZXZhdGlvbjogMFxuICB9KTtcbn1cblxuZnVuY3Rpb24gaW5pdE1hdHJpeCh7IHcsIGggfSwgeyB4LCB5LCBtaW4gfSkge1xuICBjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IDA7XG4gIGNvbnN0IHZlcnRpY2FsUGFkZGluZyA9IDE1O1xuXG4gIHcgLT0gMiAqIGhvcml6b250YWxQYWRkaW5nO1xuICBoIC09IDIgKiB2ZXJ0aWNhbFBhZGRpbmc7XG5cbiAgY29uc3QgaG9yaXpvbnRhbFNjYWxpbmcgPSB3IC8geDtcbiAgY29uc3QgdmVydGljYWxTY2FsaW5nID0gaCAvIHk7XG5cbiAgcmV0dXJuIG1hdHJpeDJkKClcbiAgICAudHJhbnNsYXRlKGhvcml6b250YWxQYWRkaW5nLCB2ZXJ0aWNhbFBhZGRpbmcpXG4gICAgLnNjYWxlKGhvcml6b250YWxTY2FsaW5nLCAtdmVydGljYWxTY2FsaW5nKVxuICAgIC50cmFuc2xhdGUoMCwgLSh5ICsgbWluKSk7XG59XG5cbmZ1bmN0aW9uIGRyYXdQYXRoKGN0eCwgaXRlbXMpIHtcbiAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gIGNvbnN0IGZpcnN0ID0gaXRlbXNbMF07XG4gIGNvbnN0IGxhc3QgPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcblxuICBjdHgubW92ZVRvKDAsIGZpcnN0LmVsZXZhdGlvbik7XG5cbiAgZm9yKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgeyBlbGV2YXRpb24sIGRpc3RhbmNlIH0gPSBpdGVtc1tpXTtcbiAgICBjdHgubGluZVRvKGRpc3RhbmNlLCBlbGV2YXRpb24pO1xuICB9XG5cbiAgY3R4LnN0cm9rZSgpO1xuXG4gIGN0eC5saW5lVG8obGFzdC5kaXN0YW5jZSwgMCk7XG4gIGN0eC5saW5lVG8oMCwgMCk7XG5cbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBkcmF3U2VsZWN0ZWQoY3R4LCB7IGRpc3RhbmNlOiBkMSwgZWxldmF0aW9uOiBlMSB9LCB7IGRpc3RhbmNlOiBkMiwgZWxldmF0aW9uOiBlMiB9KSB7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4Lm1vdmVUbyhkMSwgMCk7XG4gIGN0eC5saW5lVG8oZDEsIGUxKTtcbiAgY3R4LmxpbmVUbyhkMiwgZTIpO1xuICBjdHgubGluZVRvKGQyLCAwKTtcbiAgY3R4LmNsb3NlUGF0aCgpO1xuICBjdHguZmlsbCgpO1xufVxuXG5mdW5jdGlvbiBjbGVhcihjdHgsIHsgdywgaCB9KSB7XG4gIGN0eC5zYXZlKCk7XG4gIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG4gIGN0eC5yZXN0b3JlKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNhbnZhcyhwYXJlbnQpIHtcblxuICBmdW5jdGlvbiBjYW52YXMod3JhcHBlciwgdywgaCkge1xuICAgIGNvbnN0IGMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBjLnN0eWxlLmxlZnQgPSAwO1xuICAgIGMuc3R5bGUuaGVpZ2h0ID0gMDtcbiAgICBjLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGMuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgIGMud2lkdGggPSB3O1xuICAgIGMuaGVpZ2h0ID0gaDtcbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGMpO1xuICAgIHJldHVybiBjO1xuICB9XG5cbiAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgd3JhcHBlci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgd3JhcHBlci5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh3cmFwcGVyKTtcblxuICBjb25zdCB7IGNsaWVudFdpZHRoOiB3LCBjbGllbnRIZWlnaHQ6IGggfSA9IHdyYXBwZXI7XG4gIGNvbnN0IGJnID0gY2FudmFzKHdyYXBwZXIsIHcsIGgpO1xuICBjb25zdCBmZyA9IGNhbnZhcyh3cmFwcGVyLCB3LCBoKTtcblxuICByZXR1cm4geyBiZywgZmcsIHcsIGggfTtcbn1cblxuZnVuY3Rpb24gYWx0cHJvKHBhcmVudCwgZGF0YSwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IHtcbiAgICBmaWxsID0gJ2NoYXJ0cmV1c2UnLFxuICAgIHN0cm9rZSA9ICdibGFjaycsXG4gICAgc2VsZWN0ZWRGaWxsID0gJ29yYW5nZSdcbiAgfSA9IG9wdHM7XG4gIGNvbnN0IHtcbiAgICBtaW5FbGV2YXRpb24sXG4gICAgbWF4RWxldmF0aW9uLFxuICAgIHRvdGFsRGlzdGFuY2UsXG4gICAgaXRlbXNcbiAgfSA9IHByZXBhcmUoZGF0YSk7XG5cbiAgY29uc3QgZXh0ZW50ID0ge1xuICAgIHg6IHRvdGFsRGlzdGFuY2UsXG4gICAgeTogbWF4RWxldmF0aW9uIC0gbWluRWxldmF0aW9uLFxuICAgIG1pbjogbWluRWxldmF0aW9uXG4gIH07XG5cbiAgY29uc3QgeyBiZywgZmcsIHcsIGggfSA9IGNyZWF0ZUNhbnZhcyhwYXJlbnQpO1xuXG4gIGNvbnN0IGN0eCA9IGJnLmdldENvbnRleHQoJzJkJyk7XG4gIGN0eC5zdHJva2VTdHlsZSA9IHN0cm9rZTtcbiAgY3R4LmZpbGxTdHlsZSA9IGZpbGw7XG5cbiAgY29uc3QgdHJhbnNmb3JtTWF0cmljID0gaW5pdE1hdHJpeCh7IHcsIGggfSwgZXh0ZW50KTtcbiAgY29uc3QgaW52ZXJ0ZWRNYXRyaXggPSB0cmFuc2Zvcm1NYXRyaWMuY2xvbmUoKS5pbnZlcnQoKTtcbiAgdHJhbnNmb3JtTWF0cmljLmFwcGx5KGN0eCk7XG4gIGRyYXdQYXRoKGN0eCwgaXRlbXMpO1xuXG4gIGNvbnN0IGZnQ3R4ID0gZmcuZ2V0Q29udGV4dCgnMmQnKTtcbiAgZmdDdHguZmlsbFN0eWxlID0gc2VsZWN0ZWRGaWxsO1xuICBmZ0N0eC5saW5lV2lkdGggPSAzO1xuICB0cmFuc2Zvcm1NYXRyaWMuYXBwbHkoZmdDdHgpO1xuXG4gIGZnLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9ubW91c2Vtb3ZlKTtcbiAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZXZlJywgb25tb3VzZWxlYXZlKTtcblxuICByZXR1cm4ge1xuICAgIHNlbGVjdCxcbiAgICBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICBmZy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbm1vdXNlbW92ZSk7XG4gICAgZmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZXZlJywgb25tb3VzZWxlYXZlKTtcbiAgICBwYXJlbnQuaW5uZXJIVE1MID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBvbm1vdXNlbW92ZSh7IGNsaWVudFgsIGNsaWVudFksIHRhcmdldCB9KSB7XG4gICAgY29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBsZXQgaW5kZXggPSBpdGVtSW5kZXhGcm9tUG9pbnQoW1xuICAgICAgY2xpZW50WCAtIHJlY3QubGVmdCxcbiAgICAgIGNsaWVudFkgLSByZWN0LnRvcFxuICAgIF0pO1xuICAgIHNlbGVjdChpbmRleCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbm1vdXNlbGVhdmUoKSB7XG4gICAgY2xlYXIoZmdDdHgsIHsgdywgaCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGl0ZW1JbmRleEZyb21Qb2ludChwb2ludCkge1xuICAgIGNvbnN0IFsgZGlzdGFuY2UgXSA9IHVucHJvamVjdChwb2ludCk7XG4gICAgcmV0dXJuIGl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGRpc3RhbmNlIDwgaXRlbS5kaXN0YW5jZSk7XG4gIH1cblxuICBmdW5jdGlvbiB1bnByb2plY3QocG9pbnQpIHtcbiAgICByZXR1cm4gaW52ZXJ0ZWRNYXRyaXgucHJvamVjdChwb2ludCk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3QoaW5kZXgpIHtcbiAgICBpZiAoaW5kZXggPCAxIHx8IGluZGV4ID49IGl0ZW1zLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjbGVhcihmZ0N0eCwgeyB3LCBoIH0pO1xuICAgIGRyYXdTZWxlY3RlZChmZ0N0eCwgaXRlbXNbaW5kZXggLSAxXSwgaXRlbXNbaW5kZXhdKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBtYXRyaXgyZDtcblxuLypcbkJhc2VkIG9uOiBodHRwczovL2dpdGh1Yi5jb20vc2ltb25zYXJyaXMvQ2FudmFzLXR1dG9yaWFscy9ibG9iL21hc3Rlci90cmFuc2Zvcm0uanNcbiovXG5cbmZ1bmN0aW9uIG1hdHJpeDJkKGluaXQpIHtcbiAgbGV0IG07XG5cbiAgY29uc3Qgc2VsZiA9IHtcbiAgICByZXNldCxcbiAgICBtdWx0aXBseSxcbiAgICBpbnZlcnQsXG4gICAgcm90YXRlLFxuICAgIHRyYW5zbGF0ZSxcbiAgICBzY2FsZSxcbiAgICBwcm9qZWN0LFxuICAgIGNsb25lLFxuICAgIGFwcGx5XG4gIH07XG5cbiAgcmV0dXJuIHJlc2V0KGluaXQpO1xuXG4gIGZ1bmN0aW9uIHJlc2V0KGluaXQgPSBbMSwgMCwgMCwgMSwgMCwgMF0pIHtcbiAgICBtID0gWy4uLmluaXRdO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xvbmUoKSB7XG4gICAgcmV0dXJuIG1hdHJpeDJkKG0pO1xuICB9XG5cbiAgZnVuY3Rpb24gbXVsdGlwbHkobWF0cml4KSB7XG4gICAgY29uc3QgbTExID0gbVswXSAqIG1hdHJpeFswXSArIG1bMl0gKiBtYXRyaXhbMV07XG4gICAgY29uc3QgbTEyID0gbVsxXSAqIG1hdHJpeFswXSArIG1bM10gKiBtYXRyaXhbMV07XG5cbiAgICBjb25zdCBtMjEgPSBtWzBdICogbWF0cml4WzJdICsgbVsyXSAqIG1hdHJpeFszXTtcbiAgICBjb25zdCBtMjIgPSBtWzFdICogbWF0cml4WzJdICsgbVszXSAqIG1hdHJpeFszXTtcblxuICAgIGNvbnN0IGR4ID0gbVswXSAqIG1hdHJpeFs0XSArIG1bMl0gKiBtYXRyaXhbNV0gKyBtWzRdO1xuICAgIGNvbnN0IGR5ID0gbVsxXSAqIG1hdHJpeFs0XSArIG1bM10gKiBtYXRyaXhbNV0gKyBtWzVdO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICBtWzRdID0gZHg7XG4gICAgbVs1XSA9IGR5O1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBpbnZlcnQoKSB7XG4gICAgY29uc3QgZCA9IDEgLyAobVswXSAqIG1bM10gLSBtWzFdICogbVsyXSk7XG4gICAgY29uc3QgbTAgPSBtWzNdICogZDtcbiAgICBjb25zdCBtMSA9IC1tWzFdICogZDtcbiAgICBjb25zdCBtMiA9IC1tWzJdICogZDtcbiAgICBjb25zdCBtMyA9IG1bMF0gKiBkO1xuICAgIGNvbnN0IG00ID0gZCAqIChtWzJdICogbVs1XSAtIG1bM10gKiBtWzRdKTtcbiAgICBjb25zdCBtNSA9IGQgKiAobVsxXSAqIG1bNF0gLSBtWzBdICogbVs1XSk7XG5cbiAgICBtWzBdID0gbTA7XG4gICAgbVsxXSA9IG0xO1xuICAgIG1bMl0gPSBtMjtcbiAgICBtWzNdID0gbTM7XG4gICAgbVs0XSA9IG00O1xuICAgIG1bNV0gPSBtNTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgZnVuY3Rpb24gcm90YXRlKHJhZCkge1xuICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhyYWQpO1xuICAgIGNvbnN0IHMgPSBNYXRoLnNpbihyYWQpO1xuXG4gICAgY29uc3QgbTExID0gbVswXSAqIGMgKyBtWzJdICogcztcbiAgICBjb25zdCBtMTIgPSBtWzFdICogYyArIG1bM10gKiBzO1xuICAgIGNvbnN0IG0yMSA9IG1bMF0gKiAtcyArIG1bMl0gKiBjO1xuICAgIGNvbnN0IG0yMiA9IG1bMV0gKiAtcyArIG1bM10gKiBjO1xuXG4gICAgbVswXSA9IG0xMTtcbiAgICBtWzFdID0gbTEyO1xuICAgIG1bMl0gPSBtMjE7XG4gICAgbVszXSA9IG0yMjtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zbGF0ZSh4LCB5KSB7XG4gICAgbVs0XSArPSBtWzBdICogeCArIG1bMl0gKiB5O1xuICAgIG1bNV0gKz0gbVsxXSAqIHggKyBtWzNdICogeTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNjYWxlKHN4LCBzeSkge1xuICAgIG1bMF0gKj0gc3g7XG4gICAgbVsxXSAqPSBzeDtcbiAgICBtWzJdICo9IHN5O1xuICAgIG1bM10gKj0gc3k7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0KFt4LCB5XSkge1xuICAgIHJldHVybiBbXG4gICAgICB4ICogbVswXSArIHkgKiBtWzJdICsgbVs0XSxcbiAgICAgIHggKiBtWzFdICsgeSAqIG1bM10gKyBtWzVdXG4gICAgXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5KGN0eCkge1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oLi4ubSk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvYWx0cHJvJyk7XG4iXX0=
