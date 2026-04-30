// Single switch for the app's URL prefix.
// - Present + non-empty string → the app is served under that prefix
//   (e.g. https://your-domain.com/analytics-app/...)
// - Empty string OR file deleted → the app is served at the root
//   (e.g. http://localhost:3000/)
//
// Local dev: delete this file (or set the export to "") for clean root URLs.
// Server: keep this file with "/analytics-app" so Apache's ProxyPass matches.

module.exports = "/analytics-app";
