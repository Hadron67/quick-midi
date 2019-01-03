FILES = $(wildcard *.txt)
MIDIS = $(FILES:%.txt=%.mid)
QMIDI = ../bin/quick-midi

all: $(MIDIS)

%.mid: %.txt ../dist/quick-midi.js ../bin/cli.js
	$(QMIDI) -f $< -o $@

clean:
	$(RM) $(MIDIS)

.PHONY: all clean