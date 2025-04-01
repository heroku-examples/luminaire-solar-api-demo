# Create api service app
heroku create demo-luminaire-api --team luminaire-inc

# Add service addons
heroku addons:create heroku-redis:mini
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-inference:claude-3-5-sonnet-latest --as inference
heroku addons:attach $(heroku addons --json | jq -r '.[] | select(.addon_service.name == "heroku-inference") | .name') -a mia-python-runner

# Configure environment
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048 && openssl rsa -pubout -in private.key -out public.key
heroku config:set PRIVATE_KEY="$(<private.key)" PUBLIC_KEY="$(<public.key)" APP_NAME=demo-luminaire-api PYTHON_RUNNER=mia-python-runner DATABASE_ATTACHMENT="DATABASE"

# Initialize the database
heroku config --shell > .env && pnpm install && node data/migration.js && node data/seed.js 

# Deploy the app and run it
git push heroku main
heroku open
