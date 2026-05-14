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

const INTRO_ZOOM_DURATION = 1.45;
const START_ZOOM = 3.05;
const WIDE_ZOOM = 1.18;
const MIN_SCALE = 1;
const MAX_SCALE = 4.25;

const MAIN_STREET_PROGRESS = 0.34;
const RESERVOIR_PROGRESS = 0.70;

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

  const transformedPoint = new DOMPoint(point.x, point.y)
    .matrixTransform(matrix);

  return {
    x: transformedPoint.x - screenBox.left,
    y: transformedPoint.y - screenBox.top
  };
}

function placePinAtProgress(progress) {
  currentProgress = clamp(progress, 0, 1);

  const point = route.getPointAtLength(
    getRouteLength() * currentProgress
  );

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

function setFeather(active, duration = 0.45) {
  if (!feather) return;

  gsap.killTweensOf(feather);

  gsap.to(feather, {
    opacity: active ? 0.72 : 0,
    duration,
    ease: active ? "power2.out" : "power2.inOut"
  });
}

function setMapTransform(scale, x, y, duration = 1.2) {
  gsap.killTweensOf(mapContainer);

  const box = screenEl.getBoundingClientRect();

  const minX = Math.min(0, box.width - box.width * scale);
  const minY = Math.min(0, box.height - box.height * scale);

  const safeX = scale <= 1 ? 0 : clamp(x, minX, 0);
  const safeY = scale <= 1 ? 0 : clamp(y, minY, 0);

  setFeather(true, duration * 0.3);

  gsap.to(mapContainer, {
    scale,
    x: safeX,
    y: safeY,
    duration,
    ease: "expo.inOut",
    transformOrigin: "0 0",

    onUpdate: () => {
      placePinAtProgress(currentProgress);
    },

    onComplete: () => {
      placePinAtProgress(currentProgress);
      setFeather(false, 0.7);
    }
  });
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

function zoomToRouteProgress(
  progress,
  scale,
  duration = 1.2,
  yOffset = 0,
  xOffset = 0
) {
  const point = getUntransformedRoutePosition(progress);

  const screenCenterX =
    screenEl.clientWidth / 2 + xOffset;

  const screenCenterY =
    screenEl.clientHeight / 2 + yOffset;

  const x = screenCenterX - point.x * scale;
  const y = screenCenterY - point.y * scale;

  setMapTransform(scale, x, y, duration);
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

  gsap.set(pin, {
    x: 0,
    y: 0,
    xPercent: -50,
    yPercent: -50,
    scale: 1,
    opacity: 1
  });

  gsap.set(mapContainer, {
    scale: 1,
    x: 0,
    y: 0,
    transformOrigin: "0 0"
  });

  setRouteProgress(0);

  updateCard(
    "The Heights",
    "Freya is at the beginning of the route",
    "Live · Pin flashing · Moving shortly"
  );

  zoomToRouteProgress(
    0,
    START_ZOOM,
    INTRO_ZOOM_DURATION,
    34
  );

  setTimeout(() => {
    startJourney();
  }, 2600);
}

function zoomOutForDirection() {
  const lookAhead = 0.42;

  const point =
    getUntransformedRoutePosition(lookAhead);

  const x =
    screenEl.clientWidth * 0.48 -
    point.x * WIDE_ZOOM;

  const y =
    screenEl.clientHeight * 0.56 -
    point.y * WIDE_ZOOM;

  setMapTransform(
    WIDE_ZOOM,
    x,
    y,
    2.35
  );
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

  zoomOutForDirection();

  const tracker = {
    progress: currentProgress
  };

  driveTween = gsap.timeline({
    delay: 0.6,

    onComplete: () => {
      step = 3;

      updateCard(
        "Off-screen",
        "Freya continued down and out along the route",
        "Live · Still moving · Updated now"
      );
    }
  });

  driveTween
    .to(tracker, {
      progress: 0.18,
      duration: 4.5,
      ease: "power1.inOut",

      onUpdate: () => {
        setRouteProgress(tracker.progress);
      }
    })

    .to(tracker, {
      progress: 0.58,
      duration: 4.0,
      ease: "power1.inOut",

      onUpdate: () => {
        setRouteProgress(tracker.progress);
      }
    })

    .to(tracker, {
      progress: 1,
      duration: 3.2,
      ease: "power2.in",

      onUpdate: () => {
        setRouteProgress(tracker.progress);
      }
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

  const safeScale = clamp(
    nextScale,
    MIN_SCALE,
    MAX_SCALE
  );

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

    const nextScale =
      scale * (event.deltaY > 0 ? 0.88 : 1.12);

    zoomAroundPoint(
      event.clientX,
      event.clientY,
      nextScale
    );
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
  if (
    !dragState ||
    dragState.id !== event.pointerId ||
    pinchState
  ) return;

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
    if (
      event.touches.length === 2 &&
      pinchState
    ) {
      event.preventDefault();

      const [a, b] = event.touches;

      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;

      const distance = Math.hypot(dx, dy);

      const centerX =
        (a.clientX + b.clientX) / 2;

      const centerY =
        (a.clientY + b.clientY) / 2;

      zoomAroundPoint(
        centerX,
        centerY,
        pinchState.scale *
          (distance / pinchState.distance)
      );
    }
  },
  { passive: false }
);

screenEl.addEventListener("touchend", () => {
  pinchState = null;
});

topbar.addEventListener("click", () => {
  zoomToRouteProgress(
    currentProgress,
    START_ZOOM,
    0.9,
    26
  );
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

  const scale = Math.max(
    WIDE_ZOOM,
    Number(gsap.getProperty(mapContainer, "scale")) ||
      WIDE_ZOOM
  );

  zoomToRouteProgress(
    currentProgress,
    scale,
    0.75,
    18
  );
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

window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(() => {
      placePinAtProgress(currentProgress);
    }, 250);
  }
);

setClock();

setInterval(setClock, 30000);

window.addEventListener("load", resetDemo);

resetDemo();


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
    // starts zoomed in at The Heights and moves slowly
    .to(tracker, {
      progress: 0.22,
      duration: 5.2,
      ease: "power1.inOut",
      onUpdate: () => {
        setRouteProgress(tracker.progress);
        zoomToRouteProgress(tracker.progress, 2.75, 0.18, 34);
      }
    })

    // begins to zoom out and speed up
    .to(tracker, {
      progress: 0.62,
      duration: 3.6,
      ease: "power2.in",
      onStart: () => {
        zoomToRouteProgress(0.48, 1.55, 1.8, 20);
      },
      onUpdate: () => {
        setRouteProgress(tracker.progress);
      }
    })

    // fast movement down and out
    .to(tracker, {
      progress: 1,
      duration: 1.8,
      ease: "power4.in",
      onStart: () => {
        zoomToRouteProgress(0.78, 1.05, 1.4, -80);
      },
      onUpdate: () => {
        setRouteProgress(tracker.progress);
      }
    });
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

  updateCard(
    "The Heights",
    "Freya is at the beginning of the route",
    "Live · Pin flashing · Moving shortly"
  );

  zoomToRouteProgress(0, START_ZOOM, INTRO_ZOOM_DURATION, 34);

  setTimeout(startJourney, 2600);
}