var altpro = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/binary-search/index.js
  var require_binary_search = __commonJS({
    "node_modules/binary-search/index.js"(exports, module) {
      module.exports = function(haystack, needle, comparator2, low, high) {
        var mid, cmp;
        if (low === void 0)
          low = 0;
        else {
          low = low | 0;
          if (low < 0 || low >= haystack.length)
            throw new RangeError("invalid lower bound");
        }
        if (high === void 0)
          high = haystack.length - 1;
        else {
          high = high | 0;
          if (high < low || high >= haystack.length)
            throw new RangeError("invalid upper bound");
        }
        while (low <= high) {
          mid = low + (high - low >>> 1);
          cmp = +comparator2(haystack[mid], needle, mid, haystack);
          if (cmp < 0)
            low = mid + 1;
          else if (cmp > 0)
            high = mid - 1;
          else
            return mid;
        }
        return ~low;
      };
    }
  });

  // lib/altpro.js
  var altpro_exports = {};
  __export(altpro_exports, {
    default: () => altpro
  });

  // lib/find-segment.js
  var import_binary_search = __toESM(require_binary_search(), 1);
  function comparator(item, distance, i, items) {
    if (distance > item.distance) return -1;
    const prevDistance = i > 0 ? items[i - 1].distance : 0;
    if (distance <= prevDistance) return 1;
    return 0;
  }
  function findSegment(items, distance) {
    if (distance === 0) return 1;
    return (0, import_binary_search.default)(items, distance, comparator);
  }

  // lib/matrix2d.js
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
    function reset(init2 = [1, 0, 0, 1, 0, 0]) {
      m = [...init2];
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
      return [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];
    }
    function apply(ctx) {
      ctx.setTransform(...m);
      return self;
    }
  }

  // lib/altpro.js
  var raf = window.requestAnimationFrame || ((fn) => fn() || false);
  function prepare(data) {
    return data.reduce(
      (r, { elevation, distance }) => {
        if (elevation < r.minElevation) {
          r.minElevation = elevation;
        }
        if (elevation > r.maxElevation) {
          r.maxElevation = elevation;
        }
        r.totalDistance += distance;
        r.items.push({ elevation, distance: r.totalDistance });
        return r;
      },
      {
        items: [],
        totalDistance: 0,
        minElevation: Number.MAX_VALUE,
        maxElevation: 0
      }
    );
  }
  function initMatrix({ w, h }, { x, y, min }, dpr) {
    const horizontalPadding = 0;
    const verticalPadding = 15;
    w -= 2 * horizontalPadding;
    h -= 2 * verticalPadding;
    const horizontalScaling = w / x;
    const verticalScaling = h / y;
    return matrix2d().scale(dpr, dpr).translate(horizontalPadding, verticalPadding).scale(horizontalScaling, -verticalScaling).translate(0, -(y + min));
  }
  function drawPath(ctx, items, ref) {
    ctx.beginPath();
    const first = items[0];
    const last = items[items.length - 1];
    ctx.moveTo(0, first.elevation === void 0 ? 0 : first.elevation - ref);
    for (let i = 1; i < items.length; i++) {
      const { elevation, distance } = items[i];
      if (elevation !== void 0) {
        ctx.lineTo(distance, elevation - ref);
      }
    }
    if (last.elevation === void 0) {
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
    if (e1 !== void 0) {
      ctx.lineTo(d1, e1 - ref);
    }
    if (e2 !== void 0) {
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
    function canvas(wrapper2, w2, h2, dpr2) {
      const c = document.createElement("canvas");
      c.style.position = "absolute";
      c.style.left = 0;
      c.style.height = 0;
      c.style.width = "100%";
      c.style.height = "100%";
      c.width = w2 * dpr2;
      c.height = h2 * dpr2;
      wrapper2.appendChild(c);
      return c;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "altpro-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    parent.appendChild(wrapper);
    const { clientWidth: w, clientHeight: h } = wrapper;
    const dpr = window.devicePixelRatio || 1;
    const bg = canvas(wrapper, w, h, dpr);
    const fg = canvas(wrapper, w, h, dpr);
    if (!label) {
      label = document.createElement("div");
      label.className = "altpro-label";
      wrapper.appendChild(label);
    }
    return { bg, fg, label, w, h, dpr };
  }
  function altpro(parent, data, opts = {}) {
    let { fill = "chartreuse", stroke = "black", selectedFill = "orange", unit = "m" } = opts;
    const { minElevation, maxElevation, totalDistance, items } = prepare(data);
    const ref = minElevation < 0 ? 0 : minElevation - 0.05 * (maxElevation - minElevation);
    const extent = {
      x: totalDistance,
      y: maxElevation - Math.min(minElevation, ref),
      min: Math.min(minElevation, 0)
    };
    const { bg, fg, label, w, h, dpr } = create(parent, opts.label);
    const ctx = bg.getContext("2d");
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    const transformMatric = initMatrix({ w, h }, extent, dpr);
    const invertedMatrix = transformMatric.clone().invert();
    transformMatric.apply(ctx);
    drawPath(ctx, items, ref);
    const fgCtx = fg.getContext("2d");
    fgCtx.fillStyle = selectedFill;
    fgCtx.lineWidth = 3;
    transformMatric.apply(fgCtx);
    fg.addEventListener("mousemove", onmousemove);
    fg.addEventListener("mouseleave", onmouseleave);
    let selectedIndex = -1;
    let animationFrame;
    return {
      select,
      option,
      destroy
    };
    function option(key, value) {
      if (value === void 0) {
        return opts[key];
      }
      opts[key] = value;
      if (key === "unit") {
        unit = opts.unit;
        if (selectedIndex !== -1) {
          displayLabel(items[selectedIndex]);
        }
      }
    }
    function destroy() {
      fg.removeEventListener("mousemove", onmousemove);
      fg.removeEventListener("mouseleave", onmouseleave);
      parent.innerHTML = "";
    }
    function onmousemove({ clientX, clientY, target }) {
      const rect = target.getBoundingClientRect();
      const index = itemIndexFromPoint([dpr * (clientX - rect.left), dpr * (clientY - rect.top)]);
      select(index);
    }
    function onmouseleave() {
      label.hidden = true;
      clear(fgCtx, { w, h }, dpr);
      parent.dispatchEvent(new CustomEvent("altpro-select", {}));
    }
    function itemIndexFromPoint(point) {
      const [distance] = unproject(point);
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
      animationFrame = void 0;
      clear(fgCtx, { w, h }, dpr);
      drawSelected(fgCtx, items[selectedIndex - 1], items[selectedIndex], ref);
      displayLabel(items[selectedIndex]);
      notify(selectedIndex);
    }
    function calcElevation(elevation) {
      if (elevation === void 0) {
        return;
      }
      if (unit === "ft") {
        elevation *= 3.28084;
      }
      return Math.round(elevation);
    }
    function displayLabel({ elevation }) {
      elevation = calcElevation(elevation);
      if (elevation === void 0) {
        elevation = "";
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
      const selectEvent = new CustomEvent("altpro-select", { detail });
      parent.dispatchEvent(selectEvent);
    }
  }
  return __toCommonJS(altpro_exports);
})();
