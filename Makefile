PROJECT = altpro
SRC = index.js lib/*.js

all: check compile

compile: build/build.js

build:
	mkdir -p $@

build/build.js: $(SRC) | build node_modules
	browserify \
		--debug \
		--require ./index.js:$(PROJECT) \
		--outfile build/build.js

node_modules: package.json
	yarn && touch $@

clean:
	rm -fr build

distclean: clean
	rm -rf node_modules

check: lint

lint:
	./node_modules/.bin/jshint *.js lib test

test:
	./node_modules/.bin/mocha --recursive --require should

.PHONY: check lint test check compile
