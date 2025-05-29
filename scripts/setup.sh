#!/bin/bash

# Luminaire Solar API - Full Setup Script
# This script automates the complete setup process for Heroku + Salesforce + AppLink

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values from environment or flags
HEROKU_TEAM="${HEROKU_TEAM:-}"
SF_ORG_ALIAS="${SF_ORG_ALIAS:-}"
ENABLE_AI="${ENABLE_AI:-false}"
SKIP_CHECKS="${SKIP_CHECKS:-false}"

print_help() {
    cat << EOF
Luminaire Solar API - Full Setup Script

USAGE:
    ./scripts/setup-full.sh [options]

OPTIONS:
    --heroku-team <name>  Heroku team name (or set HEROKU_TEAM env var)
    --sf-org <alias>      Salesforce org alias (or set SF_ORG_ALIAS env var)
    --enable-ai           Enable AI features (Heroku Inference + Redis)
    --skip-checks         Skip dependency checks
    --help, -h            Show this help

EXAMPLES:
    # Basic setup (no AI)
    ./scripts/setup-full.sh --sf-org my-org

    # Full setup with AI and team
    ./scripts/setup-full.sh --heroku-team my-team --sf-org my-org --enable-ai

ENVIRONMENT VARIABLES:
    HEROKU_TEAM     Heroku team name (optional)
    SF_ORG_ALIAS    Salesforce org alias (required)
    ENABLE_AI       Enable AI features (true/false)
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h) print_help; exit 0 ;;
        --heroku-team) HEROKU_TEAM="$2"; shift 2 ;;
        --sf-org) SF_ORG_ALIAS="$2"; shift 2 ;;
        --enable-ai) ENABLE_AI=true; shift ;;
        --skip-checks) SKIP_CHECKS=true; shift ;;
        *) echo "Unknown option: $1"; print_help; exit 1 ;;
    esac
done

# Validate required parameters
if [[ -z "$SF_ORG_ALIAS" ]]; then
    echo -e "${RED}Error: SF_ORG_ALIAS is required${NC}"
    echo "Set it via environment variable or --org flag"
    exit 1
fi

echo -e "${GREEN}=== Luminaire Solar API Full Setup ===${NC}"
echo "Salesforce Org: $SF_ORG_ALIAS"
if [[ -n "$HEROKU_TEAM" ]]; then
    echo "Heroku Team: $HEROKU_TEAM"
fi
echo "Enable AI: $ENABLE_AI"
echo ""

# Step 1: Check dependencies
if [[ "$SKIP_CHECKS" != "true" ]]; then
    echo -e "${YELLOW}Step 1: Checking dependencies...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js not found. Please install Node.js v20+${NC}"
        exit 1
    fi
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 20 ]]; then
        echo -e "${RED}Error: Node.js v20+ required (found v$NODE_VERSION)${NC}"
        exit 1
    fi
    echo "✓ Node.js $(node --version)"
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}Error: pnpm not found. Install with: npm install -g pnpm${NC}"
        exit 1
    fi
    echo "✓ pnpm $(pnpm --version)"
    
    # Check Heroku CLI
    if ! command -v heroku &> /dev/null; then
        echo -e "${RED}Error: Heroku CLI not found${NC}"
        echo "Install from: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    echo "✓ Heroku CLI $(heroku --version | head -1)"
    
    # Check Salesforce CLI
    if ! command -v sf &> /dev/null; then
        echo -e "${RED}Error: Salesforce CLI not found${NC}"
        echo "Install with: npm install -g @salesforce/cli"
        exit 1
    fi
    echo "✓ Salesforce CLI $(sf --version | head -1)"
    
    # Check Heroku integration plugin
    if ! heroku plugins | grep -q integration; then
        echo -e "${YELLOW}Installing Heroku integration plugin...${NC}"
        heroku plugins:install @heroku-cli/plugin-integration
    fi
    echo "✓ Heroku integration plugin installed"
    
    # Check if logged into Heroku
    if ! heroku auth:whoami &> /dev/null; then
        echo -e "${RED}Error: Not logged into Heroku${NC}"
        echo "Run: heroku login"
        exit 1
    fi
    echo "✓ Logged into Heroku as $(heroku auth:whoami)"
    
    # Check if Salesforce org exists
    if ! sf org list --json | jq -r '.result.nonScratchOrgs[].alias' | grep -q "^${SF_ORG_ALIAS}$"; then
        echo -e "${RED}Error: Salesforce org '$SF_ORG_ALIAS' not found${NC}"
        echo "Available orgs:"
        sf org list
        exit 1
    fi
    echo "✓ Salesforce org '$SF_ORG_ALIAS' found"
    
    echo ""
fi

# Step 2: Create .env file
echo -e "${YELLOW}Step 2: Creating .env file...${NC}"
if [[ -f .env ]]; then
    echo -e "${YELLOW}Warning: .env file already exists. Backing up to .env.backup${NC}"
    mv .env .env.backup
fi
touch .env
echo "✓ Created empty .env file"
echo ""

# Step 3: Create Heroku app
echo -e "${YELLOW}Step 3: Creating Heroku app...${NC}"
if [[ -n "$HEROKU_TEAM" ]]; then
    APP_OUTPUT=$(heroku create luminaire-api-$(date +%s) --team "$HEROKU_TEAM" --json)
else
    APP_OUTPUT=$(heroku create luminaire-api-$(date +%s) --json)
fi

APP_NAME=$(echo "$APP_OUTPUT" | jq -r '.name')
if [[ -z "$APP_NAME" || "$APP_NAME" == "null" ]]; then
    echo -e "${RED}Error: Failed to create Heroku app${NC}"
    echo "$APP_OUTPUT"
    exit 1
fi

echo "✓ Created app: $APP_NAME"
echo "APP_NAME=$APP_NAME" >> .env
echo ""

# Step 4: Generate JWT keys
echo -e "${YELLOW}Step 4: Generating JWT keys...${NC}"
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048 2>/dev/null
openssl rsa -pubout -in private.key -out public.key 2>/dev/null
echo "✓ Generated JWT key pair"

echo -e "${YELLOW}Setting keys in Heroku...${NC}"
heroku config:set PRIVATE_KEY="$(<private.key)" PUBLIC_KEY="$(<public.key)" --app "$APP_NAME" >/dev/null
echo "✓ Set JWT keys in Heroku config"
echo ""

# Step 5: Add PostgreSQL
echo -e "${YELLOW}Step 5: Adding PostgreSQL...${NC}"
heroku addons:create heroku-postgresql:essential-0 --app "$APP_NAME" --wait
echo "✓ PostgreSQL addon provisioned"
echo ""

# Step 6: (Optional) Add AI features
if [[ "$ENABLE_AI" == "true" ]]; then
    echo -e "${YELLOW}Step 6: Adding Heroku AI features...${NC}"
    
    # Add Redis
    echo "Adding Redis for chat memory..."
    heroku addons:create heroku-redis:mini --app "$APP_NAME" --wait
    echo "✓ Redis addon provisioned"
    
    # Install AI plugin if needed
    if ! heroku plugins | grep -q "@heroku/plugin-ai"; then
        echo "Installing Heroku AI plugin..."
        heroku plugins:install @heroku/plugin-ai
    fi
    
    # Create AI model
    echo "Creating AI model (this may take a moment)..."
    heroku ai:models:create claude-3-7-sonnet --as inference -a "$APP_NAME"
    echo "✓ AI model created"
    echo ""
else
    echo -e "${YELLOW}Step 6: Skipping AI features (use --enable-ai to include)${NC}"
    echo ""
fi

# Step 7: Fetch all config to local .env
echo -e "${YELLOW}Step 7: Fetching Heroku configuration...${NC}"
heroku config --shell --app "$APP_NAME" >> .env
echo "✓ Fetched all Heroku config to .env"
echo ""

# Step 8: Salesforce configuration
echo -e "${YELLOW}Step 8: Configuring Salesforce integration...${NC}"
echo "SF_ORG_ALIAS=$SF_ORG_ALIAS" >> .env
echo "SF_APP_NAME=$APP_NAME" >> .env
echo "✓ Added Salesforce config to .env"

# Run seed-user script
echo "Running seed-user script..."
./scripts/seed-user.sh "$SF_ORG_ALIAS"
echo ""

# Step 9: Add Heroku Integration addon (AppLink)
echo -e "${YELLOW}Step 9: Adding Heroku Integration addon (AppLink)...${NC}"
heroku addons:create heroku-integration --app "$APP_NAME" --wait
echo "✓ Heroku Integration addon provisioned"
echo ""

# Step 10: Connect Heroku to Salesforce
echo -e "${YELLOW}Step 10: Connecting Heroku to Salesforce...${NC}"
echo "This will open a browser window for OAuth authorization."
echo "Press Enter to continue..."
read -r
heroku salesforce:connect "$SF_ORG_ALIAS" --store-as-run-as-user --app "$APP_NAME"
echo "✓ Connected Heroku app to Salesforce org"
echo ""

# Step 11: Add buildpacks
echo -e "${YELLOW}Step 11: Adding buildpacks...${NC}"
# Node.js buildpack must be added FIRST
heroku buildpacks:add heroku/nodejs --app "$APP_NAME"
echo "✓ Node.js buildpack added"
# Service mesh buildpack wraps the Node.js app
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-heroku-integration-service-mesh --app "$APP_NAME"
echo "✓ Service mesh buildpack added"
echo ""

echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "App Name: $APP_NAME"
echo "App URL: https://$APP_NAME.herokuapp.com"
echo ""
echo -e "${YELLOW}=== NEXT STEPS ===${NC}"
echo ""
echo "Install pnpm if you haven't already:"
echo "    corepack install -g pnpm@latest"
echo ""
echo "Then:"
echo "    pnpm install             # Install dependencies"
echo "    node data/migration.js   # Run database migrations"
echo "    node data/seed.js        # Seed with demo data"
echo "    pnpm run dev             # Run server at http://localhost:3000"
echo ""
echo "Add git remote:"
echo "    git remote add heroku https://git.heroku.com/$APP_NAME.git"
echo ""
echo "Deploy:"
echo "    git push heroku main"
echo ""
echo "Import API spec into Salesforce:"
echo "    ./scripts/applink-api.sh --app $APP_NAME --org $SF_ORG_ALIAS"
echo ""
echo "That's it!"
echo ""
echo "NOTE: See README-DETAILED.md for a complete breakdown of the steps taken by this script."
echo ""
echo "Your .env file has been configured with all necessary variables."