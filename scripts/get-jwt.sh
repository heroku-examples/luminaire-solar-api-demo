#!/bin/bash

# Check if required arguments are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <auth-url> <username> <password>"
    echo "Example: $0 http://localhost:3000/api/user/authenticate demo demo"
    exit 1
fi

AUTH_URL="$1"
USERNAME="$2"
PASSWORD="$3"

# Make the authentication request
echo "Authenticating with $AUTH_URL..."
AUTH_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" "$AUTH_URL")

# Check if authentication was successful
if [[ "$AUTH_RESPONSE" == *"authorization"* ]]; then
    # Extract the JWT token
    JWT_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"authorization":"[^"]*"' | cut -d'"' -f4)
    
    # Print the token
    echo "SUCCESS: JWT token obtained"
    echo "$JWT_TOKEN"
    
    # Save it to a file for easy use
    echo "$JWT_TOKEN" > .jwt-token
    echo "Token saved to .jwt-token"
else
    echo "ERROR: Authentication failed. Server response:"
    echo "$AUTH_RESPONSE"
    exit 1
fi