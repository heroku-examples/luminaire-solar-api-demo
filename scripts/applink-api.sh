#!/bin/bash

# AppLink API Import Script - Fetch OpenAPI spec and import/update in Salesforce
# This utility can be run anytime to update the API specification in Salesforce

set -e

# Load .env file if it exists
if [[ -f .env ]]; then
    # Use a safer method that handles multi-line values
    set -a  # automatically export all variables
    source .env
    set +a  # turn off automatic export
fi

# Default values
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
SF_ORG_ALIAS="${SF_ORG_ALIAS:-demo-org}"
# Default SF_APP_NAME to APP_NAME if not explicitly set
SF_APP_NAME="${SF_APP_NAME:-${APP_NAME:-LuminaireAPI}}"
OUTPUT_FILE="api-docs.yaml"
FILTER_ROUTES=""
VERIFY=false

print_help() {
    cat << EOF
AppLink Setup Script

USAGE:
    ./scripts/setup-applink.sh [options]

OPTIONS:
    --server <url>     API server URL (default: http://localhost:3000)
    --org <alias>      Salesforce org alias (default: \$SF_ORG_ALIAS or 'demo-org')
    --app <name>       App name in Salesforce (default: \$SF_APP_NAME, \$APP_NAME, or 'LuminaireAPI')
    --output <file>    Output YAML file (default: api-docs.yaml)
    --filter <path>    Include only routes starting with path
    --verify           Test integration after import
    --help, -h         Show this help

EXAMPLES:
    ./scripts/setup-applink.sh
    ./scripts/setup-applink.sh --org my-org --app MyAPI
    ./scripts/setup-applink.sh --filter /api/salesforce --verify
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h) print_help; exit 0 ;;
        --server) SERVER_URL="$2"; shift 2 ;;
        --org) SF_ORG_ALIAS="$2"; shift 2 ;;
        --app) SF_APP_NAME="$2"; shift 2 ;;
        --output) OUTPUT_FILE="$2"; shift 2 ;;
        --filter) FILTER_ROUTES="$2"; shift 2 ;;
        --verify) VERIFY=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "AppLink Setup"
echo "Server: $SERVER_URL"
echo "Org: $SF_ORG_ALIAS"
echo "App: $SF_APP_NAME"
echo ""

# Check prerequisites
if ! command -v heroku &> /dev/null; then
    echo "Error: Heroku CLI not found"
    exit 1
fi

if ! command -v sf &> /dev/null; then
    echo "Error: Salesforce CLI not found"
    exit 1
fi

if ! heroku plugins | grep -q integration; then
    echo "Error: Heroku integration plugin not found"
    echo "Install with: heroku plugins:install @heroku-cli/plugin-integration"
    exit 1
fi

# Check if server is running
echo "Checking if server is running at $SERVER_URL..."
HEALTH_CHECK=$(curl -s -w "\n%{http_code}" "$SERVER_URL/api/healthcheck" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_CHECK" | tail -n1)

if [[ "$HTTP_CODE" == "000" ]]; then
    echo "Error: Cannot connect to server at $SERVER_URL"
    echo ""
    echo "Please start the server first:"
    echo "  pnpm run dev"
    echo ""
    echo "Then run this script again."
    exit 1
elif [[ "$HTTP_CODE" == "500" ]]; then
    echo "Error: Server returned 500 error for /healthcheck"
    echo ""
    echo "This might indicate an AppLink configuration issue."
    echo "Please check:"
    echo "  1. Your local server logs for error details"
    echo "  2. If deploying to Heroku, run: heroku logs --tail --app $SF_APP_NAME"
    echo ""
    echo "Common issues:"
    echo "  - Missing x-client-context header (check salesforce middleware)"
    echo "  - Service mesh configuration problems"
    exit 1
elif [[ "$HTTP_CODE" != "200" ]]; then
    echo "Error: Server returned unexpected status code: $HTTP_CODE"
    echo ""
    echo "Please check your server logs for details."
    exit 1
fi

echo "✓ Server is running"

# Get OpenAPI YAML
echo "Fetching OpenAPI specification..."

if [[ -n "$FILTER_ROUTES" ]]; then
    echo "Filtering routes to: $FILTER_ROUTES"
    if ! node scripts/generate-api-docs.js --only "$FILTER_ROUTES" --output "$OUTPUT_FILE"; then
        echo "Error: Failed to generate filtered API docs"
        exit 1
    fi
else
    if ! curl -sSf "$SERVER_URL/api-docs/yaml" -o "$OUTPUT_FILE"; then
        echo "Error: Failed to fetch YAML from $SERVER_URL/api-docs/yaml"
        echo "Make sure server is running at $SERVER_URL"
        exit 1
    fi
fi

if [[ ! -s "$OUTPUT_FILE" ]]; then
    echo "Error: Generated YAML file is empty"
    exit 1
fi

echo "Saved: $OUTPUT_FILE"

# Import to Salesforce
echo "Importing to Salesforce..."

# Sanitize client name for Salesforce (alphanumeric only, 3-30 chars)
SAFE_CLIENT_NAME=$(echo "$SF_APP_NAME" | sed 's/[^a-zA-Z0-9]//g' | cut -c1-30)
if [[ ${#SAFE_CLIENT_NAME} -lt 3 ]]; then
    SAFE_CLIENT_NAME="LuminaireAPI"
fi

echo "Using client name: $SAFE_CLIENT_NAME"

if heroku salesforce:import "$OUTPUT_FILE" --org-name "$SF_ORG_ALIAS" --client-name "$SAFE_CLIENT_NAME"; then
    echo "Import successful"
else
    echo "Error: Import failed"
    echo "Check: heroku login, sf org alias, heroku salesforce:connect"
    exit 1
fi

# Verify if requested
if [[ "$VERIFY" == true ]]; then
    echo "Verifying integration..."
    TEST_ENDPOINT="$SERVER_URL/api/salesforce/products"
    
    if ./scripts/invoke.sh "$SF_ORG_ALIAS" "$TEST_ENDPOINT" &>/dev/null; then
        echo "Verification successful"
    else
        echo "Verification failed (may be normal if server not running or auth required)"
    fi
fi

echo "AppLink setup complete"
echo ""

# Get the actual Heroku app URL first for the waiting message
HEROKU_URL=$(heroku apps:info --app "$SF_APP_NAME" --json | jq -r '.web_url' | sed 's/\/$//')
if [[ -z "$HEROKU_URL" || "$HEROKU_URL" == "null" ]]; then
    echo "Error: Could not get Heroku app URL"
    exit 1
fi

# Wait for AppLink to be fully configured
echo "Waiting for AppLink to be fully configured..."
echo "This typically takes a few minutes. You can manually test the endpoint while waiting:"
echo ""
echo "  curl $HEROKU_URL/api/salesforce/healthcheck"
echo ""

# 5 minute countdown
WAIT_TIME=300  # 5 minutes in seconds
echo "Starting 5-minute countdown..."

for ((i=$WAIT_TIME; i>0; i--)); do
    MINS=$((i / 60))
    SECS=$((i % 60))
    printf "\rTime remaining: %02d:%02d" $MINS $SECS
    sleep 1
done
echo ""


# Ask if user wants to test with demo credentials
echo ""
read -p "Do you want to test AppLink is working in deployment using demo credentials? [Y/n] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "Waiting for AppLink deployment to complete..."
    sleep 30
    
    # Get the Heroku app URL again (in case it changed)
    HEROKU_URL=$(heroku apps:info --app "$SF_APP_NAME" --json | jq -r '.app.web_url' | sed 's/\/$//')
    if [[ -z "$HEROKU_URL" || "$HEROKU_URL" == "null" ]]; then
        echo "Error: Could not get Heroku app URL"
        exit 1
    fi
    
    echo "Testing AppLink integration..."
    echo ""
    
    # Step 1: Get JWT token
    echo "1. Getting JWT token for demo user..."
    JWT_AUTH_URL="$HEROKU_URL/api/user/authenticate"
    if ./scripts/get-jwt.sh "$JWT_AUTH_URL" demo demo; then
        echo "✓ Authentication successful"
        echo ""
        
        # Step 2: Test Salesforce endpoint with JWT
        echo "2. Testing Salesforce endpoint with JWT..."
        SALESFORCE_TEST_URL="$HEROKU_URL/api/salesforce/user"
        
        # Run invoke.sh and capture output
        INVOKE_OUTPUT=$(./scripts/invoke.sh "$SF_ORG_ALIAS" "$SALESFORCE_TEST_URL" --auth 2>&1)
        INVOKE_EXIT_CODE=$?
        
        if [[ $INVOKE_EXIT_CODE -eq 0 ]] && echo "$INVOKE_OUTPUT" | grep -q "HTTP Status: 200"; then
            echo "✓ AppLink is working! The integration is complete."
            echo ""
            echo "Server response:"
            echo "$INVOKE_OUTPUT" | grep -A1 "Response from server:" | tail -n1
            echo ""
            echo "You can now use Salesforce routes with authentication!"
        else
            echo "✗ AppLink test failed."
            echo ""
            echo "This might be because AppLink is still provisioning. Please wait a couple minutes and try:"
            echo ""
            echo "  ./scripts/get-jwt.sh $JWT_AUTH_URL demo demo"
            echo "  ./scripts/invoke.sh $SF_ORG_ALIAS $SALESFORCE_TEST_URL --auth"
            echo ""
            echo "If it still doesn't work, see the troubleshooting section in README-DETAILED.md"
        fi
    else
        echo "✗ Authentication failed."
        echo ""
        echo "Please ensure the demo user has been seeded in the production database:"
        echo "  node data/migration.js"
        echo "  node data/seed.js"
        echo ""
        echo "Then try the authentication again:"
        echo "  ./scripts/get-jwt.sh $JWT_AUTH_URL demo demo"
    fi
else
    echo "Skipping demo test."
    echo ""
    echo "You can test manually later with:"
    echo "  ./scripts/get-jwt.sh $HEROKU_URL/api/user/authenticate demo demo"
    echo "  ./scripts/invoke.sh $SF_ORG_ALIAS $HEROKU_URL/api/salesforce/user --auth"
fi