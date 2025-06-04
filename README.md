# Luminaire Solar - API

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

> **Related Repository**: [Luminaire Solar UI Demo](https://github.com/heroku-examples/luminaire-solar-ui-demo)

A demo API showcasing Heroku features including PostgreSQL, Redis, AI inference, and Salesforce integration via AppLink.

## Quick Start

Use the automated setup script for the fastest deployment:

```bash
# Basic setup (Salesforce only, no AI)
./scripts/setup.sh --sf-org my-org

# Setup with Heroku team (no AI)
./scripts/setup.sh --heroku-team my-team --sf-org my-org

# Full setup (with AI features)
./scripts/setup.sh --heroku-team my-team --sf-org my-org --enable-ai
```

> **Note**: For detailed manual setup instructions, see [README-DETAILED.md](README-DETAILED.md)

## Requirements

- Node.js LTS (v20+)
- [pnpm](https://pnpm.io/) (v9.8.0+)
- [Heroku account](https://signup.heroku.com/) and [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (for AppLink integration)
- PostgreSQL client (optional, for local development)

## What the Setup Script Does

The `setup.sh` script automates the initial Heroku and Salesforce setup process:

1. Creates a new Heroku app with unique timestamp naming
2. Generates and configures JWT authentication keys
3. Provisions PostgreSQL database
4. (Optional) Adds Redis and Heroku AI for chat features
5. Configures Salesforce integration and AppLink
6. Sets up all required buildpacks
7. Creates a complete `.env` file with all configurations

## Local Development

Install pnpm if you haven't already:

```sh
corepack install -g pnpm@latest
```

> [!NOTE]
> If `corepack` is not installed you can run `npm install -g corepack`

> [!WARNING]
> Don't mix `pnpm` and `npm`, `pnpm` is more performant and has better cache

## After running the setup script:

```sh
pnpm install             # Install dependencies
node data/migration.js   # Run database migrations
node data/seed.js        # Seed with demo data
pnpm run dev             # Start development server
```

The API will be available at `http://localhost:3000`

## Deployment

After setup is complete:

```sh
# Add git remote (if not already added)
git remote add heroku https://git.heroku.com/<your-app-name>.git

# Deploy to Heroku
git push heroku main

# Import API specification to Salesforce
./scripts/applink-api.sh --app <your-app-name> --org <your-sf-org>
```

## API Documentation

Once deployed, visit `/docs` to see the interactive Swagger documentation for all available endpoints.

## Local Database Setup

For local development without Heroku, you can use local databases:

1. Install and start PostgreSQL locally

   - Create a database for the application

2. Install and start Redis locally

   - Redis should be running on the default port (6379)

3. Create a local `.env` file with your development settings:

   ```sh
   cp .env.sample .env
   ```

4. Update the `.env` file with your local database and Redis connection strings:

   ```
   DATABASE_URL=postgres://username:password@localhost:5432/yourdatabase
   REDIS_URL=redis://localhost:6379
   ```

5. Generate JWT keys for authentication (as described in the Environment Variables section)

6. Run the database migration and seed scripts:

   ```sh
   node data/migration.js
   node data/seed.js
   ```

7. Start the development server:
   ```sh
   pnpm run dev
   ```

## Environment Variables

The setup script automatically configures all required environment variables. For manual configuration or customization, refer to [.env.sample](.env.sample).

Key environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional, for AI features)
- `PRIVATE_KEY` / `PUBLIC_KEY` - JWT authentication keys
- `INFERENCE_*` - Heroku AI configuration (when AI is enabled)
- `SF_*` - Salesforce integration settings

## Additional Resources

- [README-DETAILED.md](README-DETAILED.md) - Complete manual setup guide with detailed explanations
- [API Documentation](/docs) - Interactive Swagger UI (when running)
- [Heroku Dev Center](https://devcenter.heroku.com/) - Heroku platform documentation
- [Salesforce Developer](https://developer.salesforce.com/) - Salesforce integration resources
