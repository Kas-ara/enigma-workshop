# Enigma Workshop

An interactive historical simulator for the Enigma I, M3 and M4. English is the default language. French and German cover the entire interface and historical timeline. Five dark palettes draw on Germany, Poland, France, the United Kingdom and Norway.

## Run the workshop

With Node.js 22.13+ (22.x) or 24+:

```sh
npm ci
npm run dev
```

For the prebuilt download, serve `dist` directly with Python 3 and open [the local workshop](http://127.0.0.1:8724/):

```sh
python3 -m http.server 8724 --bind 127.0.0.1 --directory dist
```

## Try it

- Pick a machine, then set the rotor order, rings, starting positions, reflector and plugboard. To restore the current machine's original settings, use **Reset defaults**.
- Encrypt the complete message, step one letter at a time, or animate the sequence. Use **Reverse** to run the result again with the original settings. Enigma uses the same operation in both directions.
- Follow **The circuit**, including the entry wheel, reflectors and return path. **Try the double step** sets up an example where the middle rotor advances on two successive keystrokes.
- Choose **2D** for a flat keyboard and lampboard, or **3D** to rotate the machine and lift the rotors with **Exploded view**. If 3D is unavailable, the workshop opens the 2D machine. Both views show the same rotor settings.
- Turn on **Live**, then hold a physical letter key or a key on the 2D machine. The output letter lights until you release the key. Holding a key produces one letter. Use **Esc** to leave Live and return to message controls such as **One letter**.
- In **History**, load the opening of the example from the 1930 manual or a naval M4 message from U-264. Sources are linked from the timeline and listed in [Credits](docs/CREDITS.md).

The editor normalizes letters to A–Z and skips punctuation and digits. Live keeps spaces in both transcripts without stepping the rotors. Text is processed in the browser. Language, palette and the 2D/3D choice are the only persistent preferences. The simulator assumes the starting key is known and processes the body of a message.

## Validate and build

```sh
npm run lint
npm test
npm run build
```

The build can be served from a subdirectory. The GitHub Pages workflow requires the repository to be configured for GitHub Actions as its Pages source and is started manually. Automatic checks lint TypeScript, compile the site and run the tests.

The engine in `src/engine` is independent of the HTML and 3D code. The scene and the circuit use the rotor positions and signal trace it produces. Interface copy lives in `src/i18n` and the localized historical entries in `content/history`.
