PROJECT = altpro
SRC = index.js lib/*.js

all: check compile

compile: build/build.js

build:
	mkdir -p $@

build/build.js: $(SRC) | build node_modules
	node_modules/.bin/esbuild \
		--bundle \
		--define:DEBUG="true" \
		--global-name=$(PROJECT) \
		--outfile=$@ \
		index.js

node_modules: package.json
	yarn
	touch $@

clean:
	rm -fr build

distclean: clean
	rm -rf node_modules

check: test lint

lint:
	./node_modules/.bin/biome ci

format:
	./node_modules/.bin/biome check --fix

test:
	node --require jsdom-global/register --test

.PHONY: check lint test check compile
