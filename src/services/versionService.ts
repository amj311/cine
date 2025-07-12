// This file provides access to build information throughout the application
import versionData from '../../version.json';

/**
 * Returns the current build number of the application
 * This value is incremented with each deployment
 */
export const getBuildNumber = (): string => {
  // Use the imported version.json data, fallback to env var, then fallback to '0'
  return versionData.buildNumber?.toString() || import.meta.env.VITE_BUILD_NUMBER || '0';
};

/**
 * Returns the full version string including build number
 */
export const getVersionString = (): string => {
  const buildNumber = getBuildNumber();
  // You can add more version info here if needed
  return `Build ${buildNumber}`;
};
