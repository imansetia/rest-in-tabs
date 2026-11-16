# Rest in Tabs

Chrome/Edge extension that buries idle tabs in a spooky graveyard and lets you resurrect them in one click. Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Costume Contest).

Status: project scaffold only. The spec lives in [.kiro/specs/rest-in-tabs](.kiro/specs/rest-in-tabs).

## Build

Requires Node.js 20 or later.

```
npm install
npm run build
npm test
```

## Load the extension

1. Run `npm run build`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the `dist` folder.

## License

[MIT](LICENSE)
