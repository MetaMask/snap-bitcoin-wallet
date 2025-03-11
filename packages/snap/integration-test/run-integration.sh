#!/bin/bash

set -e  

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
jest --config jest.integration.config.js 

if [ $? -eq 0 ]; then
  echo "Tests completed successfully."
else
  echo "Tests failed."
fi

echo "Stopping Docker services..."
docker-compose -f integration-test/docker-compose.yml down

if [ $? -ne 0 ]; then
  echo "Error: Failed to stop Docker services."
  exit 1
fi

echo "Docker services stopped successfully."