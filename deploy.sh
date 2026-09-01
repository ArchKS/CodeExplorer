#!/bin/bash

TIME_FORMAT="%Y-%m-%d %H:%M:%S"
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Auto commit: $(date +"$TIME_FORMAT")"
fi


npm run publish
git add . 
git commit -m "$COMMIT_MSG"
git push 