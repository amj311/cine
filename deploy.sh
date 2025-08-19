#!/bin/sh

# Update and increment build number before deployment
./update-build-number.sh --commit
echo "Deploying with build number $(cat version.json | grep -o '"buildNumber": [0-9]*' | grep -o '[0-9]*')"

# load env vars from file if present
# Otherwise they should already be present
if [[ -f .env.deploy ]]; then
	. .env.deploy
fi

# Run docker compose on host, force build and recreate
sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker compose -f docker-compose-prod.yml up -d --build --force-recreate > /dev/null
# Post build cleanup
echo "Cleaning up build cache..."
sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker system prune -f --filter "label=com.docker.compose.project=cine" > /dev/null

echo "Finished!"
exit 0