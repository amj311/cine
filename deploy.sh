#!/bin/sh

# load env vars from file if present
# Otherwise they should already be present
if [[ -f .env.deploy ]]; then
	. .env.deploy
fi

# Run docker compose on host, force build and recreate
sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker compose -f docker-compose-prod.yml up -d --build --force-recreate > /dev/null
# Post build cleanup
sudo DOCKER_HOST=ssh://${SSH_USER}@${SSH_HOST} docker system prune -f --filter "label=com.docker.compose.project=cine" > /dev/null

echo "Finished!"
exit 0