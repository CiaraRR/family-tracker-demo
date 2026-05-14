const route = document.getElementById("route");
const pin = document.querySelector(".pin");
const screenEl = document.querySelector(".screen");

function getRouteLength() {
  return route.getTotalLength();
}

function routePointToScreenPosition(point) {
  const svg = route.ownerSVGElement;
  const matrix = route.getScreenCTM();
  const screenBox = screenEl.getBoundingClientRect();

  let transformedPoint;

  if (window.DOMPoint) {
    transformedPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  } else {
    transformedPoint = svg.createSVGPoint();
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
  const safeProgress = Math.max(0, Math.min(1, progress));
  const point = route.getPointAtLength(getRouteLength() * safeProgress);
  const position = routePointToScreenPosition(point);

  gsap.set(pin, {
    left: position.x,
    top: position.y,
    xPercent: -50,
    yPercent: -50
  });
}

function resetDemo() {
  gsap.killTweensOf("*");

  const routeLength = getRouteLength();

  gsap.set(pin, {
    x: 0,
    y: 0,
    xPercent: -50,
    yPercent: -50,
    scale: 1,
    opacity: 1
  });

  gsap.set(route, {
    strokeDasharray: routeLength,
    strokeDashoffset: routeLength
  });

  placePinAtProgress(0);

  document.getElementById("status").innerText = "Current Location";
  document.getElementById("subtitle").innerText = "7 Dockside Row, The Heights";
}

function showHeights() {
  resetDemo();

gsap.to(".pin", {
  duration: 36,
  ease: "slow(0.25, 0.9, false)",

  motionPath: {
    path: "#route",
    align: "#route",
    alignOrigin: [0.5, 0.5]
  }
});
}
function movePin() {
  resetDemo();

  const tracker = { progress: 0 };

  document.getElementById("status").innerText = "Moving";
  document.getElementById("subtitle").innerText = "Tracking route";

gsap.to("#route", {
  strokeDashoffset: 0,
  duration: 36,
  ease: "slow(0.25, 0.9, false)"
});
  gsap.to(tracker, {
    progress: 1,
    duration: 6,
    ease: "power1.inOut",
    onUpdate: function () {
      placePinAtProgress(tracker.progress);
    },
    onComplete: function () {
      gsap.set(route, { strokeDashoffset: 0 });
      placePinAtProgress(1);

      document.getElementById("status").innerText = "Near Reservoir";
      document.getElementById("subtitle").innerText = "Marker stopped";
    }
  });
}

window.addEventListener("resize", resetDemo);
window.addEventListener("load", resetDemo);
resetDemo();

function zoomReservoir() {
  gsap.to(".map-container", {
    scale: 4.2,
    x: -500,
    y: -200,
    duration: 2,
    ease: "power2.inOut",
    transformOrigin: "50% 50%"
  });
}

function resetZoom() {
  gsap.to(".map-container", {
    scale: 1,
    x: 0,
    y: 0,
    duration: 1.5,
    ease: "power2.inOut"
  });
}

gsap.to(".map-container", {
  scale: 2.2,
  x: -95,
  y: -185,
  duration: 2,
  ease: "power2.inOut",
  transformOrigin: "50% 50%"
});