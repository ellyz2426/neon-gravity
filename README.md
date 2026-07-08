# Neon Gravity VR

A gravity-switching puzzle-platformer built with IWSDK. Control a glowing ball by flipping gravity in 4 directions (up/down/left/right) to navigate obstacle courses and reach the exit portal.

**Play live:** https://ellyz2426.github.io/neon-gravity/

## Gameplay

- Flip gravity to guide your ball through maze-like levels
- Reach the glowing goal portal to clear each level
- Collect coins for bonus points
- Avoid red spikes (instant death)
- Use keys to open locked doors
- Bounce off green pads for a speed boost
- Teleport through purple portals
- Beware of crumbling platforms that collapse under you
- Activate checkpoints for safe respawn points

## Controls

### Browser
- **W/Up Arrow**: Gravity UP
- **S/Down Arrow**: Gravity DOWN
- **A/Left Arrow**: Gravity LEFT
- **D/Right Arrow**: Gravity RIGHT
- **ESC/P**: Pause

### VR
- **Thumbstick Up/Down/Left/Right**: Change gravity direction
- **B Button**: Pause

## Features

- 10 hand-crafted levels + procedural generation for infinite replayability
- 8 game modes: Campaign, Quick Play, Time Attack, Zen, Speedrun, Mirror, Randomizer, Endless
- 3 difficulty levels
- 40 achievements with XP/Level progression
- 8 ball skins with unlock conditions
- 5 holodeck arena themes
- 4-direction gravity switching with physics-based movement
- 7 cell types: walls, spikes, coins, keys/doors, portals, bounce pads, crumble platforms, checkpoints
- Star rating system (par time + all coins)
- Combo scoring with flip efficiency bonus
- Leaderboard (top 20)
- Career statistics tracking
- Procedural audio (15+ SFX + ambient drone)
- Particle effects (death burst, coin collect, portal warp, bounce sparks)
- 14 PanelUI spatial panels (zero HTML DOM)
- Dual runtime VR + browser

## Tech Stack

- IWSDK 0.4.1 (Immersive Web SDK)
- PanelUI with `.uikitml` templates
- Dual runtime (XR + browser-first)
- Procedural Web Audio API
- localStorage persistence
