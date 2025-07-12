#!/bin/sh

# Read the current build number
if [ -f "version.json" ]; then
  CURRENT_BUILD=$(cat version.json | grep -o '"buildNumber": [0-9]*' | grep -o '[0-9]*')
else
  CURRENT_BUILD=0
fi

# Increment the build number
NEW_BUILD=$((CURRENT_BUILD + 1))

# Update the version.json file
echo "{\"buildNumber\": $NEW_BUILD}" > version.json

echo "Build number updated to $NEW_BUILD"

# Optionally commit the updated version file to git
if [ "$1" = "--commit" ]; then
  git add version.json
  git commit -m "Bump build number to $NEW_BUILD"
  echo "Committed change to git"
fi
