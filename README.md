# Velius

**Public access. Private ownership.**

[![Live site](https://img.shields.io/badge/live-velius.fun-red)](https://velius.fun)
![Chain](https://img.shields.io/badge/chain-Solana-blueviolet)

- **Chain:** Solana mainnet (RPC: `https://solana-rpc.publicnode.com`)
- **Contract address:** `CA: not stated yet` (placeholder; the page renders a blank, unclickable slot until the register states it)

## Overview

Velius is a single-page site for a Solana token. A pinned strip at the top carries the contract address, the header carries the social links, and a live market board lists the loudest Solana tokens with a reserved first row for Velius.

## Features

- Pinned contract-address slot: full address, large type, click to copy with visible feedback; inert while the address is unstated.
- Live market board from DexScreener: top 10 Solana boosts, per-token pair data, skeleton loaders, exponential backoff, last-good data kept on failure, 60 s polling that pauses while the tab is hidden.
- Own-token row pinned at #1: reads DexScreener and pump.fun in parallel once the address is stated; brand-logo placeholder with a pulse while it is not.
- Spring-physics scroll reveals, parallax hero, scroll progress bar, spotlight hover, count-up values with change flash, live status pill.
- Full reduced-motion fallback.

## Links

- Site: https://velius.fun
- X: https://x.com/veliusfun
- GitHub: not stated yet
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Develop

```
npm run build     # src/ -> dist/ (also runs the build gates)
npm run preview   # serve dist/ on http://localhost:4173
npm run verify    # build + prove both CA branches
```

External facts live in `src/js/register.js`; colour literals live only in `src/css/tokens.css`.
