#!/bin/bash
# Script to clone the repository and create matrix package.json files

set -e

REPO_URL="https://github.com/your-repo-url"
MATRIX_CONFIG_FILE="dependency-matrix.yml"

# Clone the repository
if [ -d "escashop" ]; then
  echo "Repository already cloned"
else
  git clone $REPO_URL escashop
fi

cd escashop

yq e '.test_matrices | with_entries(.value |= .combinations)' $MATRIX_CONFIG_FILE |
  jq -r '.[] | .[] | .name as $matrix_name | ($matrix_name, .frontend, .backend, .node_version) | @csv' |
  while IFS=',' read -r MATRIX_NAME FRONTEND BACKEND NODE_VERSION; do
    echo "Creating package.json for $MATRIX_NAME"
    
    # Create JSON strings from YAML data
    FRONTEND_JSON=$(echo $FRONTEND | yq -o=json)
    BACKEND_JSON=$(echo $BACKEND | yq -o=json)

    echo "{
      \"name\": \"escashop-$MATRIX_NAME\",
      \"version\": \"1.0.0\",
      \"private\": true,
      \"workspaces\": [\"backend\", \"frontend\"],
      \"scripts\": { "start": "npm run start --workspace=\
