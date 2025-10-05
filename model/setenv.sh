#!/usr/bin/env bash

# Définition des variables d’environnement (correct pour Flask)
export FLASK_APP="src.app"
export FLASK_ENV="development"
export FLASK_DEBUG=0

# Affichage dans le style que tu veux
echo "FLASK_APP = ${FLASK_APP}"
echo "FLASK_ENV = ${FLASK_ENV}"
echo "FLASK_DEBUG = ${FLASK_DEBUG}"
echo "In folder $(pwd)"

flask run