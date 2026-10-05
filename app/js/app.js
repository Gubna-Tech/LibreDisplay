// LibreDisplay v1.8.17 frontend bootstrap.
// Source files load sequentially so split feature modules can extend one logical module safely.
const modulePaths = [
  "/js/core/runtime.js",
  "/js/core/bootstrap.js",
  "/js/core/shared.js",
  "/js/integrations/index.js",
  "/js/core/config.js",
  "/js/core/performance.js",
  "/js/weather/index.js",
  "/js/weather/effects.js",
  "/js/weather/alerts.js",
  "/js/calendar/ics-parser.js",
  "/js/calendar/recurrence.js",
  "/js/calendar/index.js",
  "/js/backgrounds/google-photos.js",
  "/js/backgrounds/media.js",
  "/js/backgrounds/index.js",
  "/js/blocks/index.js",
  "/js/layout/index.js",
  "/js/layout/remote.js",
  "/js/layout/persistence.js",
  "/js/appearance/weather.js",
  "/js/appearance/index.js",
  "/js/appearance/presets.js",
  "/js/appearance/backup.js",
  "/js/remote/index.js",
  "/js/system/index.js",
  "/js/system/profiles.js",
  "/js/onboarding/index.js",
  "/js/settings/index.js",
  "/js/settings/navigation.js",
  "/js/settings/actions.js",
  "/js/settings/interactions.js",
  "/js/settings/accounts.js",
  "/js/lifecycle/index.js"
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
