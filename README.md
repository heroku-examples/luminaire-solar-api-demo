# Luminaire Solar - API

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Requirements

- Node.js LTS (>v20.x)
- [pnpm](https://pnpm.io/) (> 9.8.0)
- An [Heroku](https://signup.heroku.com/) account
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- PostgreSQL [psql](https://www.postgresql.org/download/) client
- Redis server (for chat memory)
- [Heroku AI CLI](https://devcenter.heroku.com/articles/heroku-inference#install-the-cli-plugin)
- Heroku Managed Inference and Agents [MIA](https://elements.heroku.com/addons/heroku-inference)

## Installation

Install pnpm

```sh
corepack install -g pnpm@latest
```

> [!NOTE]
> If `corepack` is not installed you can run `npm install -g corepack`

Install dependencies by running:

> [!WARNING]
> Don't mix `pnpm` and `npm`, `pnpm` is more performant and have better cache

```sh
pnpm install
```

Create an Heroku application with:

```sh
heroku create <app-name>
```

Install the [Heroku PostgreSQL addon](https://elements.heroku.com/addons/heroku-postgresql):

```sh
 heroku addons:create heroku-postgresql:essential-0 --app <your-heroku-app-name>
```

Install the [Heroku Key-Value Store addon](https://elements.heroku.com/addons/heroku-redis):

```sh
heroku addons:create heroku-redis:mini --app <your-heroku-app-name>
```

Install the [Heroku Inference addon](https://elements.heroku.com/addons/heroku-inference)

> [!NOTE]
> Make sure the Heroku AI CLI plugin is installed with `heroku plugins:install @heroku/plugin-ai`

```sh
heroku ai:models:create claude-3-7-sonnet --as inference -a <your-heroku-app-name>
```

Make sure to fetch the configuration to your local project by running:

```sh
heroku config --shell --app <your-heroku-app-name> > .env
```

Once the environment variables are set up, setup the database schema with:

```sh
node data/migration.js
```

### Salesforce Integration (Optional)

If you plan to use the `/api/salesforce` routes, you need to configure Salesforce credentials for the demo user:

1. Install the Salesforce CLI:

   ```sh
   npm install -g @salesforce/cli
   ```

2. Log in to your Salesforce org:

   ```sh
   sf org login web --alias my-org
   ```

3. Run the seed-user script to extract Salesforce org ID and user ID:

   ```sh
   ./scripts/seed-user.sh my-org
   ```

This will add the necessary Salesforce credentials to your `.env` file.

Then seed the database with mock data by running:

```sh
node data/seed.js
```

> [!NOTE]
> If you don't configure Salesforce credentials, the API will still work for non-Salesforce routes, but `/api/salesforce` endpoints will not function correctly.

Run the project locally with:

```sh
pnpm run dev
```

## Local DB Setup

Alternatively, you can use local dev databases:

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

Before running the project, you need to set up the environment variables.

> [!NOTE]
> For a complete list of required environment variables, please refer to the [sample .env file](.env.sample) included in the repository.

For JWT authentication you need a public/private key pair. You can generate these keys using OpenSSL by running:

1.

```sh
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048
```

2.

```sh
openssl rsa -pubout -in private.key -out public.key
```

These commands will create two files (private.key and public.key) in your repository with the values stored inside.

## Manual Deployment

To manually deploy to Heroku you can run:

```sh
git push heroku main
```
