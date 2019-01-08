# Quick-midi


Creating MIDI files from a notation based on [numbered musical notation](https://en.wikipedia.org/wiki/Numbered_musical_notation) and TeX.

[![npm version](https://img.shields.io/npm/v/pnpm.svg)](https://www.npmjs.com/package/quick-midi)

[中文README](README_zh_CN.md)

The original idea comes from a Mathematica program that generates and plays a sequence of note from a given input string with a similiar syntax, since numbered musical notation can be expressed easily using ASCII string. One of my friends found it on a BBS a long time ago but I can't find it anymore, so I'd like to credit its author here.

Currently, the output MIDI file has format 1.

## Usage
```sh
quick-midi <input> [options]
```
Or
```sh
quick-midi -f <input file> [options]
```
The syntax of input and input file's content is explained below.

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
The input consists several **tracks**, each track consists several **voices**, and the voices are sequences of sound notes. Tracks and voices are indicated by directives, specifying their names.
```
[file options]
\track{<track's name>}
[track options]
\v{<voice's name>} ... <note sequence> ...
\v{<voice's name>} ... <note sequence> ...

\track{<track's name>}
\v{<voice's name>} ... <note sequence> ...
\v{<voice's name>} ... <note sequence> ...

...
```
Directives are started by `\`, as TeX does. Each track is an individual channel. When a track or voice appears for the first time, they'll be created, and when they appear again later in the input, the content will be appended to the existing one. This allows one to seperate a track or voices into several parts, making the input more readable.

The file options and track options sections are optional directives that define various properties of the MIDI file or track.

For simplicity, the beginning directives, i.e. `\track` and `\v`, of the first track of the input and first voices of a track can be omitted, in which case their names will be assigned as `Track 1` and `1` respectively. Thus a single sequence input is legal, as the above examples do.

### Note sequences and modifiers
Basically, the note sequence consists of sound notes, groups, and directives. Each notes could be followed by some modifiers modifying their pitches and durations. A **note** is a number 0 to 7, where `0` represents musical rest, 1 to 7 corresponds to musical notes in diatonic major scale. As numbered musical notation does, the notation uses a movable Do system, in which case the pitch of the note `1` is determined by key signature. Key signature is C major by default, that is 1 = C4, and can be redefined by directives (see below). With no modifiers, all notes are quater notes. 

Modifiers come after a note. A `_` halves the notes' duration, n consecutive `-`s extends the notes' length by n times, and n consecutive `*`s extends them by (1 - 1 / 2^n) times. These three modifiers act just as dashes, underscores, and dots in the standard numbered musical notation. In order to express n-tuple, there's one more modifier, `/`, n consecutive `/`s divides the length by (n + 1). If more than one modifiers are present, their total effect on the length of the note is the product of each modifier. Here are some examples:
* Whole note: 1---
* Half note: 1-
* Dotted half note: 1-- or 1-*
* Quarter note: 1
* 3-tuple: 1// 2// 3//
* Dotted quarter note: 1*
* Eighth note: 1_
* 16th note: 1__

Notes' length are represented by an integer, the ticks. For a quarter note, this value equals to the MIDI file's **division**,which is 96 by default, and can be redefined by `\div` (see below). When a note's length reaches the lower limit 1 or upper limit 0x7fffffff (although this hardly happen), it will be cut off at the limit value. In order to avoid this you should adjust the division value to fit your need.

Another type of modifier changes note's pitch. `'` and `.` raise or lower the note by one octave, `#` (sharp) and `b` (flat) raise or lower it by one semitone. Multiple modifiers of this type affects the note by their sum. The lowest and highest tone allowed by MIDI is C-1 (`1.....` in C major) and G9 (`5'''''` in C major), and will also be cut off when the tone reaches them.

The velocity value that each note will be assigned when they are created is 80 by default, can be changed by `\vel` (see below).

Bar lines `|` can appear anywhere in the sequence and has no semantic meaning, they are just for readability.
### Groups
Groups are also an element of a sequence. A group is a series of sequences seperated by `,` and enclosed by `{}`:
```
{ <sequence> [, <sequence>]* }
```
The sequences within a group can be thought as belong to different voices and start simutaneously in the timeline, this provides a simple way to express chords. For example, a C chord is `{1,3,5}`. The length of a group is determind by the longest sequence.

Groups can also be followed by modifiers, in this case the modifiers will effect all the notes in this group one by one. For example, `{1231}_` is equivalent to `1_2_3_1_`.

Groups are also a scope of certain directives (see below).

### Directives
Syntax of directives are similiar to that of TeX, in which case the argument of a directive can either be a single character or a string enclosed by curly braces. So you should enclose arguments that has more than one character by a pair of curly brace, such as `\bpm{200}` instead of `\bpm 200`.

Effects of some directives are scoped, i.e., when leaving a scope certain values will be reseted to the parent scope's. Components that will cause the directives to enter a new scope are groups and voices. Note that a voice of a track is one single scope even if it divided into parts. For example, in the following input
```
\v{1} \vel{100} 1
\v{2} \vel{70}  1.

\v{1} ... 2
\v{2} ... 2.
```
the notes `1` and `2` has velocity 100, while `1.` and `2.` has 70.

Directives can appear in the file options section, track options section, and in the sequences. Directive usages and their functions are shown below:
* `\tempo <tempo value>`: Set tempo value, i.e., milliseconds per quater note. Can appear both in file options section and sequence. This directive will emit a set tempo meta-event.
* `\bpm <bpm>`: Set tempo value by specifying beats per minute. This is an alternative and preferred way to set tempo value.
* `\track <name>`: Start sequencing a track with name given by the argument. The track will be created if doesn't exists.
* `\v <name>`: Start sequencing a voice in a track. The voices will be created if doesn't exists.
* `\instrument <instrument number>`: Set/change instrument of a track, this can appear in the track options section or in a sequence, and will emit a program (instrument) change event. The map that relates instrument number and instrument can be found at [MIDI file specification](http://www.music.mcgill.ca/~ich/classes/mumt306/StandardMIDIfileformat.html).
* `\times <numerator> <denominator>`: Set/change time signature, can appear in file options section and sequences. This directive will emit a time signature meta-event, maybe useful when importing the MIDI file to other softwares, but has no effect on playback.
* `\div <division>`: Set division of quarter note. Can only appear in file options section.
* `\major <key name>`, `\minor <key name>`: Set/change key signature by specifying major key name or minor key name, can appear in file options section or in the sequences. The sharp or flat symbol should come after the key name. This directive not only emits a key signature meta-event, but also changes the pitch of 1, effects all note that follows the directive in current scope.
* `\vel <velocity>`: Change velocity value given to each note when they are created in current scope.

### Macros
Just as in TeX, you can define macros everywhere in the input with `\def`. But since `#` is already taken as pitch modifier, `$` is used instead as the macro parameter character. In case of you are not familiar with TeX, the syntax is `\def\<macro name><parameter list>{<macro content>}`, where macro name may **only** contain letters, and parameter list is a string containing macro parameters. Here is an example of using macros: 
```
\def\repeat$1{$1$1}

1155665 4433221 \repeat{5544332}
```
The output sequence should be 1155665 4433221 5544332 5544332.

## License
MIT.