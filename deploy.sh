#!/bin/sh

# Update and increment build number before deployment
./update-build-number.sh
echo "Deploying with build number $(cat version.json | grep -o '"buildNumber": [0-9]*' | grep -o '[0-9]*')"

# load env vars from file if present
# Otherwise they should already be present
if [[ -f .env.deploy ]]; then
	. .env.deploy
fi

VERBOSE=$1
OUT=/dev/null

if [[ "$VERBOSE" == "-v" ]]; then
	OUT=/dev/stdout
fi

# Run docker compose on host, force build and recreate
sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker compose -f docker-compose-prod.yml up -d --build --force-recreate > $OUT
SUCCESS=$?

if [[ $SUCCESS == 0 ]]; then
	# Post build cleanup
	echo -e "\nCleaning up build cache..."
	sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker system prune -f --filter "label=com.docker.compose.project=cine" > $OUT

	echo "Committing build number..."

	# Optionally commit the updated version file to git
	if [ "$1" = "--commit" ]; then
		CURRENT_BUILD=$(cat version.json | grep -o '"buildNumber": [0-9]*' | grep -o '[0-9]*')
		git add version.json
		git commit -m "build $NEW_BUILD"
	fi

	echo "Finished!"
	exit 0
else
	echo -e "\nDeploy failed with exit code $SUCCESS"
	./update-build-number.sh --down
fi

