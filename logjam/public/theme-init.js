(function initializeLogJamTheme() {
  var storedLogJamTheme = null;
  try {
    storedLogJamTheme = localStorage.getItem("logjam-theme");
  } catch (_) {
    // The system preference still works when storage is unavailable.
  }

  var logJamTheme = storedLogJamTheme === "light" || storedLogJamTheme === "dark"
    ? storedLogJamTheme
    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = logJamTheme;
  document.documentElement.style.colorScheme = logJamTheme;

  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = logJamTheme === "dark" ? "#000000" : "#ffffff";
  }
})();
