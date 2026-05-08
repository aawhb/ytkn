import { resolveTargetVersion, updateVersionFiles } from './scripts/versioning.mjs';

// Main execution
try {
	const targetVersion = resolveTargetVersion();
	if (!targetVersion) {
		throw new Error('No version specified. Run `npm version x.y.z --no-git-tag-version`, or provide an explicit version after package metadata has been updated.');
	}

	const { targetVersion: newVersion, minAppVersion } =
		updateVersionFiles(targetVersion);
	console.log(
		`✓ Successfully updated version to ${newVersion} (minAppVersion: ${minAppVersion})`
	);
} catch (error) {
	console.error('Error:', error.message);
	process.exit(1);
}
