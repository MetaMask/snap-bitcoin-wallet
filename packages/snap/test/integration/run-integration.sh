#!/bin/bash

set -e  

echo "Starting Docker services..."
docker-compose -f test/integration/docker-compose.yml up -d

# Check if Docker services started successfully
if [ $? -ne 0 ]; then
  echo "Error: Failed to start Docker services"
  exit 1
fi

echo "Docker services started successfully."

# Show Docker service status
docker-compose -f test/integration/docker-compose.yml  ps

echo "Waiting for Bitcoin regtest network to be ready..."
sleep 10

echo "Checking Docker logs..."
docker-compose -f test/integration/docker-compose.yml  logs --tail=20

echo "Running integration tests..."
jest --config jest.integration.config.js

if [ $? -eq 0 ]; then
  echo "Tests completed successfully."
else
  echo "Tests failed."
  exit 1
fi

echo "Stopping Docker services..."
docker-compose -f test/integration/docker-compose.yml  down

if [ $? -ne 0 ]; then
  echo "Error: Failed to stop Docker services."
  exit 1
fi

echo "Docker services stopped successfully."