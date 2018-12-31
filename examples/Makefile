FILES = $(wildcard *.txt)
MIDIS = $(FILES:%.txt=%.mid)
QMIDI = ../bin/quick-midi

all: $(MIDIS)

%.mid: %.txt
	$(QMIDI) -f $< -o $@

clean:
	$(RM) $(MIDIS)

.PHONY: all clean