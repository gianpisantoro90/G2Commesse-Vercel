// This file is a compatibility shim. The actual route definitions have been
// split into server/routes/ directory. This re-export ensures existing imports
// continue to work. Once all imports are updated to "./routes/index", this
// file can be safely deleted.
export { registerRoutes } from "./routes/index";
