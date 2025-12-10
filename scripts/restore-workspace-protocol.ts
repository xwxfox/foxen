#!/usr/bin/env bun
/**
 * This script restores workspace:* protocol after publishing
 * This keeps the development workflow using workspace protocol
 */

import { execSync } from "node:child_process";

console.log("Restoring workspace protocol...");

try {
	// Reset all package.json files to their git state
	execSync("git checkout packages/*/package.json", { stdio: "inherit" });
	console.log("Workspace protocol restored");
} catch (error) {
	console.error("Failed to restore workspace protocol:", error);
	process.exit(1);
}
