/**
 * Server-side version service
 * Provides access to build information for the server
 */
import fs from 'fs';
import path from 'path';

// Import version.json by reading it directly from the filesystem
// This ensures we always have the most up-to-date version, even during development
const getVersionData = (): { buildNumber: number } => {
	try {
		const versionFilePath = path.resolve(process.cwd(), 'version.json');
		const versionContent = fs.readFileSync(versionFilePath, 'utf8');
		return JSON.parse(versionContent);
	} catch (error) {
		console.error('Error reading version.json:', error);
		return { buildNumber: 0 };
	}
};

/**
 * Returns the current build number of the application
 * This value is incremented with each deployment
 */
export const getBuildNumber = (): string => {
	// First try to read from version.json, then fallback to env var, then fallback to '0'
	const versionData = getVersionData();
	return versionData.buildNumber?.toString() || process.env.VITE_BUILD_NUMBER || '0';
};

/**
 * Returns the full version string including build number
 */
export const getVersionString = (): string => {
	const buildNumber = getBuildNumber();
	// You can add more version info here if needed
	return `Build ${buildNumber}`;
};
