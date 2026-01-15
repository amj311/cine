#!/bin/sh

# Read the current build number
if [ -f "version.json" ]; then
  CURRENT_BUILD=$(cat version.json | grep -o '"buildNumber": [0-9]*' | grep -o '[0-9]*')
else
  CURRENT_BUILD=0
fi

DELTA=1

if [ "$1" = "--down" ]; then
  DELTA=-1
fi

# Increment the build number
NEW_BUILD=$((CURRENT_BUILD + $DELTA))

# Update the version.json file
echo "{\"buildNumber\": $NEW_BUILD}" > version.json

echo "Build number updated to $NEW_BUILD"