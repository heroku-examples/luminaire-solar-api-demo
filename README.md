# Luminaire Solar - API

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Requirements

- Node.js LTS (>v20.x)
- [pnpm](https://pnpm.io/) (> 9.8.0)
- An [Heroku](https://signup.heroku.com/) account
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- PostgreSQL [psql](https://www.postgresql.org/download/) client
- Redis server (for chat memory)

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
 heroku addons:create heroku-postgresql:essential-0
```

Install the [Heroku Redis addon](https://elements.heroku.com/addons/heroku-redis):

```sh
heroku addons:create heroku-redis:mini
```

Once the PostgreSQL database is created, setup the database schema with:

```sh
node data/migration.js
```

Make sure to fetch the database configuration to your local project by running:

```sh
heroku config --shell > .env
```

Seed the database with mock data by running:

```sh
node data/seed.js
```

Run the project locally with:

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
