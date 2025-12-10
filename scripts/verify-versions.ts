#!/usr/bin/env bun
/**
 * This script verifies that local package versions are higher than published npm versions
 * If a local version is <= npm version, it automatically bumps the patch version
 */

import { Glob, $ } from "bun";

interface PackageJson {
	name: string;
	version: string;
	private?: boolean;
}

async function getNpmVersion(packageName: string): Promise<string | null> {
    try {
        const result = await $`bun info ${packageName} --json version`.json();
        return result.trim();
    } catch {
        // Package doesn't exist on npm yet
        return null;
    }
}

function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		const diff = (parts1[i] || 0) - (parts2[i] || 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function bumpPatchVersion(version: string): string {
	const parts = version.split(".");
	parts[2] = String(Number.parseInt(parts[2] || "0") + 1);
	return parts.join(".");
}

const packagesDir = `${import.meta.dir}/../packages`;
const glob = new Glob("*/package.json");

console.log("Verifying package versions against npm...\n");

let bumpedCount = 0;
const packagesToPublish: string[] = [];

for await (const pkgPath of glob.scan(packagesDir)) {
	const fullPath = `${packagesDir}/${pkgPath}`;
	const pkg: PackageJson = await Bun.file(fullPath).json();

	// Skip private packages
	if (pkg.private) {
		console.log(`Skipping private package: ${pkg.name}`);
		continue;
	}

	packagesToPublish.push(pkg.name);
	const localVersion = pkg.version;
	const npmVersion = await getNpmVersion(pkg.name);

	if (npmVersion === null) {
		console.log(`${pkg.name}@${localVersion} - New package (not on npm yet)`);
		continue;
	}

	const comparison = compareVersions(localVersion, npmVersion);

	if (comparison <= 0) {
		// Local version is same or older than npm version - bump it
		const newVersion = bumpPatchVersion(npmVersion);
		pkg.version = newVersion;
		await Bun.write(fullPath, `${JSON.stringify(pkg, null, "\t")}\n`);
		console.log(
			`[!] ${pkg.name}: local ${localVersion} <= npm ${npmVersion} → bumped to ${newVersion}`,
		);
		bumpedCount++;
	} else {
		console.log(`${pkg.name}@${localVersion} (npm: ${npmVersion})`);
	}
}

console.log(`Found ${packagesToPublish.length} packages to publish`);

if (bumpedCount > 0) {
	console.log(`Bumped ${bumpedCount} package version(s)`);
	console.log("[!] Package versions were updated. Please run 'bun changeset version' to update dependencies.");

	// commit changes to git
	await $`git add packages/*/package.json`;
	await $`git commit -m "chore: bump package versions"`;
} else {
	console.log("All package versions are valid");
}
