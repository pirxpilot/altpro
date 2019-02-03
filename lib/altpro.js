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