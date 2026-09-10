#!/usr/bin/env bash

# get current branch
branch=$(git rev-parse --abbrev-ref HEAD)
git pull origin $branch
