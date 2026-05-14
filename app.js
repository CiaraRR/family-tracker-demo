const route = document.getElementById("route");
const pin = document.querySelector(".pin");
const mapContainer = document.querySelector(".map-container");
const screenEl = document.querySelector(".screen");
const actionButton = document.getElementById("actionButton");
const statusEl = document.getElementById("status");
const subtitleEl = document.getElementById("subtitle");
const hintEl = document.getElementById("hint");
const clockEl = document.getElementById("clock");
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const recenterButton = document.getElementById("recenter");

const MIN_SCALE = 1;
const MAX_SCALE = 4.25;
const AUTO_START_DELAY = 2600;

let currentProgress = 0;
let routeLength = 0;
let step = 0;
let driveTween = null;
let autoTimer = null;
let dragState = null;
let pinchState = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
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

function routePointToScreenPosition(progress) {
  const point = route.getPointAtLength(getRouteLength() * progress);
  const matrix = route.getScreenCTM();
  const screenBox = screenEl.getBoundingClientRect();
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);

  return {
    x: transformed.x - screenBox.left,
    y: transformed.y - screenBox.top
  };
}

function setRouteProgress(progress) {
  currentProgress = clamp(progress, 0, 1);

  const length = getRouteLength();

  gsap.set(route, {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - currentProgress)
  });

  const pos = routePointToScreenPosition(currentProgress);

  gsap.set(pin, {
    left: pos.x,
    top: pos.y,
    xPercent: -50,
    yPercent: -50
  });
}

function updateCard(status, subtitle, hint) {
  statusEl.textContent = status;
  subtitleEl.textContent = subtitle;
  hintEl.textContent = hint;
}

function applyMapTransform(scale, x, y) {
  const box = screenEl.getBoundingClientRect();
  const safeScale = clamp(scale, MIN_SCALE, MAX_SCALE);

  const minX = Math.min(0, box.width - box.width * safeScale);
  const minY = Math.min(0, box.height - box.height * safeScale);

  gsap.set(mapContainer, {
    scale: safeScale,
    x: safeScale <= 1 ? 0 : clamp(x, minX, 0),
    y: safeScale <= 1 ? 0 : clamp(y, minY, 0),
    transformOrigin: "0 0"
  });

  setRouteProgress(currentProgress);
}

function resetDemo() {
  if (driveTween) driveTween.kill();
  clearTimeout(autoTimer);

  step = 1;
  currentProgress = 0;
  setupRoute();

  gsap.set(mapContainer, {
    scale: 1,
    x: 0,
    y: 0,
    transformOrigin: "0 0"
  });

  gsap.set(pin, {
    scale: 1,
    opacity: 1,
    xPercent: -50,
    yPercent: -50
  });

  setRouteProgress(0);

  updateCard(
    "The Heights",
    "Freya is at the beginning of the route",
    "Live · Moving shortly"
  );

  autoTimer = setTimeout(startJourney, AUTO_START_DELAY);
}

function startJourney() {
  if (driveTween) driveTween.kill();
  clearTimeout(autoTimer);

  step = 2;

  updateCard(
    "Moving",
    "Leaving The Heights",
    "Live · Tracking"
  );

  const tracker = { progress: currentProgress };

  driveTween = gsap.timeline({
    onComplete: () => {
      step = 3;
      updateCard(
        "Off screen",
        "Freya moved beyond the visible route",
        "Live · Still tracking"
      );
    }
  });

  driveTween
    .to(tracker, {
      progress: 0.18,
      duration: 12,
      ease: "none",
      onUpdate: () => setRouteProgress(tracker.progress)
    })
    .to(tracker, {
      progress: 0.55,
      duration: 10,
      ease: "power1.in",
      onUpdate: () => setRouteProgress(tracker.progress)
    })
    .to(tracker, {
      progress: 1,
      duration: 8,
      ease: "power2.in",
      onUpdate: () => setRouteProgress(tracker.progress)
    });
}

function zoomAroundPoint(clientX, clientY, nextScale) {
  const box = screenEl.getBoundingClientRect();
  const { scale, x, y } = getTransform();

  const localX = clientX - box.left;
  const localY = clientY - box.top;

  const mapX = (localX - x) / scale;
  const mapY = (localY - y) / scale;

  applyMapTransform(
    nextScale,
    localX - mapX * nextScale,
    localY - mapY * nextScale
  );
}

screenEl.addEventListener("wheel", (event) => {
  event.preventDefault();

  const { scale } = getTransform();
  zoomAroundPoint(
    event.clientX,
    event.clientY,
    scale * (event.deltaY > 0 ? 0.9 : 1.1)
  );
}, { passive: false });

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

screenEl.addEventListener("touchstart", (event) => {
  if (event.touches.length === 2) {
    const [a, b] = event.touches;
    pinchState = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      scale: getTransform().scale
    };
  }
}, { passive: false });

screenEl.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2 && pinchState) {
    event.preventDefault();

    const [a, b] = event.touches;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    zoomAroundPoint(
      (a.clientX + b.clientX) / 2,
      (a.clientY + b.clientY) / 2,
      pinchState.scale * (distance / pinchState.distance)
    );
  }
}, { passive: false });

screenEl.addEventListener("touchend", () => {
  pinchState = null;
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

  applyMapTransform(1, 0, 0);
});

actionButton.addEventListener("click", () => {
  if (step === 1) {
    startJourney();
  } else {
    resetDemo();
  }
});

window.addEventListener("resize", () => {
  setRouteProgress(currentProgress);
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => setRouteProgress(currentProgress), 250);
});

setClock();
setInterval(setClock, 30000);

window.addEventListener("load", resetDemo);
resetDemo();

function refreshResponsiveLayout() {
  setRouteProgress(currentProgress);
}

window.addEventListener("resize", refreshResponsiveLayout);
window.addEventListener("orientationchange", () => {
  setTimeout(refreshResponsiveLayout, 300);
});