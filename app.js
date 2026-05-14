const route = document.getElementById("route");
const pin = document.querySelector(".pin");
const mapContainer = document.querySelector(".map-container");
const screenEl = document.querySelector(".screen");

const DRIVE_DURATION = 22;
const DRIVE_EASE = "slow(0.25, 0.9, false)";

let currentProgress = 0;
let routeLength = 0;

function setupRoute() {
  routeLength = route.getTotalLength();

  gsap.set(route, {
    strokeDasharray: routeLength,
    strokeDashoffset: routeLength
  });
}

function getRouteLength() {
  if (!routeLength) {
    routeLength = route.getTotalLength();
  }

  return routeLength;
}

function routePointToScreenPosition(point) {
  const matrix = route.getScreenCTM();
  const screenBox = screenEl.getBoundingClientRect();

  let transformedPoint;

  if (window.DOMPoint) {
    transformedPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  } else {
    transformedPoint = route.ownerSVGElement.createSVGPoint();
    transformedPoint.x = point.x;
    transformedPoint.y = point.y;
    transformedPoint = transformedPoint.matrixTransform(matrix);
  }

  return {
    x: transformedPoint.x - screenBox.left,
    y: transformedPoint.y - screenBox.top
  };
}

function placePinAtProgress(progress) {
  currentProgress = Math.max(0, Math.min(1, progress));

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
  const safeProgress = Math.max(0, Math.min(1, progress));
  const length = getRouteLength();

  gsap.set(route, {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - safeProgress)
  });
}

function setRouteProgress(progress) {
  const safeProgress = Math.max(0, Math.min(1, progress));

  drawRouteToProgress(safeProgress);
  placePinAtProgress(safeProgress);
}

function setMapTransform(scale, x, y, duration) {
  gsap.killTweensOf(mapContainer);

  gsap.to(mapContainer, {
    scale,
    x,
    y,
    duration,
    ease: "power2.inOut",
    transformOrigin: "0 0",
    onUpdate: function () {
      placePinAtProgress(currentProgress);
    },
    onComplete: function () {
      placePinAtProgress(currentProgress);
    }
  });
}

function zoomToRouteProgress(progress, scale, duration) {
  const oldTransform = {
    scale: gsap.getProperty(mapContainer, "scale"),
    x: gsap.getProperty(mapContainer, "x"),
    y: gsap.getProperty(mapContainer, "y")
  };

  gsap.set(mapContainer, {
    scale: 1,
    x: 0,
    y: 0,
    transformOrigin: "0 0"
  });

  placePinAtProgress(progress);

  const pinX = parseFloat(gsap.getProperty(pin, "left"));
  const pinY = parseFloat(gsap.getProperty(pin, "top"));

  gsap.set(mapContainer, oldTransform);
  placePinAtProgress(currentProgress);

  const screenCenterX = screenEl.clientWidth / 2;
  const screenCenterY = screenEl.clientHeight / 2;

  const x = screenCenterX - pinX * scale;
  const y = screenCenterY - pinY * scale;

  setMapTransform(scale, x, y, duration);
}

function resetDemo() {
  gsap.killTweensOf("*");

  currentProgress = 0;
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

  document.getElementById("status").innerText = "Current Location";
  document.getElementById("subtitle").innerText = "7 Dockside Row, The Heights";
}

function showHeights() {
  resetDemo();

  gsap.to(pin, {
    scale: 1.18,
    duration: 0.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
}

function movePin() {
  resetDemo();

  const tracker = { progress: 0 };

  document.getElementById("status").innerText = "Moving";
  document.getElementById("subtitle").innerText = "Tracking route";

  gsap.to(tracker, {
    progress: 1,
    duration: DRIVE_DURATION,
    ease: DRIVE_EASE,
    onUpdate: function () {
      setRouteProgress(tracker.progress);
    },
    onComplete: function () {
      setRouteProgress(1);
      document.getElementById("status").innerText = "Near Reservoir";
      document.getElementById("subtitle").innerText = "Reservoir location";
    }
  });
}

function zoomReservoir() {
  const reservoirProgress = 1;

  setRouteProgress(reservoirProgress);
  zoomToRouteProgress(reservoirProgress, 2.8, 2);
}

function zoomStart() {
  const startProgress = 0;

  setRouteProgress(startProgress);
  zoomToRouteProgress(startProgress, 2.3, 2);
}

function resetZoom() {
  setMapTransform(1, 0, 0, 1.5);
}

window.addEventListener("resize", function () {
  placePinAtProgress(currentProgress);
});

window.addEventListener("load", resetDemo);
resetDemo();
