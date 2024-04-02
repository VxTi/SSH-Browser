#!/bin/bash

args=("$@");
argLen=("$#");

os=

function contains() {
  for i in $1; do
    if [ "$i" == "$2" ]; then
      return 0;
    fi
  done
  return 1;
}
