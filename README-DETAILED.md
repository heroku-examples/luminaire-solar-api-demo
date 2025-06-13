# Luminaire Solar API - Complete Setup Guide

This guide provides detailed step-by-step instructions for setting up the Luminaire Solar API with all features including Heroku deployment, Salesforce integration, and AppLink configuration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Heroku App Setup](#heroku-app-setup)
4. [Database Configuration](#database-configuration)
5. [Salesforce Integration](#salesforce-integration)
6. [AppLink Configuration](#applink-configuration)
7. [API Documentation & Import](#api-documentation--import)
8. [Service Mesh Configuration](#service-mesh-configuration)
9. [Deployment](#deployment)
10. [Testing & Verification](#testing--verification)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- Node.js LTS (v20.x or higher)
- [pnpm](https://pnpm.io/) (v9.8.0 or higher)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
- PostgreSQL client (`psql`)
- Git

### Optional Software (for AI features)

- [Heroku AI CLI plugin](https://devcenter.heroku.com/articles/heroku-inference#install-the-cli-plugin)
- Redis (for chat memory)

### Required for AppLink Setup

Install the Heroku Integration plugin for AppLink commands:

```bash
heroku plugins:install @heroku-cli/plugin-integration
```

### Accounts Required

- [Heroku account](https://signup.heroku.com/)
- Salesforce org with Agentforce enabled (only if using AppLink/Salesforce integration)
- GitHub account (for deployment)

### Initial Setup

Before starting, log in to Heroku:

```bash
heroku login
```

## Local Development Setup

### Step 1: Install Dependencies

Navigate to the API directory and install dependencies:

```bash
cd luminaire-solar-api-demo
pnpm install
```

### Step 2: Create Environment File

Create an empty `.env` file:

```bash
touch .env
```

**Note:** The `.env.sample` file contains documentation for all possible environment variables. Refer to it as needed but only add variables to your `.env` as you need them.

### Step 3: Generate and Set JWT Keys

Generate authentication keys and set them in Heroku:

```bash
# Generate private key
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048

# Generate public key
openssl rsa -pubout -in private.key -out public.key

# Set the keys in Heroku (this handles the formatting automatically)
heroku config:set PRIVATE_KEY="$(<private.key)" PUBLIC_KEY="$(<public.key)" --app <your-app-name>
```

The keys are now set in Heroku and will be included when you fetch the config in the next step.

## Heroku App Setup

### Step 1: Create a New Heroku App

Create a new Heroku app with a unique name:

```bash
# For personal account:
heroku create luminaire-api-$(date +%s)

# For team account (recommended):
heroku create luminaire-api-$(date +%s) --team <your-team-name>
```

**⚠️ IMPORTANT**: If you have a Heroku team, make sure to include the `--team` flag! Otherwise, the app will be created in your personal account.

This generates a unique app name like `luminaire-api-1734567890`. Note the app name that's created - you'll need it for subsequent steps.

### Step 2: Save App Name to Environment

Edit your `.env` file and set the `APP_NAME` variable to your Heroku app name (just the name, not the URL):

```
APP_NAME=luminaire-api-1748033366
```

For example, if Heroku created `luminaire-api-1748033366`, that's what you'd use (not the full herokuapp.com URL).

## Database Configuration

### Step 3: Add PostgreSQL Addon

Add the Heroku PostgreSQL addon to your app:

```bash
heroku addons:create heroku-postgresql:essential-0 --app <your-app-name>
```

This creates a PostgreSQL database and automatically sets the `DATABASE_URL` environment variable. The addon may take a minute or two to provision.

```
* * * ONLY using Salesforce Agents API? * * *
* * *          Skip to step 6           * * *
```

### Step 4: (Optional) Enable Heroku AI Features

The following steps enable Heroku's AI models for chat functionality. This is separate from and can be used alongside Salesforce Agentforce.

#### Add Redis for Chat Memory

Redis is required for Heroku AI's chat memory feature:

```bash
heroku addons:create heroku-redis:mini --app <your-app-name>
```

#### Add Heroku Inference

Add Heroku's AI model inference capability:

```bash
# Install the AI plugin (requires accepting terms - press 'y' when prompted)
heroku plugins:install @heroku/plugin-ai

# Create the AI model
heroku ai:models:create claude-3-7-sonnet --as inference -a <your-app-name>
```

### Step 6: Fetch Heroku Configuration

After all addons are provisioned, fetch the configuration to your local environment:

```bash
heroku config --shell --app <your-app-name> >> .env
```

This appends all Heroku environment variables to your .env file, including:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (if AI features enabled)
- `INFERENCE_URL`, `INFERENCE_KEY`, `INFERENCE_MODEL_ID` - Heroku AI configuration (if enabled)

At this point, your .env file should contain:

- Your `APP_NAME` set to your Heroku app name
- All Heroku-managed variables (DATABASE_URL, JWT keys, etc.)
- Any optional AI-related variables if you enabled those features

## Salesforce Integration

---

**🎯 OPTIONAL SECTION**  
**If you don't need Salesforce/AppLink integration, you can skip to [Deployment](#deployment)**

---

### Step 7: Login to Salesforce

First, log in to Salesforce and set an org alias:

#### If you're not logged in:

```bash
sf org login web --alias my-org
```

#### If you're already logged in:

```bash
# List all your orgs
sf org list

# Set an alias for an existing org
sf alias set my-org=<username>
```

Replace `<username>` with the value from the Username column in the org list.

### Step 8: Configure Salesforce User

The API needs to associate local demo users with Salesforce org and user IDs to properly handle authentication when requests come through AppLink.

First, add your Salesforce configuration to your .env file:

```bash
echo "SF_ORG_ALIAS=<your-org-alias>" >> .env
echo "SF_APP_NAME=$APP_NAME" >> .env  # Uses your Heroku app name by default
```

Replace `<your-org-alias>` with the alias you just created (e.g., `my-org`).

**Note:** We recommend using the same name as your Heroku app for consistency, but you can change `SF_APP_NAME` to any name you prefer for the Salesforce integration.

Then run the seed-user script:

```bash
./scripts/seed-user.sh $SF_ORG_ALIAS
```

This script performs the following actions:

1. **Validates Salesforce CLI** - Ensures the Salesforce CLI is installed and you're logged in
2. **Fetches org details** - Uses `sf org display` to get information about your Salesforce org
3. **Extracts org ID** - Gets your 18-character Salesforce Organization ID (e.g., `00DKd000008woIdMAI`)
4. **Queries for user ID** - Uses SOQL to find your User ID based on your username
5. **Updates .env file** - Adds these two environment variables:
   - `SF_DEMO_SEED_USER_ORGID` - Your Salesforce Organization ID
   - `SF_DEMO_SEED_USER_USERID` - Your Salesforce User ID

These IDs are critical because when Salesforce makes requests to your API through AppLink, it sends an `x-client-context` header containing the org and user information. The API uses these stored IDs to authenticate and authorize requests.

## AppLink Configuration

AppLink enables Salesforce to securely call your Heroku-hosted API endpoints. This section covers the setup process.

### Step 9: Add Heroku Integration Addon

Add the Heroku Integration addon to enable AppLink:

```bash
heroku addons:create heroku-integration --app <your-app-name> --wait
```

This addon manages the secure connection between Heroku and Salesforce.

### Step 10: Connect Heroku to Salesforce

Now we need to connect your Heroku app to your Salesforce org:

```bash
heroku salesforce:connect <your-org-alias> --store-as-run-as-user --app <your-app-name>
```

For example:

```bash
heroku salesforce:connect luminaire --store-as-run-as-user --app luminaire-api-1748460828
```

This creates a secure connection between your Heroku app and Salesforce org, storing the connection with the "run as user" context.

### Step 11: Add Required Buildpacks

Add the buildpacks needed for AppLink and Node.js:

```bash
# IMPORTANT: Node.js buildpack must be added FIRST
heroku buildpacks:add heroku/nodejs --app <your-app-name>

# Then add the service mesh buildpack (it wraps the Node.js app)
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-heroku-integration-service-mesh --app <your-app-name>
```

**⚠️ CRITICAL**: The buildpack order matters! The Node.js buildpack must be first so it can install Node.js and your dependencies. The service mesh buildpack then wraps your Node.js application to handle AppLink authentication.

---

**🎯 AUTOMATED SETUP AVAILABLE**  
**Steps 1-11 can be automated using: `./scripts/setup.sh --heroku-team <team> --sf-org <org> --enable-ai`**

---

## App Link Setup

### Update Your Procfile

Create or modify your Procfile to use the service mesh:

```
web: APP_PORT=3000 heroku-integration-service-mesh pnpm start
```

Replace `pnpm start` with your application's start command if different (e.g., `npm start`).

## Configuration

## API Documentation Setup

### 1. Create or Update Your API Documentation

You'll need an OpenAPI-compatible YAML file that describes your API endpoints. Here's what to include:

Use standard OpenAPI 3.0.3 format for your API documentation:

1. Basic Structure:

   ```yaml
   openapi: 3.0.3
   info:
     title: Your API Title
     description: Description of your API
     version: '1.0'
   ```

2. Server Configuration:

   ```yaml
   servers:
     - url: http://localhost:5000
       description: Local development server
   ```

3. Tags (for organization):

   ```yaml
   tags:
     - name: YourTagName
       description: Description of this tag group
   ```

4. Endpoint Definitions:
   ```yaml
   paths:
     /api/your-endpoint:
       get:
         tags:
           - your-tag
         description: Description of this endpoint
         responses:
           '200':
             description: Successful response
             content:
               application/json:
                 schema:
                   type: object
                   properties:
                     property1:
                       type: string
   ```

The easiest way to create this file is using your API's Swagger UI. If your API uses Swagger/OpenAPI:

### Obtain API Documentation YAML

If you're using Swagger UI:

1. Start your API server locally
2. Navigate to your Swagger UI endpoint (typically `/docs` or `/swagger`)
3. Find the link to the JSON version of your docs
4. Replace `/json` with `/yaml` in the URL to download the YAML version
5. Save this file as `api-docs.yaml` for use with AppLink

### 4. Import API to Salesforce

```bash
# Import your API documentation to Salesforce
heroku salesforce:import api-docs.yaml --org-name my-org --client-name YourAppName
```

Replace `my-org` with your Salesforce org alias and `YourAppName` with a descriptive name for your service that will appear in Salesforce.

### 5. Verify API Import in Salesforce Interface

Immediately after running the import command, you should verify if the import was successful:

1. Log in to your Salesforce org
2. In the Quick Find box at the top of the Setup menu, type "Heroku"
3. Click "Apps" under the Heroku section
4. You should see the app you imported into Salesforce with the name you provided (e.g., YourAppName)
5. Click the dropdown menu (triangle) next to your app and select "Details"
6. If the import was successful, you'll see all the routes from your YAML file listed
7. If the import failed, you'll see an error message saying "Error encountered while loading" - this indicates your YAML file was incompatible and needs adjustment

## Service Mesh Configuration

### 1. Create a Service Mesh Configuration File

Create a file named `heroku-integration-service-mesh.yaml` in your project root with the following structure:

```yaml
mesh:
  authentication:
    bypassRoutes:
      - /api/your-endpoint
      - /api/another-endpoint/:paramName
      - /healthcheck
```

This configuration lists routes that should bypass authentication when called through AppLink. Include all routes that will be used by Salesforce.

### 2. Deploy Your Application

```bash
# Deploy your application to Heroku
git add .
git commit -m "Configure AppLink integration"
git push heroku master
```

## Verification and Testing

### 1. Test Deployment

After deploying your application with the service mesh configuration, verify that your API is accessible through Heroku and that the service mesh is properly configured by checking the logs:

```bash
heroku logs --tail
```

Look for messages indicating successful initialization of the service mesh and proper handling of API requests.

### 2. Test with Apex Code

1. In Quick Find menu, type "Apex Test Execution" and click on it.
2. Click "Developer Console"
3. Click "Debug" > "Open Execute Anonymous Window"
4. Copy and paste the following code, substituting "YourAppName" with the name you used when importing:

```java
ExternalService.YourAppName service = new ExternalService.YourAppName();
service.yourApiEndpointMethod();
```

Click "Execute" to run the code.

If the code runs successfully, you'll see the response from your API endpoint in the Developer Console output window and in your Heroku logs.

### 3. Test Locally with the invoke.sh Script

You can use the `invoke.sh` script to test your AppLink endpoints locally:

```bash
# Basic usage:
./scripts/invoke.sh my-org http://localhost:3000/api/your-endpoint "{}"

# With authentication:
./scripts/invoke.sh my-org http://localhost:3000/api/your-endpoint "{}" --auth
```

The script will:

1. Fetch your Salesforce organization context
2. Create the required `x-client-context` header
3. Send a request to your API endpoint
4. Display the response

## Troubleshooting

### Heroku App Crashes After Deployment

If your app crashes immediately after deployment with errors like:

```
Error executing command: exec: not started
```

This is likely a buildpack ordering issue. Check your logs:

```bash
heroku logs --tail --app <your-app-name>
```

To fix buildpack ordering:

```bash
# Clear all buildpacks
heroku buildpacks:clear --app <your-app-name>

# Add them in the correct order (Node.js FIRST!)
heroku buildpacks:add heroku/nodejs --app <your-app-name>
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-heroku-integration-service-mesh --app <your-app-name>

# Verify the order
heroku buildpacks --app <your-app-name>

# Deploy again
git push heroku main
```

### x-client-context Header Errors Locally

If you get a 401 in production or see errors from the server about missing `x-client-context` headers when running locally:

```
ERROR: Required x-client-context header not found
```

This typically happens when:

1. In production: You aren't authenticated by AppLink and ServiceMesh is blocking you from the route you're trying.
2. Testing Salesforce routes (e.g., `/salesforce/*`) without the proper headers
3. A route has Salesforce configuration but shouldn't require the header

### For local testing of Salesforce routes:

Use the `get-jwt.sh` script and `api/user/authenticate` with demo credentials to get a token so you can make requests:

```bash
./scripts/get-jwt.sh http://localhost:3000/api/user/authenticate demo demo
```

This will save a jwt locally which will be used by the `invoke.sh` script to properly add the required headers:

```bash
./scripts/invoke.sh my-org http://localhost:3000/salesforce/products
```

### AppLink Import Failures

If the API import to Salesforce fails:

1. Ensure your server is running locally before running `./scripts/applink-api.sh`
2. Check that your OpenAPI spec is valid at `http://localhost:3000/api-docs/yaml`
3. Verify your Salesforce connection: `heroku salesforce:auth:list --app <your-app-name>`
4. Check Heroku logs with `heroku logs --tail` and see "Heroku App Crashes After Deployment" above if you see crashes

**Tip**: You can directly access the OpenAPI YAML specification at `http://localhost:3000/api-docs/yaml` instead of navigating through the Swagger UI.

### Making Changes in AgentBuilder and/or Luminiare Solar API Definition

If you have modified the **Agent, Topics or created new Actions** within the Salesforce Setup UI run `/scripts/agentforce.sh retrieve <your-org-alias>`. This will download in metadata form the latest changes in to the `/agentforce` folder. Review the files fully before committing.

If you have modified the **Luminiare Solar API**, specifically operations used by Agentforce Actions, you will need to remove the Agentforce Configuration from the org using `/scripts/agentforce.sh delete <your-org-alias>` (be sure to run the above retrieve before hand if needed) before reimporting the Heroku application per the instructions above. Once you have reimported use `/scripts/agentforce.sh deploy <your-org-alias>` to reapply the Agentforce configuration.

**Tip**: If you have changed operation, or parameter names, the `agentforce.sh deploy` will fail. In this case review the metadata files and make changes to directly to them to adjust names and referneces. If you have added a new operation, it is recommended after deploying the prior configuraiton, you use the Agentforce Actions UI to create your action then retrieve the metadata.
