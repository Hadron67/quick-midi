#Quick-midi
Creating MIDI files from a notation based on [numbered musical notation](https://en.wikipedia.org/wiki/Numbered_musical_notation) and TeX.

The original idea comes from a Mathematica program that generates and plays a sequence of note from a given input string with a 
similiar syntax, I found it on a BBS a long time ago but I can't find it anymore, so I'd like to credit its author here.

## Usage
```sh
quick-midi <input> [options]
```
Or
```sh
quick-midi -f <input file> [options]
```
The syntax of `<input>` and `<input file>`'s content is explained below.

## Notation
Here are some examples:

The well-known nursery song Frère Jacques:
```
1231 1231 345- 345- {5654}_31 {5654}_31 15.1- 15.1-
```

A fragment of Cannon in C:
```
5{34}_5{34}_ {55.6.7.1234}_ 3{12}_3{3.4.}_ {5.6.5.4.5.17.1}_ 6.{17.}_6.{5.4.}_ {5.4.3.4.5.6.7.1}_ 6.{17.}_1{7.6.}_ {7.1217.16.7.}_ 1---
```

Happy new year
```
1
```

### Structure
The input consists several tracks, each track consists several voices, and the voices are sequences of sound notes. Tracks and 
voices are indicated by directives, specifying their names.
```
\track{<track's name>}
\v{<voice's name>} ... <note sequence> ...
\v{<voice's name>} ... <note sequence> ...

\track{<track's name>}
\v{<voice's name>} ... <note sequence> ...
\v{<voice's name>} ... <note sequence> ...

...
```
When a track or voice appears for the first time, they'll be created, and when they appear again later in the input, the content
will be appended to the existing one. This allows one to seperate a track or voices into several parts, making the input more
readable.

For simplicity, the first track of the input and first voices of a track can appear directly, without `\v` or `\track` directive, 
in which case their names will be assigned as `Track 1` and `1` respectively. Thus a single sequence input is legal.

### Note sequences and modifiers
Basically, the note sequence consists of sound notes and directives. Each notes could be followed by some modifiers, modifying
their tone and durations.