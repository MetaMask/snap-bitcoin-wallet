#!/bin/bash

# Start Docker services
docker-compose up -d

# Wait for services to be ready
echo "Waiting for Bitcoin regtest network to be ready..."
sleep 10

# Run tests
jest --config jest.integration.config.js

# Stop Docker services
docker-compose down