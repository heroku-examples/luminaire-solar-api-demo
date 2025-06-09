#!/bin/bash

ACTION=$1
ORG_ALIAS=$2
SOURCE_DIR="agentforce"
MANIFEST_DIR=".tmp_manifest"
API_VERSION="63.0"

# Metadata types to retrieve/delete
METADATA_TYPES=(
  "GenAiFunction"
  "GenAiPlugin"
  "GenAiPlanner"
)

if [[ -z "$ACTION" || -z "$ORG_ALIAS" ]]; then
  echo "Usage: $0 [retrieve|deploy|delete] [org-alias]"
  exit 1
fi

# Prepare repeated --metadata flags
METADATA_ARGS=()
for TYPE in "${METADATA_TYPES[@]}"; do
  METADATA_ARGS+=(--metadata "$TYPE")
done

case "$ACTION" in
  retrieve)
    echo "🔄 Retrieving GenAI metadata from org '$ORG_ALIAS'..."
    sf project retrieve start --target-org "$ORG_ALIAS" "${METADATA_ARGS[@]}"
    ;;

  deploy)
    echo "🚀 Deploying GenAI metadata to org '$ORG_ALIAS'..."
    sf project deploy start --target-org "$ORG_ALIAS"
    ;;

  delete)
    echo "🛠 Generating destructive manifest from '$SOURCE_DIR'..."
    rm -rf "$MANIFEST_DIR"
    mkdir -p "$MANIFEST_DIR"

    sf project generate manifest \
      --source-dir "$SOURCE_DIR" \
      --type destroy \
      --output-dir "$MANIFEST_DIR"

    if [[ ! -f "$MANIFEST_DIR/destructiveChanges.xml" ]]; then
      echo "✅ No deletable metadata found in '$SOURCE_DIR'. Nothing to delete."
      exit 0
    fi

    echo "📄 Creating minimal package.xml..."
    cat > "$MANIFEST_DIR/package.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <version>$API_VERSION</version>
</Package>
EOF

    echo "🚨 Deleting GenAI metadata from org '$ORG_ALIAS'..."
    sf project deploy start \
      --target-org "$ORG_ALIAS" \
      --manifest "$MANIFEST_DIR/package.xml" \
      --pre-destructive-changes "$MANIFEST_DIR/destructiveChanges.xml"

    rm -rf "$MANIFEST_DIR"
    echo "✅ Deletion complete."
    ;;

  *)
    echo "❌ Invalid action: $ACTION. Use retrieve, deploy, or delete."
    exit 1
    ;;
esac
