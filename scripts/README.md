# Luminaire Solar API Scripts

This directory contains scripts for development, deployment, and testing of the Luminaire Solar API.

## invoke.sh

The `invoke.sh` script is a utility for testing Salesforce API endpoints locally or in deployed environments.

The Salesforce SDK requires an `x-client-context` header containing authentication and organization details for all API requests. This header is automatically provided by AppLink in production, but needs to be manually constructed during local development and testing. Without this header, the Salesforce endpoints will return errors.

### Purpose

The script helps with:

- Testing Salesforce API endpoints without AppLink during development
- Debugging header-related issues with Salesforce SDK integration
- Validating API responses with proper Salesforce authentication context

### Setup Requirements

Before using the script, you need to:

1. Install the Salesforce CLI:

   ```bash
   npm install -g @salesforce/cli
   ```

2. Log in and create a Salesforce org alias:

   ```bash
   sf org login web --alias my-org
   ```

3. Ensure your API is running (locally or deployed):
   - For local development: Start your API server
   - For deployed API: Get your Heroku app URL with `heroku info`

### Usage

```bash
./invoke.sh <salesforce-org-alias> <api-url> [payload-json] [http-method] [session-based-permission-set] [--auth [token|file]]
```

Parameters:

- `salesforce-org-alias`: Your Salesforce org alias created during setup
- `api-url`: The full API endpoint URL (e.g., http://localhost:3000/api/salesforce/products)
- `payload-json`: JSON payload (required for POST, ignored for GET)
- `http-method`: HTTP method to use (GET or POST) - defaults to GET
- `session-based-permission-set`: [Advanced] Optional Salesforce permission set to activate for this request

Authentication Options:

- `--auth`: Include JWT authentication with the request
  - `--auth` (no argument): Automatically use the `.jwt-token` file in the current directory
  - `--auth <file>`: Use JWT token from the specified file
  - `--auth "<token>"`: Use the provided JWT token directly

### Examples

1. Test a GET endpoint:

   ```bash
   ./invoke.sh my-org http://localhost:3000/api/salesforce/products
   ```

2. Test a POST endpoint with a payload:

   ```bash
   ./invoke.sh my-org http://localhost:3000/api/salesforce/user '{"userId": "123"}' POST
   ```

3. Test a GET endpoint with JWT authentication (using default `.jwt-token` file):

   ```bash
   ./invoke.sh my-org http://localhost:3000/api/salesforce/products --auth
   ```

4. Test a GET endpoint with JWT authentication (using a specific token file):

   ```bash
   ./invoke.sh my-org http://localhost:3000/api/salesforce/products --auth my-token.txt
   ```

5. Test a POST endpoint with JWT authentication:

   ```bash
   ./invoke.sh my-org http://localhost:3000/api/salesforce/user '{"userId": "123"}' POST --auth
   ```

6. Use with the `get-jwt.sh` script:

   ```bash
   # First, get a JWT token
   ./get-jwt.sh http://localhost:3000/api/user/authenticate demo demo

   # Then use it with invoke.sh
   ./invoke.sh my-org http://localhost:3000/api/salesforce/products --auth
   ```

### How It Works

The script:

1. Fetches your Salesforce org details using the Salesforce CLI
2. Constructs the `x-client-context` header with necessary context information for the Salesforce SDK
3. If the `--auth` flag is used, includes a JWT token in the `Authorization` header for authentication
4. Makes the API request with all the required headers
5. Displays the response and HTTP status code

The script handles two different mechanisms:

- **Salesforce Context Header**: Required metadata for Salesforce SDK endpoints (always included)
- **JWT Authentication**: Added with the `--auth` flag for endpoints that require API authentication

This capability is particularly useful for:

- Testing routes that require both the context header and authentication
- Developing and testing in environments where AppLink is not available to automatically provide the context header

## get-jwt.sh

The `get-jwt.sh` script is a companion utility that helps obtain a JWT authentication token for API requests that require standard JWT authentication (rather than the Salesforce context header).

### Purpose

The script helps with:

- Obtaining a JWT token from the authentication endpoint
- Testing user authentication credentials
- Saving the token for use with other API requests

### Usage

```bash
./get-jwt.sh <auth-url> <username> <password>
```

Parameters:

- `auth-url`: The authentication endpoint URL (e.g., http://localhost:3000/api/user/authenticate)
- `username`: The username for authentication
- `password`: The password for authentication

### Examples

1. Get a JWT token for local development:

   ```bash
   ./get-jwt.sh http://localhost:3000/api/user/authenticate demo demo
   ```

2. Get a JWT token for production:
   ```bash
   ./get-jwt.sh https://your-app.herokuapp.com/api/user/authenticate demo demo
   ```

### How It Works

The script:

1. Makes a POST request to the authentication endpoint with the provided credentials
2. Extracts the JWT token from the response
3. Saves the token to a file named `.jwt-token` in the current directory
4. Outputs the token to the console

The saved token can then be used for API requests that require JWT authentication by including it in the Authorization header.

## seed-user.sh

The `seed-user.sh` script is a utility to configure Salesforce org and user details for local development.

### Purpose

The script helps with:

- Extracting Salesforce org ID and user ID from a configured Salesforce org
- Adding these values to your .env file for use by the application
- Enabling proper generation of the required `x-client-context` header for Salesforce API endpoints

### Setup Requirements

Before using the script, you need to:

1. Install the Salesforce CLI:

   ```bash
   npm install -g @salesforce/cli
   ```

2. Log in and create a Salesforce org alias:

   ```bash
   sf org login web --alias my-org
   ```

### Usage

```bash
./seed-user.sh <salesforce-org-alias>
```

Parameters:

- `salesforce-org-alias`: Your Salesforce org alias created during setup

### Examples

1. Configure Salesforce details for local development:

   ```bash
   ./seed-user.sh my-org
   ```

2. After setup, seed the database with a user that includes these details:

   ```bash
   node data/seed.js
   ```

### How It Works

The script:

1. Checks if Salesforce details already exist in your .env file
2. If not, uses the Salesforce CLI to get org details for the provided alias
3. Extracts the org ID and user ID from the CLI response
4. Adds these values to your .env file
5. The seed.js script will then use these values when creating the demo user

This approach enables proper testing of Salesforce endpoints by providing the necessary context information for generating the required `x-client-context` header.

## setup-applink.sh

The `setup-applink.sh` script streamlines the AppLink integration process by fetching OpenAPI documentation and importing it to Salesforce.

### Purpose

The script helps with:

- Fetching OpenAPI YAML from a running API server
- Optionally filtering routes to specific endpoints (e.g., Salesforce-only routes)
- Importing the API specification to Salesforce via Heroku CLI
- Verifying the integration works correctly

### Setup Requirements

Before using the script, you need to:

1. Install the Heroku CLI and integration plugin:

   ```bash
   npm install -g heroku
   heroku plugins:install @heroku-cli/plugin-integration
   ```

2. Install the Salesforce CLI and configure an org alias:

   ```bash
   npm install -g @salesforce/cli
   sf org login web --alias my-org
   ```

3. Connect your Heroku app to Salesforce:

   ```bash
   heroku salesforce:connect my-org
   ```

4. Ensure your API server is running (for fetching the OpenAPI spec):
   ```bash
   npm start
   ```

### Usage

```bash
./scripts/setup-applink.sh [options]
```

Parameters:

- `--server <url>`: API server URL (default: http://localhost:3000)
- `--org <alias>`: Salesforce org alias (default: $SF_ORG_ALIAS or 'demo-org')
- `--app <name>`: App name in Salesforce (default: $SF_APP_NAME or 'LuminaireAPI')
- `--output <file>`: Output YAML file (default: api-docs.yaml)
- `--filter <path>`: Include only routes starting with path (uses generate-api-docs.js)
- `--verify`: Test the integration after import
- `--help, -h`: Show help information

### Examples

1. Basic setup using environment variable defaults:

   ```bash
   ./scripts/setup-applink.sh
   ```

2. Custom org and app name:

   ```bash
   ./scripts/setup-applink.sh --org my-org --app MyAPI
   ```

3. Filter to Salesforce routes only and verify:

   ```bash
   ./scripts/setup-applink.sh --filter /api/salesforce --verify
   ```

4. Use with production server:

   ```bash
   ./scripts/setup-applink.sh --server https://my-app.herokuapp.com
   ```

### Environment Variables

- `SF_ORG_ALIAS`: Default Salesforce org alias
- `SF_APP_NAME`: Default app name for Salesforce
- `SERVER_URL`: Default server URL

### How It Works

The script:

1. Checks that required CLIs (Heroku, Salesforce) and plugins are installed
2. Fetches OpenAPI specification from the running server's `/docs/yaml` endpoint
3. Optionally filters routes using the existing `generate-api-docs.js` script
4. Saves the YAML to a local file (default: `api-docs.yaml`)
5. Imports the API specification to Salesforce using `heroku salesforce:import`
6. Optionally verifies the integration by testing an endpoint with `invoke.sh`

This automation replaces the manual process of:

- Starting the server
- Opening Swagger UI in browser
- Downloading YAML file
- Running Heroku import command manually
