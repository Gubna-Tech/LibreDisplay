// LibreDisplay frontend bootstrap.
// Public release modules are consolidated by logical feature while preserving source-section scope.
const modulePaths = [
  "/js/runtime.js",
  "/js/modules/bootstrap.js",
  "/js/modules/shared.js",
  "/js/modules/integrations.js",
  "/js/modules/config.js",
  "/js/modules/performance.js",
  "/js/modules/weather.js",
  "/js/modules/calendar.js",
  "/js/modules/backgrounds.js",
  "/js/modules/blocks.js",
  "/js/modules/layout.js",
  "/js/modules/appearance.js",
  "/js/modules/remote.js",
  "/js/modules/system.js",
  "/js/modules/onboarding.js",
  "/js/modules/settings.js",
  "/js/modules/lifecycle.js",
];
try {
  for (const path of modulePaths) await import(path);
  globalThis.LibreDisplayModules = LibreDisplayRuntime.finalizeModules();
} catch (error) {
  console.error("LibreDisplay frontend startup failed", error);
  const notice = document.createElement("div");
  notice.id = "frontend-startup-error";
  notice.setAttribute("role", "alert");
  notice.textContent = "LibreDisplay could not finish loading. Refresh this display; if the problem continues, verify the update completed successfully.";
  Object.assign(notice.style, {
    position: "fixed", inset: "20px", zIndex: "2147483647", display: "grid",
    placeItems: "center", padding: "24px", borderRadius: "16px", textAlign: "center",
    background: "#101411", color: "#f3f7f4", border: "1px solid #465049",
    font: "600 16px system-ui, sans-serif"
  });
  document.body.appendChild(notice);
  globalThis.LibreDisplayFrontendError = String(error?.message || error);
}
