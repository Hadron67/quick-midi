all: dist/quick-midi.js

dist/quick-midi.js: src/*.ts
	rollup -c

clean:
	$(RM) dist/*

sandwitch:
	@[ "`whoami`" = "root" ] && echo "Okay." || echo "What? Make it yourself."

.PHONY: clean sandwitch