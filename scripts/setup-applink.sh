#!/bin/bash

# AppLink Setup Script - Fetch YAML and import to Salesforce

set -e

# Default values
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
SF_ORG_ALIAS="${SF_ORG_ALIAS:-demo-org}"
SF_APP_NAME="${SF_APP_NAME:-LuminaireAPI}"
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
    --app <name>       App name in Salesforce (default: \$SF_APP_NAME or 'LuminaireAPI')
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

# Get OpenAPI YAML
echo "Fetching OpenAPI specification..."

if [[ -n "$FILTER_ROUTES" ]]; then
    echo "Filtering routes to: $FILTER_ROUTES"
    if ! node scripts/generate-api-docs.js --only "$FILTER_ROUTES" --output "$OUTPUT_FILE"; then
        echo "Error: Failed to generate filtered API docs"
        exit 1
    fi
else
    if ! curl -sSf "$SERVER_URL/docs/yaml" -o "$OUTPUT_FILE"; then
        echo "Error: Failed to fetch YAML from $SERVER_URL/docs/yaml"
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

if heroku salesforce:import "$OUTPUT_FILE" --org-name "$SF_ORG_ALIAS" --client-name "$SF_APP_NAME"; then
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