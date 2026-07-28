# BrowserQuest Ato Capsule

This capsule preserves Mozilla BrowserQuest at upstream commit
`af32d247cac3495ca430d0effbb88dd5f3250b2c` and opens directly into a live
game as **Ato Explorer**.

The original 2012 WebSocket transport was updated to the maintained
`websocket` package. The game server also serves the original client from the
same origin so that Ato's generated HTTPS hostname works without a dispatcher
or an external service.

The 61 MiB Tiled editor source (`tools/maps/tmx/map.tmx`) is omitted from the
runtime projection to satisfy Ato v1's per-file limit. BrowserQuest executes
the upstream-generated client and server JSON maps, which remain unchanged.

## Ready-state proof

- `GET /ato-state` reports the pinned upstream commit and WebSocket contract.
- `body[data-ato-ready="true"]` is set after the player joins the world.
- The visible **Say hello** control sends a real in-world chat message over the
  game WebSocket and sets `body[data-ato-interaction="chat"]`.
- `body[data-ato-position]` tracks real map movement.
- The game client is exposed as `window.__atoGame` for deterministic browser
  verification without replacing gameplay.
