#!/bin/bash

set -e  

cleanup() {
  echo "Stopping Docker services..."
  docker-compose -f integration-test/docker-compose.yml down
}
trap cleanup EXIT

echo "Starting Docker services..."
docker-compose -f integration-test/docker-compose.yml up -d

# Check if Docker services started successfully
if [ $? -ne 0 ]; then
  echo "Error: Failed to start Docker services"
  exit 1
fi

echo "Docker services started successfully."

# Show Docker service status
docker-compose -f integration-test/docker-compose.yml ps

echo "Waiting for Esplora to be ready..."
sleep 5

# Transfer funds to test address
docker exec esplora bash /init-esplora.sh

echo "Running integration tests..."
set +e
jest --config jest.integration.config.js
TEST_EXIT_CODE=$?
set -e
exit $TEST_EXIT_CODE
