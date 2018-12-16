// Oh, well, to make life easier, I don't want to use Typescript, just plain javascript, with JSDoc comments. :)
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'typescript';
import ts from 'rollup-plugin-typescript2';

export default [{
    input: 'src/main.ts',
    output: {
        file: 'dist/quick-midi.js',
        format: 'umd',
        name: 'qmidi',
        sourcemap: true
    },
    plugins: [
        sourcemaps(),
        ts({
            typescript: typescript
        })
    ]
}]