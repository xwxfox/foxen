#!/usr/bin/env bun
/**
 * This script restores workspace:* protocol after publishing
 * This keeps the development workflow using workspace protocol
 */

import { Glob } from "bun";

const packagesDir = `${import.meta.dir}/../packages`;
const glob = new Glob("*/package.json");

// First, collect all package names
const packageNames = new Set<string>();

for await (const pkgPath of glob.scan(packagesDir)) {
	const fullPath = `${packagesDir}/${pkgPath}`;
	const pkg = await Bun.file(fullPath).json();
	packageNames.add(pkg.name);
}

console.log("Restoring workspace protocol...");

// Now, restore all internal dependencies to workspace:*
let restoredCount = 0;

for await (const pkgPath of glob.scan(packagesDir)) {
	const fullPath = `${packagesDir}/${pkgPath}`;
	const pkg = await Bun.file(fullPath).json();
	let modified = false;

	// Check dependencies, devDependencies, and peerDependencies
	for (const depType of ["dependencies", "devDependencies", "peerDependencies"]) {
		const deps = pkg[depType];
		if (!deps) continue;

		for (const depName of Object.keys(deps)) {
			// If this dependency is one of our internal packages
			if (packageNames.has(depName)) {
				// Convert back to workspace:*
				deps[depName] = "workspace:*";
				modified = true;
				restoredCount++;
			}
		}
	}

	if (modified) {
		await Bun.write(fullPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	}
}

console.log(`Restored ${restoredCount} dependencies to workspace:*`);

