#!/bin/bash

# Determine the correct path for .env file
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
CURRENT_DIR="$(pwd)"
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# Check if current directory ends with 'scripts'
if [[ "$CURRENT_DIR" == */scripts ]]; then
  ENV_PATH=".."
  echo "Running from scripts directory, using $ENV_PATH/.env"
else
  ENV_PATH="."
  echo "Running from project root, using $ENV_PATH/.env"
fi

# Check if .env file exists, create it if not
if [ ! -f "$ENV_PATH/.env" ]; then
  touch "$ENV_PATH/.env"
  echo "Created new .env file at $ENV_PATH/.env"
fi

# Check if SF_DEMO_SEED_USER_ORGID already exists in .env
if grep -q "^SF_DEMO_SEED_USER_ORGID=" "$ENV_PATH/.env"; then
  SF_ORG_ID=$(grep "^SF_DEMO_SEED_USER_ORGID=" "$ENV_PATH/.env" | cut -d '=' -f2)
  echo "Found existing SF_DEMO_SEED_USER_ORGID: $SF_ORG_ID"
  EXISTING_SF_ORG_ID=true
else
  EXISTING_SF_ORG_ID=false
fi

# Check if SF_DEMO_SEED_USER_USERID already exists in .env
if grep -q "^SF_DEMO_SEED_USER_USERID=" "$ENV_PATH/.env"; then
  SF_USER_ID=$(grep "^SF_DEMO_SEED_USER_USERID=" "$ENV_PATH/.env" | cut -d '=' -f2)
  echo "Found existing SF_DEMO_SEED_USER_USERID: $SF_USER_ID"
  EXISTING_SF_USER_ID=true
else
  EXISTING_SF_USER_ID=false
fi

# If both values already exist, exit with a message
if [ "$EXISTING_SF_ORG_ID" = true ] && [ "$EXISTING_SF_USER_ID" = true ]; then
  echo "Salesforce user details already configured in .env file."
  echo "To update these values, edit your .env file directly or remove the lines containing SF_ORG_ID and SF_USER_ID, then run this script again."
  exit 0
fi

# Check if Salesforce CLI is installed
if ! command -v sf &> /dev/null; then
  echo "Salesforce CLI not found. Please install it with:"
  echo "npm install -g @salesforce/cli"
  exit 1
fi

# Check if an org alias was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <salesforce-org-alias>"
  echo "Please provide your Salesforce org alias."
  
  # List available orgs to help the user
  echo "Available Salesforce orgs:"
  sf org list
  exit 1
fi

SF_ORG_ALIAS="$1"

# Fetch Salesforce org details using the Salesforce CLI
echo "Fetching Salesforce org details for alias '$SF_ORG_ALIAS'..."
SF_ORG_INFO=$(sf org display -o "$SF_ORG_ALIAS" --json 2>/dev/null)

# Check if the command was successful
if [ $? -ne 0 ]; then
  echo "Error: Unable to fetch Salesforce org details for alias '$SF_ORG_ALIAS'."
  echo "Please ensure Salesforce CLI is correctly installed and authenticated."
  exit 1
fi

# Extract org ID and user ID
if [ "$EXISTING_SF_ORG_ID" = false ]; then
  NEW_SF_ORG_ID=$(echo "$SF_ORG_INFO" | jq -r '.result.id')
  if [ -z "$NEW_SF_ORG_ID" ] || [ "$NEW_SF_ORG_ID" = "null" ]; then
    echo "Error: Could not extract Organization ID from CLI response."
    exit 1
  fi
  printf "\nSF_DEMO_SEED_USER_ORGID=$NEW_SF_ORG_ID\n" >> "$ENV_PATH/.env"
  echo "Added SF_DEMO_SEED_USER_ORGID=$NEW_SF_ORG_ID to $ENV_PATH/.env file"
fi

if [ "$EXISTING_SF_USER_ID" = false ]; then
  # Get the user ID using the username from org info
  USERNAME=$(echo "$SF_ORG_INFO" | jq -r '.result.username')
  if [ -z "$USERNAME" ] || [ "$USERNAME" = "null" ]; then
    echo "Error: Could not extract username from CLI response."
    exit 1
  fi
  
  # Query for the user ID using the username
  USER_QUERY_RESULT=$(sf data query -q "SELECT Id FROM User WHERE Username='$USERNAME'" -o "$SF_ORG_ALIAS" --json 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "Error: Unable to query for user ID. Using a placeholder instead."
    NEW_SF_USER_ID="005PLACEHOLDER000000"
  else
    NEW_SF_USER_ID=$(echo "$USER_QUERY_RESULT" | jq -r '.result.records[0].Id')
    if [ -z "$NEW_SF_USER_ID" ] || [ "$NEW_SF_USER_ID" = "null" ]; then
      echo "Warning: Could not extract User ID. Using a placeholder instead."
      NEW_SF_USER_ID="005PLACEHOLDER000000"
    fi
  fi
  
  printf "SF_DEMO_SEED_USER_USERID=$NEW_SF_USER_ID\n" >> "$ENV_PATH/.env"
  echo "Added SF_DEMO_SEED_USER_USERID=$NEW_SF_USER_ID to $ENV_PATH/.env file"
fi

echo "Setup complete! Your Salesforce org details have been added to the $ENV_PATH/.env file."
echo "Run 'node data/seed.js' to create a demo user with these Salesforce details."