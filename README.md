# Neon Gravity VR

A gravity well puzzle game built with IWSDK. Place gravity wells to guide a glowing ball through star fields, avoid black holes, and reach the exit portal.

**Play live:** https://ellyz2426.github.io/neon-gravity/

## Gameplay

- Place gravity wells on the field to pull your ball toward them
- Adjust well strength with the scroll wheel (or VR thumbstick)
- Collect all stars scattered across the level
- Navigate through the portal to complete each level
- Avoid black holes — they destroy your ball on contact
- Manage your limited gravity well budget strategically
- Earn star ratings based on wells used and time taken

## Controls

### Browser
- **Click**: Place gravity well at cursor position
- **Scroll Wheel**: Adjust well strength
- **WASD**: Pan camera
- **Space**: Launch ball / confirm
- **R**: Reset level
- **ESC**: Pause

### VR
- **Trigger**: Place gravity well
- **Thumbstick**: Adjust well strength / navigate menus
- **A Button**: Confirm / launch
- **B Button**: Pause / back

## Features

- **20 campaign levels** with progressive difficulty
- **Inverse-square gravity physics** — realistic gravitational pull
- **8 game modes**: Campaign, Quickplay, Timed, Zen, Speedrun, Mirror, Randomizer, Endless
- **3 difficulty levels**: Easy, Normal, Hard
- **40 achievements** with XP/level progression
- **8 ball skins** with unlock conditions
- **5 holodeck arena themes**
- **Star collection** and **black hole hazards**
- **Portal-based win detection**
- **Wall collision physics**
- **Star rating system** (wells used + time efficiency)
- **Leaderboard** (top 20 scores)
- **Career statistics** tracking
- **Procedural audio** (15+ SFX + ambient drone)
- **Particle effects** (gravity ripples, star collect, black hole vortex, portal warp)
- **16 PanelUI spatial panels** (zero HTML DOM)
- **Dual runtime** VR + browser

## 3 ECS Systems

1. **GravityPhysicsSystem** — Inverse-square gravity simulation, wall bounce, star collection, black hole death, portal win
2. **GravityUISystem** — 16 panel queries with `eq()`, `qualify` event wiring, state-driven visibility
3. **GravityInputSystem** — Mouse/keyboard + XR controller input (trigger, thumbstick, A/B buttons)

## Tech Stack

- IWSDK (Immersive Web SDK)
- PanelUI with `.uikitml` templates (16 panels)
- TypeScript — zero compilation errors
- Dual runtime (XR + browser-first)
- Procedural Web Audio API
- localStorage persistence
- Vite build toolchain

## UI Panels (16)

| Panel | Purpose |
|-------|---------|
| title | Main menu |
| modes | Game mode selection |
| difficulty | Difficulty picker |
| levelselect | Campaign level selection |
| wellpicker | Gravity well placement UI |
| hud | In-game heads-up display |
| pause | Pause menu |
| gameover | Game over / level complete |
| leaderboard | High scores |
| achvlist | Achievements list |
| settings | Audio/visual settings |
| stats | Career statistics |
| skins | Ball skin selection |
| help | Controls & tutorial |
| toast | Notification popups |
| countdown | Level start countdown |

## Build #95

Part of the IWSDK Daily Builds series. Genre: Gravity Well Puzzle (NEW genre #84).
