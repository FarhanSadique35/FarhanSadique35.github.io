const portraitVertex = `
  attribute vec3 aPoint;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform vec2 uResolution;
  uniform vec3 uFrame;
  uniform float uTime, uProgress, uPointer, uDpr;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float progress = smoothstep(.02, .8, uProgress);
    float turn = .035 * uPointer;
    vec2 origin = vec2(aPoint.x * cos(turn) + aPoint.z * sin(turn), aPoint.y);
    vec2 scattered = vec2((aSeed - .5) * 2.45, sin(aSeed * 25.13) * .055 + floor(aPoint.x * 4. + .5) * .16);
    vec2 position = mix(origin, scattered, progress);
    position.x += sin(uTime * .3 + aSeed * 40.) * .008 * (smoothstep(.18, .5, abs(origin.x)) + progress);
    vec2 pixel = vec2(uFrame.x + position.x * uFrame.z, uFrame.y - position.y * uFrame.z);
    gl_Position = vec4(pixel.x / uResolution.x * 2. - 1., 1. - pixel.y / uResolution.y * 2., 0., 1.);
    gl_PointSize = (1.05 + aColor.r * 1.1) * uDpr;
    vColor = mix(aColor, vec3(1., .43, .18), progress * .57);
    vOpacity = (1. - progress * .53) * (1. - smoothstep(.28, .5, abs(origin.y)));
  }
`;

const touchInput = matchMedia('(pointer: coarse)');

function renderScale(width, height, limit, pixelBudget) {
  return Math.min(devicePixelRatio, limit, Math.sqrt(pixelBudget / (width * height)));
}

const portraitFragment = `
  precision mediump float;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float alpha = (1. - smoothstep(.23, .5, length(gl_PointCoord - .5))) * vOpacity;
    if (alpha < .025) discard;
    gl_FragColor = vec4(vColor * 1.22, alpha);
  }
`;

const shapeVertex = `
  attribute vec3 aStructure, aRipples, aConstellation;
  uniform vec3 uWeights;
  uniform vec2 uPointer;
  uniform float uTime, uPulse, uAspect, uDistance, uDpr;
  varying float vGlow;
  void main() {
    vec3 point = aStructure * uWeights.x + aRipples * uWeights.y + aConstellation * uWeights.z;
    float distanceToPointer = distance(point.xy, uPointer);
    float wave = sin(length(point.xy) * 9. - uTime * 2.5);
    point.z += wave * (.06 + .2 * uWeights.y);
    point.xy += normalize(point.xy + vec2(.001)) * sin(distanceToPointer * 7. - uTime * 4.) * exp(-distanceToPointer * 1.5) * .16;
    point *= 1. + uPulse * .08;
    float turn = .18 * sin(uTime * .15);
    point.xz = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * point.xz;
    float depth = uDistance - point.z;
    float zoom = 2.747 / depth;
    gl_Position = vec4(point.x * zoom / uAspect, point.y * zoom + .065, 0., 1.);
    gl_PointSize = clamp(13. / depth, 1., 4.) * uDpr;
    vGlow = .45 + .4 * exp(-distanceToPointer * 2.) + .15 * wave;
  }
`;

const shapeFragment = `
  precision mediump float;
  varying float vGlow;
  void main() {
    float radius = length(gl_PointCoord - .5);
    if (radius > .5) discard;
    vec3 color = mix(vec3(.68, .65, .59), vec3(1., .48, .22), smoothstep(.45, .9, vGlow));
    gl_FragColor = vec4(color, (1. - smoothstep(.1, .5, radius)) * .85);
  }
`;

function createRenderer(canvas, vertex, fragment, additive = false) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL is unavailable');

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  for (const shader of shaders) gl.deleteShader(shader);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const buffers = new Map();
  return {
    gl,
    attribute(name, data, size) {
      const location = gl.getAttribLocation(program, name);
      if (!buffers.has(name)) buffers.set(name, gl.createBuffer());
      const buffer = buffers.get(name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    },
    uniforms(names) {
      return Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    },
    draw(count, width, height, dpr) {
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    },
  };
}

function observeScene(host, canvas, build, fps = 60) {
  let enabled = false;
  let visible = false;
  let failed = false;
  let loading = false;
  let draw;
  let frame = 0;
  let previous = 0;

  function fallback() {
    failed = true;
    canvas.hidden = true;
    host.classList.remove('is-live');
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function render(time) {
    frame = 0;
    if (!enabled || !visible || document.hidden || failed) return;
    const interval = 1000 / (touchInput.matches ? Math.min(fps, 36) : fps);
    const elapsed = time - previous;
    if (elapsed + 1 >= interval) {
      try {
        draw(time / 1000, Math.min(elapsed / 1000, .06));
        if (!host.classList.contains('is-live')) host.classList.add('is-live');
        previous = time - elapsed % interval;
      } catch {
        fallback();
        return;
      }
    }
    frame = requestAnimationFrame(render);
  }

  async function refresh() {
    if (!enabled || !visible || document.hidden || failed) {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!enabled) {
        canvas.hidden = true;
        host.classList.remove('is-live');
      }
      return;
    }
    if (!draw && !loading) {
      loading = true;
      try { draw = await build(); }
      catch { fallback(); }
      finally { loading = false; }
    }
    if (!draw || !enabled || !visible || document.hidden || failed || frame) return;
    canvas.hidden = false;
    previous = 0;
    frame = requestAnimationFrame(render);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  observer.observe(host);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    draw = undefined;
    fallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    failed = false;
    refresh();
  });
  document.addEventListener('visibilitychange', refresh);
  return value => { enabled = value; refresh(); };
}

function samplePortrait(image, width) {
  const sample = document.createElement('canvas');
  const height = Math.round(width * image.naturalHeight / image.naturalWidth);
  sample.width = width;
  sample.height = height;
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const points = [];
  const colors = [];
  const seeds = [];
  const ratio = width / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = data[offset] / 255;
      const green = data[offset + 1] / 255;
      const blue = data[offset + 2] / 255;
      const luma = red * .299 + green * .587 + blue * .114;
      if (luma < .074) continue;
      const light = Math.max(0, (luma - .044) / .956);
      points.push((x / width - .5) * ratio, .5 - y / height, .025 * light);
      colors.push(light * 1.05, light, light * .96);
      seeds.push((127 * x + 311 * y) % 997 / 997);
    }
  }
  return { points: new Float32Array(points), colors: new Float32Array(colors), seeds: new Float32Array(seeds) };
}

export function portraitScene(host, narrative) {
  const canvas = host.querySelector('canvas');
  const image = host.querySelector('img');
  let width, height, portraitWidth, portraitHeight, portraitTop, portraitCenter;
  const measure = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    portraitWidth = image.offsetWidth;
    portraitHeight = image.offsetHeight;
    portraitTop = image.offsetTop;
    portraitCenter = image.offsetLeft;
  };
  const resize = new ResizeObserver(measure);
  resize.observe(host);
  resize.observe(image);

  return observeScene(host, canvas, async () => {
    await image.decode();
    const renderer = createRenderer(canvas, portraitVertex, portraitFragment);
    const { gl } = renderer;
    const uniforms = renderer.uniforms(['uResolution', 'uFrame', 'uTime', 'uProgress', 'uPointer', 'uDpr']);
    let sampleWidth;
    let count = 0;
    let progress = narrative.progress;
    let pointer = narrative.pointer;
    measure();
    return (time, delta) => {
      if (!width || !height || !portraitHeight) return;
      const target = portraitWidth <= 295 ? 160 : portraitWidth <= 420 ? 220 : 300;
      if (sampleWidth !== target) {
        const { points, colors, seeds } = samplePortrait(image, target);
        renderer.attribute('aPoint', points, 3);
        renderer.attribute('aColor', colors, 3);
        renderer.attribute('aSeed', seeds, 1);
        count = seeds.length;
        sampleWidth = target;
      }
      const smoothing = 1 - Math.exp(-3 * delta);
      progress += (narrative.progress - progress) * smoothing;
      pointer += (narrative.pointer - pointer) * smoothing;
      const dpr = renderScale(width, height, touchInput.matches ? 1.2 : 1.5, 4_000_000);
      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform3f(uniforms.uFrame, portraitCenter, portraitTop + portraitHeight / 2, portraitHeight);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uProgress, progress);
      gl.uniform1f(uniforms.uPointer, pointer);
      gl.uniform1f(uniforms.uDpr, dpr);
      renderer.draw(count, width, height, dpr);
    };
  });
}

const shapeCount = 2400;
function shapeGeometry() {
  const structure = new Float32Array(shapeCount * 3);
  const ripples = new Float32Array(shapeCount * 3);
  const constellation = new Float32Array(shapeCount * 3);
  for (let point = 0; point < shapeCount; point += 1) {
    const x = (point % 60) / 59;
    const y = Math.floor(point / 60) / 39;
    structure.set([(x - .5) * 3, (y - .5) * 2.8, .12 * Math.sin(18 * x)], point * 3);
    const angle = x * 2 * Math.PI;
    const radius = .2 + 1.5 * y;
    ripples.set([Math.cos(angle) * radius, Math.sin(angle) * radius, .2 * Math.sin(8 * radius)], point * 3);
    const height = 1 - 2 * point / (shapeCount - 1);
    const spiral = 2.399963 * point;
    const ring = Math.sqrt(1 - height * height) * 1.6;
    constellation.set([Math.cos(spiral) * ring, height * 1.6, Math.sin(spiral) * ring], point * 3);
  }
  return { structure, ripples, constellation };
}

export function shapeScene(host, state, distance) {
  const canvas = host.querySelector('canvas');
  let width, height;
  const measure = () => { width = host.clientWidth; height = host.clientHeight; };
  new ResizeObserver(measure).observe(host);
  let pointerX = 4;
  let pointerY = 4;
  host.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    const span = 2 * distance / 2.747;
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * span * rect.width / rect.height;
    pointerY = (.5 - (event.clientY - rect.top) / rect.height) * span;
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointerX = 4; pointerY = 4; });
  return observeScene(host, canvas, () => {
    const renderer = createRenderer(canvas, shapeVertex, shapeFragment, true);
    const { gl } = renderer;
    const { structure, ripples, constellation } = shapeGeometry();
    renderer.attribute('aStructure', structure, 3);
    renderer.attribute('aRipples', ripples, 3);
    renderer.attribute('aConstellation', constellation, 3);
    const uniforms = renderer.uniforms(['uWeights', 'uPointer', 'uTime', 'uPulse', 'uAspect', 'uDistance', 'uDpr']);
    const weights = [0, 0, 0];
    weights[state.selected] = 1;
    let pulse = 0;
    measure();
    return time => {
      if (!width || !height) return;
      for (let index = 0; index < weights.length; index += 1) {
        weights[index] += (Number(index === state.selected) - weights[index]) * .065;
      }
      pulse += (state.pulse - pulse) * .13;
      state.pulse *= .93;
      const dpr = renderScale(width, height, touchInput.matches ? 1.15 : 1.25, 900_000);
      gl.uniform3fv(uniforms.uWeights, weights);
      gl.uniform2f(uniforms.uPointer, pointerX, pointerY);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uPulse, pulse);
      gl.uniform1f(uniforms.uAspect, width / height);
      gl.uniform1f(uniforms.uDistance, distance);
      gl.uniform1f(uniforms.uDpr, dpr);
      renderer.draw(shapeCount, width, height, dpr);
    };
  }, 30);
}
