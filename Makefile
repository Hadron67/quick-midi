all: dist/quick-midi.js

dist/quick-midi.js: src/*.ts rollup.config.js
	rollup -c

dist/quick-midi.min.js: dist/quick-midi.js
	uglifyjs --compress --mangle -o $@ -- $< 

min: dist/quick-midi.min.js

clean:
	$(RM) dist/*

test:
	mocha tests/

sandwich:
	@[ "`whoami`" = "root" ] && echo "Okay." || echo "What? Make it yourself."

publish: min dist/quick-midi.js
	npm publish

.PHONY: clean sandwitch test min publish