# Luminaire Solar - API

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Requirements

- Node.js LTS (>v20.x)
- [pnpm](https://pnpm.io/) (> 9.8.0)
- An [Heroku](https://signup.heroku.com/) account
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- PostgreSQL [psql](https://www.postgresql.org/download/) client

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

Once the PostgreSQL database is created, setup the database schema with:

```sh
heroku pg:psql -f data/schema.sql
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

## Manual Deployment

To manually deploy to Heroku you can run:

```sh
git push heroku main
```
