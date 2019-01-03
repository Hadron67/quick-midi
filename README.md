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

More examples are in the `examples/` directory.

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
Directives are started by `\`, as TeX does. When a track or voice appears for the first time, they'll be created, and when they
appear again later in the input, the content will be appended to the existing one. This allows one to seperate a track or voices 
into several parts, making the input more readable.

For simplicity, the beginning directives, i.e. `\track` and `\v`, of the first track of the input and first voices of a track can be omitted, in which case their names will be assigned as `Track 1` and `1` respectively. Thus a single sequence input is legal, as the above examples do.

### Note sequences and modifiers
Basically, the note sequence consists of sound notes and directives. Each notes could be followed by some modifiers, modifying
their tone and durations. A **note** is a number 0 to 7, where `0` represents musical rest, 1 to 7 corresponds to musical notes
in diatonic major scale. As numbered musical notation does, the notation uses a movable Do system, in which case the pitch of the 
note `1` is **C4** by default, and can be redefined by directives (see below). With no modifiers, all notes are quater notes. 

Modifiers