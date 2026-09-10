#!/usr/bin/env bash

# get current branch
branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $branch"
git pull origin $branch
