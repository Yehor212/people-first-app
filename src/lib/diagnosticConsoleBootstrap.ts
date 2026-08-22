import { installDiagnosticConsoleBoundary } from "./diagnosticConsole";

// Side-effect bootstrap: this module is imported before React and the rest of
// the application graph so boot-time framework diagnostics are bounded too.
installDiagnosticConsoleBoundary();
