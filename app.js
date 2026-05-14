const route = document.getElementById("route");
const pin = document.querySelector(".pin");
const mapContainer = document.querySelector(".map-container");
const feather = document.querySelector(".zoom-feather");
const screenEl = document.querySelector(".screen");
const actionButton = document.getElementById("actionButton");
const statusEl = document.getElementById("status");
const subtitleEl = document.getElementById("subtitle");
const hintEl = document.getElementById("hint");
const clockEl = document.getElementById("clock");
const topbar = document.querySelector(".topbar");
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const recenterButton = document.getElementById("recenter");

const MIN_SCALE = 1;
const MAX_SCALE = 4.25;
const START_ZOOM = 3.05;

const MAIN_STREET_PROGRESS = 0.34;
const RESERVOIR_PROGRESS = 0.7;

let currentProgress = 0;
let routeLength = 0;
let step = 0;
let driveTween;
let dragState = null;
let pinchState = null;
let mainStreetShown = false;
let reservoirShown = false;

function setClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setupRoute() {
  routeLength = route.getTotalLength();

  gsap.set(route, {
    strokeDasharray: routeLength,
    strokeDashoffset: routeLength
  });
}

function getRouteLength() {
  if (!routeLength) routeLength = route.getTotalLength();
  return routeLength;
}

function getTransform() {
  return {
    scale: Number(gsap.getProperty(mapContainer, "scale")) || 1,
    x: Number(gsap.getProperty(mapContainer, "x")) || 0,
    y: Number(gsap.getProperty(mapContainer, "y")) || 0
  };
}

function routePointToScreenPosition(point) {
  const matrix = route.getScreenCTM();
  const screenBox = screenEl.getBoundingClientRect();
  const transformedPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);

  return {
    x: transformedPoint.x - screenBox.left,
    y: transformedPoint.y - screenBox.top
  };
}

function placePinAtProgress(progress) {
  currentProgress = clamp(progress, 0, 1);

  const point = route.getPointAtLength(getRouteLength() * currentProgress);
  const position = routePointToScreenPosition(point);

  gsap.set(pin, {
    left: position.x,
    top: position.y,
    xPercent: -50,
    yPercent: -50
  });
}

function drawRouteToProgress(progress) {
  const safeProgress = clamp(progress, 0, 1);
  const length = getRouteLength();

  gsap.set(route, {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - safeProgress)
  });
}

function setRouteProgress(progress) {
  const safeProgress = clamp(progress, 0, 1);

  drawRouteToProgress(safeProgress);
  placePinAtProgress(safeProgress);
  updatePassingStatus(safeProgress);
}

function updateCard(status, subtitle, hint) {
  statusEl.textContent = status;
  subtitleEl.textContent = subtitle;
  hintEl.textContent = hint;
}

function updatePassingStatus(progress) {
  if (!mainStreetShown && progress >= MAIN_STREET_PROGRESS) {
    mainStreetShown = true;
    updateCard(
      "Past Main Street",
      "Freya has passed Main Street",
      "Live · Speed increasing · Updated now"
    );
  }

  if (!reservoirShown && progress >= RESERVOIR_PROGRESS) {
    reservoirShown = true;
    updateCard(
      "Past Reservoir",
      "Continuing along the route",
      "Live · Moving fast · Updated now"
    );
  }
}

function applyMapTransform(scale, x, y) {
  const box = screenEl.getBoundingClientRect();

  const scaledW = box.width * scale;
  const scaledH = box.height * scale;

  const minX = Math.min(0, box.width - scaledW);
  const minY = Math.min(0, box.height - scaledH);

  const safeX = scale <= 1 ? 0 : clamp(x, minX, 0);
  const safeY = scale <= 1 ? 0 : clamp(y, minY, 0);

  gsap.set(mapContainer, {
    scale,
    x: safeX,
    y: safeY,
    transformOrigin: "0 0"
  });

  placePinAtProgress(currentProgress);
}

function getUntransformedRoutePosition(progress) {
  const oldTransform = getTransform();

  gsap.set(mapContainer, {
    scale: 1,
    x: 0,
    y: 0,
    transformOrigin: "0 0"
  });

  placePinAtProgress(progress);

  const point = {
    x: parseFloat(gsap.getProperty(pin, "left")),
    y: parseFloat(gsap.getProperty(pin, "top"))
  };

  gsap.set(mapContainer, oldTransform);
  placePinAtProgress(currentProgress);

  return point;
}

function centerStartPinWithoutAnimation() {
  const point = getUntransformedRoutePosition(0);

  const x = screenEl.clientWidth / 2 - point.x * START_ZOOM;
  const y = screenEl.clientHeight / 2 + 34 - point.y * START_ZOOM;

  applyMapTransform(START_ZOOM, x, y);
}

function resetDemo() {
  gsap.killTweensOf(mapContainer);
  gsap.killTweensOf(pin);
  gsap.killTweensOf(route);

  if (driveTween) driveTween.kill();

  step = 1;
  currentProgress = 0;
  mainStreetShown = false;
  reservoirShown = false;

  setupRoute();

  gsap.set(mapContainer, {
    scale: 1,
    x: 0,
    y: 0,
    transformOrigin: "0 0"
  });

  gsap.set(pin, {
    x: 0,
    y: 0,
    xPercent: -50,
    yPercent: -50,
    scale: 1,
    opacity: 1
  });

  setRouteProgress(0);
  centerStartPinWithoutAnimation();

  updateCard(
    "The Heights",
    "Freya is at the beginning of the route",
    "Live · Pin flashing · Moving shortly"
  );

  setTimeout(startJourney, 2600);
}

function startJourney() {
  if (driveTween) driveTween.kill();

  step = 2;
  mainStreetShown = false;
  reservoirShown = false;

  updateCard(
    "Moving",
    "Leaving The Heights",
    "Live · Starting slowly · Updated now"
  );

  const tracker = { progress: currentProgress };

  driveTween = gsap.timeline({
    delay: 0.35,
    onComplete: () => {
      step = 3;
      updateCard(
        "Off-screen",
        "Freya moved off screen",
        "Live · Still moving"
      );
    }
  });

  driveTween
    .to(tracker, {
      progress: 0.22,
      duration: 5.5,
      ease: "power1.inOut",
      onUpdate: () => setRouteProgress(tracker.progress)
    })
    .to(tracker, {
      progress: 0.62,
      duration: 3.8,
      ease: "power2.in",
      onUpdate: () => setRouteProgress(tracker.progress)
    })
    .to(tracker, {
      progress: 1,
      duration: 1.9,
      ease: "power4.in",
      onUpdate: () => setRouteProgress(tracker.progress)
    });
}

function zoomAroundPoint(clientX, clientY, nextScale) {
  gsap.killTweensOf(mapContainer);

  const box = screenEl.getBoundingClientRect();
  const { scale, x, y } = getTransform();

  const localX = clientX - box.left;
  const localY = clientY - box.top;

  const mapX = (localX - x) / scale;
  const mapY = (localY - y) / scale;

  const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

  applyMapTransform(
    safeScale,
    localX - mapX * safeScale,
    localY - mapY * safeScale
  );
}

screenEl.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const { scale } = getTransform();
    const nextScale = scale * (event.deltaY > 0 ? 0.88 : 1.12);

    zoomAroundPoint(event.clientX, event.clientY, nextScale);
  },
  { passive: false }
);

screenEl.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;

  screenEl.setPointerCapture(event.pointerId);

  dragState = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    ...getTransform()
  };
});

screenEl.addEventListener("pointermove", (event) => {
  if (!dragState || dragState.id !== event.pointerId || pinchState) return;

  applyMapTransform(
    dragState.scale,
    dragState.x + event.clientX - dragState.startX,
    dragState.y + event.clientY - dragState.startY
  );
});

screenEl.addEventListener("pointerup", () => {
  dragState = null;
});

screenEl.addEventListener("pointercancel", () => {
  dragState = null;
  pinchState = null;
});

screenEl.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;

      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;

      const transform = getTransform();

      pinchState = {
        distance: Math.hypot(dx, dy),
        scale: transform.scale
      };
    }
  },
  { passive: false }
);

screenEl.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length === 2 && pinchState) {
      event.preventDefault();

      const [a, b] = event.touches;

      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;

      const distance = Math.hypot(dx, dy);

      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;

      zoomAroundPoint(
        centerX,
        centerY,
        pinchState.scale * (distance / pinchState.distance)
      );
    }
  },
  { passive: false }
);

screenEl.addEventListener("touchend", () => {
  pinchState = null;
});

topbar.addEventListener("click", () => {
  centerStartPinWithoutAnimation();
});

zoomInButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const box = screenEl.getBoundingClientRect();
  const { scale } = getTransform();

  zoomAroundPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
    scale * 1.25
  );
});

zoomOutButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const box = screenEl.getBoundingClientRect();
  const { scale } = getTransform();

  zoomAroundPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
    scale / 1.25
  );
});

recenterButton.addEventListener("click", (event) => {
  event.stopPropagation();
  centerStartPinWithoutAnimation();
});

actionButton.addEventListener("click", () => {
  if (step === 1) {
    startJourney();
  } else {
    resetDemo();
  }
});

window.addEventListener("resize", () => {
  placePinAtProgress(currentProgress);
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    placePinAtProgress(currentProgress);
  }, 250);
});

setClock();
setInterval(setClock, 30000);

window.addEventListener("load", resetDemo);
resetDemo();