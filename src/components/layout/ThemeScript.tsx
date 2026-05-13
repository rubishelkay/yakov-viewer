export function ThemeScript() {
  const code = `
    try {
      var stored = localStorage.getItem("yakov-theme");
      if (stored === "light" || stored === "dark") {
        document.documentElement.dataset.theme = stored;
      }
    } catch (_) {}
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
