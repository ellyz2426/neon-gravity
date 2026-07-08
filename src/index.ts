import {
  World,
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  Follower,
  ScreenSpace,
  InputComponent,
  eq,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BoxGeometry,
  CylinderGeometry,
  TorusGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  Mesh,
  Group,
  Color,
  Vector3,
  Vector2,
  Raycaster,
  Plane,
  AdditiveBlending,
  PointLight,
  DirectionalLight,
  AmbientLight,
  FogExp2,
  LineSegments,
  EdgesGeometry,
  LineBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  GridHelper,
  Line,
  type Entity,
} from '@iwsdk/core';

// ─── Types ──────────────────────────────────────────────────────────
type GameState = 'title' | 'modes' | 'difficulty' | 'levelselect' | 'countdown'
  | 'placing' | 'simulating' | 'gameover' | 'paused'
  | 'leaderboard' | 'achievements' | 'settings' | 'stats' | 'skins' | 'help';
type WellType = 'attractor' | 'repulsor';
type Mode = 'campaign' | 'quickplay' | 'timetrial' | 'minimal' | 'daily' | 'sandbox' | 'gauntlet' | 'zen';
type Difficulty = 'easy' | 'medium' | 'hard';

interface GravityWell {
  mesh: Mesh; glow: Mesh; ring: Mesh;
  x: number; z: number; type: WellType; strength: number;
}
interface StarObj {
  mesh: Mesh; x: number; z: number; collected: boolean;
}
interface WallObj {
  mesh: Mesh; x: number; z: number; w: number; d: number;
}
interface BlackHoleObj {
  mesh: Mesh; glow: Mesh; x: number; z: number; radius: number;
}
interface BumperObj {
  mesh: Mesh; glow: Mesh; x: number; z: number; radius: number;
  cooldown: number;
}
interface SpeedPadObj {
  mesh: Mesh; glow: Mesh; x: number; z: number; w: number; d: number;
  dx: number; dz: number; boost: number;
}
interface WarpPortalObj {
  meshA: Mesh; glowA: Mesh; meshB: Mesh; glowB: Mesh;
  ax: number; az: number; bx: number; bz: number;
  radius: number; cooldown: number;
}
interface LevelDef {
  sx: number; sz: number; ex: number; ez: number;
  maxWells: number; threeStarWells: number;
  walls: { x: number; z: number; w: number; d: number }[];
  stars: { x: number; z: number }[];
  bh: { x: number; z: number; r: number }[];
  bumpers?: { x: number; z: number; r: number }[];
  pads?: { x: number; z: number; w: number; d: number; dx: number; dz: number; boost: number }[];
  warps?: { ax: number; az: number; bx: number; bz: number; r: number }[];
}
interface Achievement { id: string; name: string; desc: string; }
interface ThemeDef {
  name: string; grid: string; accent: string; bg: string; fog: string;
  wall: string; attractor: string; repulsor: string; particle: string;
  glow: string; portal: string;
}
interface SkinDef { name: string; color: string; emissive: string; unlock: string; }
interface Stats {
  gamesPlayed: number; wins: number; starsTotal: number;
  wellsPlaced: number; timePlayed: number; bestScore: number;
}

// ─── Constants ──────────────────────────────────────────────────────
const FIELD_W = 10, FIELD_H = 8;
const HF_W = FIELD_W / 2, HF_H = FIELD_H / 2;
const G_CONST = 20;
const MIN_DIST = 0.25;
const PARTICLE_R = 0.1;
const WELL_R = 0.22;
const STAR_R = 0.14;
const PORTAL_R = 0.35;
const BH_R = 0.3;
const TRAIL_LEN = 60;
const PREVIEW_STEPS = 400;
const PREVIEW_DT = 0.016;

const THEMES: ThemeDef[] = [
  { name: 'Neon Holodeck', grid: '#004444', accent: '#00ffff', bg: '#000a0a', fog: '#001111', wall: '#003333', attractor: '#00ffff', repulsor: '#ff6600', particle: '#00ffff', glow: '#00ffff', portal: '#00ff88' },
  { name: 'Crimson Grid', grid: '#440000', accent: '#ff4444', bg: '#0a0000', fog: '#110000', wall: '#330000', attractor: '#ff4444', repulsor: '#ffaa00', particle: '#ff4444', glow: '#ff6666', portal: '#ff8844' },
  { name: 'Toxic Neon', grid: '#004400', accent: '#44ff44', bg: '#000a00', fog: '#001100', wall: '#003300', attractor: '#44ff44', repulsor: '#ff44ff', particle: '#44ff44', glow: '#66ff66', portal: '#88ff44' },
  { name: 'Ultra Violet', grid: '#220044', accent: '#aa66ff', bg: '#050008', fog: '#080011', wall: '#330055', attractor: '#aa66ff', repulsor: '#ff6644', particle: '#aa66ff', glow: '#cc88ff', portal: '#cc66ff' },
  { name: 'Solar Blaze', grid: '#442200', accent: '#ffaa44', bg: '#0a0500', fog: '#110800', wall: '#332200', attractor: '#ffaa44', repulsor: '#44aaff', particle: '#ffaa44', glow: '#ffcc66', portal: '#ffcc00' },
];

const SKINS: SkinDef[] = [
  { name: 'Neon Cyan', color: '#00ffff', emissive: '#00aaaa', unlock: 'default' },
  { name: 'Solar Flare', color: '#ff6600', emissive: '#aa4400', unlock: 'Win 5 levels' },
  { name: 'Plasma Pink', color: '#ff66ff', emissive: '#aa44aa', unlock: 'Score 5000' },
  { name: 'Frost Core', color: '#66ccff', emissive: '#4488aa', unlock: 'Play 10 games' },
  { name: 'Toxic Green', color: '#66ff66', emissive: '#44aa44', unlock: 'Get 3 stars' },
  { name: 'Royal Gold', color: '#ffaa00', emissive: '#aa7700', unlock: 'Clear level 10' },
  { name: 'Void Purple', color: '#aa66ff', emissive: '#7744aa', unlock: 'Use min wells' },
  { name: 'Inferno Red', color: '#ff4444', emissive: '#aa2222', unlock: 'All modes' },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_well', name: 'First Placement', desc: 'Place your first well' },
  { id: 'first_win', name: 'Gravity Master', desc: 'Complete your first level' },
  { id: 'three_stars', name: 'Perfect Orbit', desc: 'Get 3 stars on a level' },
  { id: 'ten_wins', name: 'Navigator', desc: 'Complete 10 levels' },
  { id: 'all_stars_1', name: 'Star Collector', desc: 'Collect 10 total stars' },
  { id: 'all_stars_2', name: 'Star Hunter', desc: 'Collect 50 total stars' },
  { id: 'all_stars_3', name: 'Constellation', desc: 'Collect 100 total stars' },
  { id: 'min_wells_1', name: 'Efficient', desc: 'Use only 1 well to clear a level' },
  { id: 'min_wells_2', name: 'Minimalist', desc: 'Clear 5 levels with min wells' },
  { id: 'score_1k', name: 'Apprentice', desc: 'Score 1000 in one level' },
  { id: 'score_5k', name: 'Expert', desc: 'Score 5000 in one level' },
  { id: 'score_10k', name: 'Grand Master', desc: 'Score 10000 in one level' },
  { id: 'play_5', name: 'Getting Hooked', desc: 'Play 5 games' },
  { id: 'play_20', name: 'Dedicated', desc: 'Play 20 games' },
  { id: 'play_50', name: 'Veteran', desc: 'Play 50 games' },
  { id: 'campaign_5', name: 'Halfway There', desc: 'Clear campaign level 10' },
  { id: 'campaign_20', name: 'Original Twenty', desc: 'Clear campaign level 20' },
  { id: 'campaign_all', name: 'Campaign Clear', desc: 'Clear all 30 campaign levels' },
  { id: 'quickplay_1', name: 'Quick Solve', desc: 'Complete a Quick Play level' },
  { id: 'timetrial_1', name: 'Speed Runner', desc: 'Complete Time Trial under 30s' },
  { id: 'minimal_1', name: 'Less Is More', desc: 'Complete a Minimal level' },
  { id: 'daily_1', name: 'Daily Player', desc: 'Complete a Daily Challenge' },
  { id: 'sandbox_1', name: 'Experimenter', desc: 'Place 10 wells in Sandbox' },
  { id: 'gauntlet_3', name: 'Gauntlet Runner', desc: 'Clear 3 Gauntlet levels' },
  { id: 'zen_5', name: 'Inner Peace', desc: 'Play Zen for 5 minutes' },
  { id: 'combo_2', name: 'Double Catch', desc: 'Collect 2 stars in a row' },
  { id: 'combo_3', name: 'Triple Grab', desc: 'Collect 3 stars in a row' },
  { id: 'attractor_10', name: 'Pull Master', desc: 'Place 10 attractors total' },
  { id: 'repulsor_10', name: 'Push Master', desc: 'Place 10 repulsors total' },
  { id: 'mixed_wells', name: 'Both Forces', desc: 'Use both well types in one level' },
  { id: 'no_stars', name: 'Speedster', desc: 'Clear level without collecting stars' },
  { id: 'bounce_wall', name: 'Ricochet', desc: 'Particle bounces off a wall' },
  { id: 'close_call', name: 'Close Call', desc: 'Pass within 0.3 of black hole' },
  { id: 'fast_clear', name: 'Lightning', desc: 'Clear level in under 5 seconds' },
  { id: 'slow_clear', name: 'Scenic Route', desc: 'Clear level taking over 30 seconds' },
  { id: 'theme_change', name: 'Redecorator', desc: 'Change the holodeck theme' },
  { id: 'skin_change', name: 'Fashion', desc: 'Change particle skin' },
  { id: 'retry_5', name: 'Persistent', desc: 'Retry a level 5 times' },
  { id: 'xp_100', name: 'Rising Star', desc: 'Earn 100 total XP' },
  { id: 'xp_500', name: 'Graviton', desc: 'Earn 500 total XP' },
  { id: 'xp_1000', name: 'Singularity', desc: 'Earn 1000 total XP' },
  { id: 'bumper_bounce', name: 'Pinball', desc: 'Bounce off a bumper' },
  { id: 'bumper_chain_3', name: 'Bumper Combo', desc: 'Hit 3 bumpers in one run' },
  { id: 'speed_boost', name: 'Turbo', desc: 'Use a speed pad' },
  { id: 'warp_used', name: 'Warped', desc: 'Use a warp portal' },
  { id: 'warp_star', name: 'Warp Star', desc: 'Collect a star within 1s of warping' },
  { id: 'campaign_30', name: 'New Frontier', desc: 'Reach campaign level 31' },
  { id: 'campaign_40', name: 'Grand Master', desc: 'Clear all 40 campaign levels' },
  { id: 'no_bumper', name: 'Smooth Sailing', desc: 'Clear a bumper level without hitting any' },
  { id: 'speed_3', name: 'Triple Boost', desc: 'Hit 3 speed pads in one run' },
  { id: 'all_stars_200', name: 'Galaxy', desc: 'Collect 200 total stars' },
];

const LEVELS: LevelDef[] = [
  // 1: Straight shot
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 5, threeStarWells: 0, walls: [], stars: [{ x: 0, z: 0 }], bh: [] },
  // 2: Slight offset
  { sx: -3.5, sz: -1.5, ex: 3.5, ez: 1.5, maxWells: 5, threeStarWells: 1, walls: [], stars: [{ x: 0, z: 0 }, { x: 1.5, z: 0.8 }], bh: [] },
  // 3: Right angle
  { sx: -3, sz: -2.5, ex: 3, ez: 2.5, maxWells: 5, threeStarWells: 1, walls: [], stars: [{ x: -1, z: 0 }, { x: 1, z: 1 }], bh: [] },
  // 4: Wall block
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 4, threeStarWells: 1, walls: [{ x: 0, z: 0, w: 0.3, d: 3 }], stars: [{ x: -1.5, z: 1 }, { x: 1.5, z: -1 }], bh: [] },
  // 5: Two walls gap
  { sx: -3.5, sz: -2, ex: 3.5, ez: 2, maxWells: 4, threeStarWells: 2, walls: [{ x: -1, z: 0, w: 0.3, d: 2.5 }, { x: 1.5, z: 0, w: 0.3, d: 2.5 }], stars: [{ x: 0, z: 0.5 }, { x: 0, z: -0.5 }], bh: [] },
  // 6: Corridor
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 4, threeStarWells: 2, walls: [{ x: 0, z: 1.5, w: 5, d: 0.3 }, { x: 0, z: -1.5, w: 5, d: 0.3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }, { x: 2.5, z: 0 }], bh: [] },
  // 7: Zigzag
  { sx: -3.5, sz: -2, ex: 3.5, ez: 2, maxWells: 5, threeStarWells: 2, walls: [{ x: -1.5, z: 1, w: 0.3, d: 3 }, { x: 1.5, z: -1, w: 0.3, d: 3 }], stars: [{ x: -2.5, z: 0 }, { x: 0, z: 0 }, { x: 2.5, z: 0 }], bh: [] },
  // 8: First black hole
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 4, threeStarWells: 2, walls: [], stars: [{ x: 0, z: 1.5 }, { x: 0, z: -1.5 }], bh: [{ x: 0, z: 0, r: 0.5 }] },
  // 9: BH + wall
  { sx: -3.5, sz: -2, ex: 3.5, ez: 2, maxWells: 5, threeStarWells: 2, walls: [{ x: 0, z: 0, w: 3, d: 0.3 }], stars: [{ x: -1.5, z: 1 }, { x: 1.5, z: -1 }], bh: [{ x: 2, z: 1, r: 0.4 }] },
  // 10: Double BH
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 4, threeStarWells: 2, walls: [{ x: 0, z: 2, w: 4, d: 0.3 }, { x: 0, z: -2, w: 4, d: 0.3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }], bh: [{ x: -1, z: 0.8, r: 0.4 }, { x: 1, z: -0.8, r: 0.4 }] },
  // 11: Maze entry
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 5, threeStarWells: 3, walls: [{ x: -2, z: 0, w: 0.3, d: 3 }, { x: 0, z: 0, w: 0.3, d: 3 }, { x: 2, z: 0, w: 0.3, d: 3 }], stars: [{ x: -1, z: -1 }, { x: 1, z: 1 }], bh: [] },
  // 12: Surrounded
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 4, threeStarWells: 2, walls: [{ x: 0, z: 1.2, w: 3, d: 0.3 }, { x: 0, z: -1.2, w: 3, d: 0.3 }, { x: -1.5, z: 0, w: 0.3, d: 2 }, { x: 1.5, z: 0, w: 0.3, d: 2 }], stars: [{ x: 0, z: 0 }], bh: [] },
  // 13: Spiral path
  { sx: -3, sz: -2, ex: 0, ez: 0, maxWells: 5, threeStarWells: 3, walls: [{ x: 0, z: -1, w: 4, d: 0.3 }, { x: 1, z: 1, w: 4, d: 0.3 }], stars: [{ x: -2, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 1.5 }], bh: [{ x: -1, z: 1.5, r: 0.3 }] },
  // 14: Narrow gap
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 3, threeStarWells: 1, walls: [{ x: 0, z: 0.6, w: 6, d: 0.3 }, { x: 0, z: -0.6, w: 6, d: 0.3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }], bh: [] },
  // 15: Triple BH
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 5, threeStarWells: 3, walls: [], stars: [{ x: -2, z: 1.5 }, { x: 0, z: -1.5 }, { x: 2, z: 1.5 }], bh: [{ x: -1.5, z: 0, r: 0.4 }, { x: 0, z: 0, r: 0.5 }, { x: 1.5, z: 0, r: 0.4 }] },
  // 16: Box maze
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 4, threeStarWells: 2, walls: [{ x: -2, z: -1, w: 2, d: 0.3 }, { x: 0, z: 1, w: 2, d: 0.3 }, { x: 2, z: -1, w: 2, d: 0.3 }, { x: -1, z: 0, w: 0.3, d: 2 }, { x: 1, z: 0, w: 0.3, d: 2 }], stars: [{ x: 0, z: 0 }], bh: [{ x: 2.5, z: 1.5, r: 0.3 }] },
  // 17: Open field BH
  { sx: -3, sz: -2, ex: 3, ez: 2, maxWells: 3, threeStarWells: 1, walls: [], stars: [{ x: 0, z: 0 }, { x: -1, z: 1 }, { x: 1, z: -1 }], bh: [{ x: -1, z: -1, r: 0.5 }, { x: 1, z: 1, r: 0.5 }, { x: 0, z: 2, r: 0.3 }] },
  // 18: The gauntlet
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 5, threeStarWells: 3, walls: [{ x: -2, z: 0.8, w: 0.3, d: 1.5 }, { x: -1, z: -0.8, w: 0.3, d: 1.5 }, { x: 0.5, z: 0.8, w: 0.3, d: 1.5 }, { x: 1.5, z: -0.8, w: 0.3, d: 1.5 }], stars: [{ x: -1.5, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }], bh: [{ x: 2.5, z: 0, r: 0.35 }] },
  // 19: Precision
  { sx: -3, sz: -2.5, ex: 3, ez: 2.5, maxWells: 3, threeStarWells: 1, walls: [{ x: -1, z: -1.5, w: 3, d: 0.3 }, { x: 1, z: 1.5, w: 3, d: 0.3 }, { x: 0, z: 0, w: 0.3, d: 2 }], stars: [{ x: -2, z: 0 }, { x: 2, z: 0 }], bh: [{ x: -1.5, z: 1, r: 0.4 }, { x: 1.5, z: -1, r: 0.4 }] },
  // 20: Grand finale
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 4, threeStarWells: 2, walls: [{ x: -2, z: 0, w: 0.3, d: 4 }, { x: 0, z: -1.5, w: 3, d: 0.3 }, { x: 0, z: 1.5, w: 3, d: 0.3 }, { x: 2, z: 0, w: 0.3, d: 4 }], stars: [{ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }], bh: [{ x: -2.5, z: 2, r: 0.4 }, { x: 2.5, z: -2, r: 0.4 }, { x: 0, z: 0, r: 0.3 }] },
  // 21: Open minefield
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 3, threeStarWells: 1, walls: [], stars: [{ x: -1.5, z: 1 }, { x: 1.5, z: -1 }], bh: [{ x: -1, z: 0.5, r: 0.35 }, { x: 0, z: -0.5, r: 0.35 }, { x: 1, z: 0.5, r: 0.35 }, { x: 2, z: -0.5, r: 0.35 }] },
  // 22: Channel run
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: -2.5, maxWells: 4, threeStarWells: 2, walls: [{ x: -2, z: -1, w: 0.3, d: 3 }, { x: 0, z: 1, w: 0.3, d: 3 }, { x: 2, z: -1, w: 0.3, d: 3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }], bh: [{ x: -3, z: 1.5, r: 0.3 }, { x: 3, z: -1.5, r: 0.3 }] },
  // 23: Crossroads
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 3, threeStarWells: 1, walls: [{ x: 0, z: 0, w: 4, d: 0.3 }, { x: 0, z: 0, w: 0.3, d: 4 }], stars: [{ x: -1.5, z: -1.5 }, { x: 1.5, z: 1.5 }], bh: [{ x: 1.5, z: -1.5, r: 0.4 }] },
  // 24: Spiral galaxy
  { sx: -3, sz: -2, ex: 0, ez: 0, maxWells: 4, threeStarWells: 2, walls: [{ x: -1.5, z: -0.5, w: 3, d: 0.3 }, { x: 1.5, z: 0.5, w: 3, d: 0.3 }], stars: [{ x: -2, z: 1 }, { x: 0, z: -1 }, { x: 2, z: 1 }], bh: [{ x: 0, z: 0, r: 0.45 }] },
  // 25: Asteroid belt
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 5, threeStarWells: 2, walls: [{ x: -2, z: 0.8, w: 1, d: 0.3 }, { x: -1, z: -0.8, w: 1, d: 0.3 }, { x: 0, z: 0.8, w: 1, d: 0.3 }, { x: 1, z: -0.8, w: 1, d: 0.3 }, { x: 2, z: 0.8, w: 1, d: 0.3 }], stars: [{ x: -1.5, z: 0 }, { x: 0.5, z: 0 }, { x: 2.5, z: 0 }], bh: [] },
  // 26: Double spiral
  { sx: -3, sz: -2.5, ex: 3, ez: 2.5, maxWells: 3, threeStarWells: 1, walls: [{ x: -1, z: 1.5, w: 4, d: 0.3 }, { x: 1, z: -1.5, w: 4, d: 0.3 }], stars: [{ x: 0, z: 0 }], bh: [{ x: -2, z: -0.5, r: 0.4 }, { x: 2, z: 0.5, r: 0.4 }] },
  // 27: Triple threat
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 4, threeStarWells: 2, walls: [{ x: -1.5, z: 0, w: 0.3, d: 2.5 }, { x: 0, z: 0, w: 0.3, d: 2.5 }, { x: 1.5, z: 0, w: 0.3, d: 2.5 }], stars: [{ x: -0.75, z: 0.5 }, { x: 0.75, z: -0.5 }], bh: [{ x: -0.75, z: -1, r: 0.3 }, { x: 0.75, z: 1, r: 0.3 }, { x: 2.5, z: 0, r: 0.35 }] },
  // 28: Enclosed BH
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 3, threeStarWells: 1, walls: [{ x: 0, z: 0.8, w: 2.5, d: 0.3 }, { x: 0, z: -0.8, w: 2.5, d: 0.3 }, { x: -1.2, z: 0, w: 0.3, d: 1.3 }, { x: 1.2, z: 0, w: 0.3, d: 1.3 }], stars: [{ x: 0, z: 0 }], bh: [{ x: -2, z: 1.5, r: 0.4 }, { x: 2, z: -1.5, r: 0.4 }] },
  // 29: Labyrinth
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 5, threeStarWells: 2, walls: [{ x: -2.5, z: -0.5, w: 0.3, d: 3 }, { x: -1, z: 1, w: 0.3, d: 2 }, { x: 0.5, z: -0.5, w: 0.3, d: 3 }, { x: 2, z: 1, w: 0.3, d: 2 }], stars: [{ x: -1.8, z: 1.5 }, { x: 0, z: 0 }, { x: 1.5, z: -1 }], bh: [{ x: -0.3, z: 2, r: 0.3 }, { x: 1, z: 1.5, r: 0.3 }] },
  // 30: Ultimate challenge
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 3, threeStarWells: 1, walls: [{ x: -2, z: 0, w: 0.3, d: 5 }, { x: 0, z: 0, w: 0.3, d: 5 }, { x: 2, z: 0, w: 0.3, d: 5 }, { x: 0, z: -2, w: 6, d: 0.3 }, { x: 0, z: 2, w: 6, d: 0.3 }], stars: [{ x: -1, z: 1 }, { x: 1, z: -1 }], bh: [{ x: -3, z: 1, r: 0.35 }, { x: -1, z: -1, r: 0.3 }, { x: 1, z: 1, r: 0.3 }, { x: 3, z: -1, r: 0.35 }] },
  // 31: Bumper intro
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 4, threeStarWells: 2, walls: [], stars: [{ x: 0, z: 1 }, { x: 0, z: -1 }], bh: [], bumpers: [{ x: -1, z: 0, r: 0.4 }, { x: 1, z: 0, r: 0.4 }] },
  // 32: Speed pad intro
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 3, threeStarWells: 1, walls: [{ x: 0, z: 1.5, w: 4, d: 0.3 }, { x: 0, z: -1.5, w: 4, d: 0.3 }], stars: [{ x: 1, z: 0 }], bh: [], pads: [{ x: -1.5, z: 0, w: 1, d: 0.6, dx: 1, dz: 0, boost: 5 }] },
  // 33: Warp intro
  { sx: -3, sz: -2, ex: 3, ez: 2, maxWells: 4, threeStarWells: 2, walls: [{ x: 0, z: 0, w: 0.3, d: 5 }], stars: [{ x: 1.5, z: -1 }], bh: [], warps: [{ ax: -1.5, az: 0, bx: 1.5, bz: 0, r: 0.35 }] },
  // 34: Bumper corridor
  { sx: -3.5, sz: -2, ex: 3.5, ez: 2, maxWells: 4, threeStarWells: 2, walls: [{ x: 0, z: 2, w: 5, d: 0.3 }, { x: 0, z: -2, w: 5, d: 0.3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }], bh: [], bumpers: [{ x: -2, z: 0, r: 0.35 }, { x: 0, z: 0, r: 0.35 }, { x: 2, z: 0, r: 0.35 }] },
  // 35: Boost + BH gauntlet
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 3, threeStarWells: 1, walls: [], stars: [{ x: 0, z: 0 }, { x: 2, z: 0.5 }], bh: [{ x: -1, z: 1, r: 0.4 }, { x: 1, z: -1, r: 0.4 }], pads: [{ x: -2.5, z: 0, w: 0.8, d: 0.5, dx: 1, dz: 0, boost: 6 }, { x: 1.5, z: 0, w: 0.8, d: 0.5, dx: 1, dz: 0, boost: 4 }] },
  // 36: Warp maze
  { sx: -3, sz: -2.5, ex: 3, ez: 2.5, maxWells: 4, threeStarWells: 2, walls: [{ x: -1.5, z: 0, w: 0.3, d: 3 }, { x: 1.5, z: 0, w: 0.3, d: 3 }], stars: [{ x: 0, z: 0 }, { x: 2.5, z: 1 }], bh: [{ x: 0, z: 2, r: 0.3 }], warps: [{ ax: -2.5, az: 1, bx: 0, bz: -1.5, r: 0.3 }, { ax: 0, az: 1.5, bx: 2.5, bz: -1, r: 0.3 }] },
  // 37: Mixed chaos
  { sx: -3.5, sz: 0, ex: 3.5, ez: 0, maxWells: 5, threeStarWells: 2, walls: [{ x: 0, z: 0, w: 0.3, d: 2.5 }], stars: [{ x: -1.5, z: 0.5 }, { x: 1.5, z: -0.5 }, { x: 0, z: 1.5 }], bh: [{ x: 2, z: 1.5, r: 0.3 }], bumpers: [{ x: -2, z: -1, r: 0.3 }, { x: 1, z: 1, r: 0.35 }], pads: [{ x: -0.8, z: -1.5, w: 0.6, d: 0.5, dx: 0, dz: 1, boost: 5 }] },
  // 38: Warp + bumper pinball
  { sx: -3, sz: 0, ex: 3, ez: 0, maxWells: 3, threeStarWells: 1, walls: [{ x: 0, z: 2.5, w: 7, d: 0.3 }, { x: 0, z: -2.5, w: 7, d: 0.3 }], stars: [{ x: 0, z: 0 }, { x: -2, z: 1 }], bh: [], bumpers: [{ x: -1.5, z: -1, r: 0.3 }, { x: 0, z: 1, r: 0.35 }, { x: 1.5, z: -1, r: 0.3 }], warps: [{ ax: -2.5, az: -1.5, bx: 2.5, bz: 1.5, r: 0.3 }] },
  // 39: Everything gauntlet
  { sx: -3.5, sz: -2, ex: 3.5, ez: 2, maxWells: 4, threeStarWells: 2, walls: [{ x: -1, z: 0, w: 0.3, d: 2 }, { x: 1.5, z: 0, w: 0.3, d: 2 }], stars: [{ x: -2, z: -1 }, { x: 0, z: 1 }, { x: 2, z: -1 }], bh: [{ x: -2.5, z: 1.5, r: 0.35 }, { x: 2.5, z: -1.5, r: 0.35 }], bumpers: [{ x: 0, z: -1.5, r: 0.3 }], pads: [{ x: -1.5, z: 1.5, w: 0.7, d: 0.5, dx: 1, dz: -1, boost: 5 }], warps: [{ ax: -0.5, az: -2, bx: 0.5, bz: 2, r: 0.25 }] },
  // 40: Grand finale v2
  { sx: -3.5, sz: -2.5, ex: 3.5, ez: 2.5, maxWells: 3, threeStarWells: 1, walls: [{ x: -2, z: 0, w: 0.3, d: 4 }, { x: 2, z: 0, w: 0.3, d: 4 }, { x: 0, z: -1.5, w: 3, d: 0.3 }, { x: 0, z: 1.5, w: 3, d: 0.3 }], stars: [{ x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -2.5 }], bh: [{ x: -3, z: 2, r: 0.3 }, { x: 0, z: 0, r: 0.35 }, { x: 3, z: -2, r: 0.3 }], bumpers: [{ x: -1, z: -2, r: 0.3 }, { x: 1, z: 2, r: 0.3 }], pads: [{ x: 2.5, z: 0, w: 0.6, d: 0.5, dx: 0, dz: 1, boost: 6 }], warps: [{ ax: -2.5, az: -2, bx: 2.5, bz: 2, r: 0.25 }] },
];

const MODE_NAMES: Record<Mode, string> = {
  campaign: 'CAMPAIGN', quickplay: 'QUICK PLAY', timetrial: 'TIME TRIAL',
  minimal: 'MINIMAL', daily: 'DAILY CHALLENGE', sandbox: 'SANDBOX',
  gauntlet: 'GAUNTLET', zen: 'ZEN',
};

// ─── Procedural Audio ───────────────────────────────────────────────
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  volume = 0.8;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  private playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  placeWell() { this.playTone(440, 0.15, 'sine', 0.2); this.playTone(660, 0.1, 'sine', 0.15); }
  launch() { this.playTone(220, 0.3, 'sawtooth', 0.15); this.playTone(330, 0.25, 'sawtooth', 0.1); }
  collectStar() { this.playTone(880, 0.12, 'sine', 0.25); this.playTone(1100, 0.15, 'sine', 0.2); }
  wallBounce() { this.playTone(150, 0.1, 'square', 0.15); }
  levelWin() { this.playTone(523, 0.2, 'sine', 0.3); setTimeout(() => this.playTone(659, 0.2, 'sine', 0.3), 150); setTimeout(() => this.playTone(784, 0.3, 'sine', 0.3), 300); }
  levelFail() { this.playTone(300, 0.3, 'sawtooth', 0.2); setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.2), 200); }
  blackHoleDeath() { this.playTone(80, 0.5, 'sawtooth', 0.3); this.playTone(60, 0.6, 'sine', 0.2); }
  buttonClick() { this.playTone(600, 0.06, 'sine', 0.15); }
  countdown() { this.playTone(440, 0.15, 'sine', 0.2); }
  countdownGo() { this.playTone(880, 0.25, 'sine', 0.3); }
  removeWell() { this.playTone(330, 0.1, 'sine', 0.15); this.playTone(220, 0.12, 'sine', 0.1); }
  comboStar(n: number) { this.playTone(880 + n * 200, 0.15, 'sine', 0.25); }
  achievementUnlock() { this.playTone(660, 0.15, 'sine', 0.2); setTimeout(() => this.playTone(880, 0.15, 'sine', 0.2), 100); setTimeout(() => this.playTone(1100, 0.2, 'sine', 0.25), 200); }
  resetLevel() { this.playTone(350, 0.08, 'triangle', 0.15); }
  bumperHit() { this.playTone(700, 0.1, 'sine', 0.25); this.playTone(900, 0.08, 'sine', 0.2); }
  speedBoost() { this.playTone(400, 0.15, 'sawtooth', 0.15); this.playTone(600, 0.12, 'sawtooth', 0.12); this.playTone(800, 0.1, 'sawtooth', 0.1); }
  warpPortal() { this.playTone(200, 0.2, 'sine', 0.2); this.playTone(500, 0.15, 'sine', 0.25); this.playTone(800, 0.12, 'sine', 0.15); }
  ambient() { this.playTone(55, 2, 'sine', 0.05); this.playTone(82.5, 2, 'sine', 0.04); }
}

// ─── Particle Burst FX ──────────────────────────────────────────────
interface BurstParticle {
  mesh: Mesh;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
}

class ParticleFX {
  private particles: BurstParticle[] = [];
  private scene: any;
  private pool: Mesh[] = [];
  private poolIdx = 0;
  private readonly POOL_SIZE = 200;
  private geo = new SphereGeometry(0.04, 4, 4);

  init(scene: any) {
    this.scene = scene;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const m = new Mesh(this.geo, new MeshBasicMaterial({ color: new Color('#ffffff'), transparent: true, opacity: 1, blending: AdditiveBlending }));
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  private getMesh(): Mesh | null {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const idx = (this.poolIdx + i) % this.POOL_SIZE;
      if (!this.pool[idx].visible) {
        this.poolIdx = (idx + 1) % this.POOL_SIZE;
        return this.pool[idx];
      }
    }
    return null;
  }

  burst(x: number, y: number, z: number, color: string, count: number, speed = 3, life = 0.6) {
    const col = new Color(color);
    for (let i = 0; i < count; i++) {
      const mesh = this.getMesh();
      if (!mesh) break;
      (mesh.material as MeshBasicMaterial).color.copy(col);
      (mesh.material as MeshBasicMaterial).opacity = 1;
      mesh.position.set(x, y, z);
      mesh.scale.set(1, 1, 1);
      mesh.visible = true;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        mesh,
        vx: Math.cos(theta) * Math.cos(phi) * sp,
        vy: Math.sin(phi) * sp + 1,
        vz: Math.sin(theta) * Math.cos(phi) * sp,
        life: life * (0.7 + Math.random() * 0.3),
        maxLife: life,
      });
    }
  }

  ring(x: number, y: number, z: number, color: string, radius: number, count: number) {
    const col = new Color(color);
    for (let i = 0; i < count; i++) {
      const mesh = this.getMesh();
      if (!mesh) break;
      (mesh.material as MeshBasicMaterial).color.copy(col);
      (mesh.material as MeshBasicMaterial).opacity = 1;
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius);
      mesh.scale.set(1.5, 1.5, 1.5);
      mesh.visible = true;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * 2,
        vy: 1.5,
        vz: Math.sin(angle) * 2,
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  update(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 3 * delta; // gravity
      p.mesh.position.x += p.vx * delta;
      p.mesh.position.y += p.vy * delta;
      p.mesh.position.z += p.vz * delta;
      const t = p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = t;
      p.mesh.scale.setScalar(t * 1.2);
    }
  }
}

// ─── Starfield Background ───────────────────────────────────────────
class Starfield {
  private stars: Mesh[] = [];
  private velocities: { vx: number; vy: number; vz: number }[] = [];
  private geo = new SphereGeometry(0.02, 3, 3);

  init(scene: any, count = 120) {
    const mat = new MeshBasicMaterial({ color: new Color('#ffffff'), transparent: true, opacity: 0.3 });
    for (let i = 0; i < count; i++) {
      const m = new Mesh(this.geo, mat.clone());
      const x = (Math.random() - 0.5) * 30;
      const y = 3 + Math.random() * 15;
      const z = (Math.random() - 0.5) * 30;
      m.position.set(x, y, z);
      m.scale.setScalar(0.5 + Math.random() * 1.5);
      (m.material as MeshBasicMaterial).opacity = 0.1 + Math.random() * 0.25;
      scene.add(m);
      this.stars.push(m);
      this.velocities.push({
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.05 - Math.random() * 0.1,
        vz: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  update(delta: number) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const v = this.velocities[i];
      s.position.x += v.vx * delta;
      s.position.y += v.vy * delta;
      s.position.z += v.vz * delta;
      // Twinkle
      (s.material as MeshBasicMaterial).opacity = 0.1 + Math.abs(Math.sin(s.position.y * 2 + i * 0.5)) * 0.25;
      // Wrap
      if (s.position.y < 2) {
        s.position.y = 18;
        s.position.x = (Math.random() - 0.5) * 30;
        s.position.z = (Math.random() - 0.5) * 30;
      }
    }
  }
}

// ─── Ghost Well Preview ─────────────────────────────────────────────
class GhostWell {
  mesh: Mesh;
  glow: Mesh;
  ring: Mesh;
  visible = false;

  constructor() {
    this.mesh = new Mesh(
      new SphereGeometry(WELL_R, 16, 16),
      new MeshStandardMaterial({ color: new Color('#00ffff'), emissive: new Color('#00ffff'), emissiveIntensity: 0.3, transparent: true, opacity: 0.35 })
    );
    this.glow = new Mesh(
      new SphereGeometry(WELL_R * 1.8, 16, 16),
      new MeshBasicMaterial({ color: new Color('#00ffff'), transparent: true, opacity: 0.08, blending: AdditiveBlending })
    );
    this.ring = new Mesh(
      new TorusGeometry(0.4, 0.015, 8, 32),
      new MeshBasicMaterial({ color: new Color('#00ffff'), transparent: true, opacity: 0.15 })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.hide();
  }

  addToScene(scene: any) {
    scene.add(this.mesh);
    scene.add(this.glow);
    scene.add(this.ring);
  }

  update(x: number, z: number, type: WellType, strength: number, theme: ThemeDef) {
    const col = type === 'attractor' ? theme.attractor : theme.repulsor;
    (this.mesh.material as MeshStandardMaterial).color.set(col);
    (this.mesh.material as MeshStandardMaterial).emissive.set(col);
    (this.glow.material as MeshBasicMaterial).color.set(col);
    (this.ring.material as MeshBasicMaterial).color.set(col);
    const ringR = 0.3 + strength * 0.08;
    this.ring.scale.setScalar(ringR / 0.4);
    this.mesh.position.set(x, 0.2, z);
    this.glow.position.set(x, 0.2, z);
    this.ring.position.set(x, 0.05, z);
    this.mesh.visible = true;
    this.glow.visible = true;
    this.ring.visible = true;
    this.visible = true;
  }

  hide() {
    this.mesh.visible = false;
    this.glow.visible = false;
    this.ring.visible = false;
    this.visible = false;
  }
}

// ─── Save/Load System ───────────────────────────────────────────────
interface SaveData {
  version: number;
  themeIdx: number;
  skinIdx: number;
  unlockedAchievements: string[];
  unlockedSkins: number[];
  leaderboard: number[];
  stats: Stats;
  totalXP: number;
  levelBestStars: number[];
  highestUnlockedLevel: number;
  volume: number;
}

function saveGame(game: GameManager) {
  try {
    const data: SaveData = {
      version: 1,
      themeIdx: game.themeIdx,
      skinIdx: game.skinIdx,
      unlockedAchievements: Array.from(game.unlockedAchievements),
      unlockedSkins: Array.from(game.unlockedSkins),
      leaderboard: game.leaderboard,
      stats: { ...game.stats },
      totalXP: game.totalXP,
      levelBestStars: [...game.levelBestStars],
      highestUnlockedLevel: game.highestUnlockedLevel,
      volume: game.audio.volume,
    };
    localStorage.setItem('neon-gravity-save', JSON.stringify(data));
  } catch (_e) { /* storage unavailable */ }
}

function loadGame(game: GameManager) {
  try {
    const raw = localStorage.getItem('neon-gravity-save');
    if (!raw) return;
    const data: SaveData = JSON.parse(raw);
    if (data.version !== 1) return;
    game.themeIdx = data.themeIdx ?? 0;
    game.skinIdx = data.skinIdx ?? 0;
    game.unlockedAchievements = new Set(data.unlockedAchievements ?? []);
    game.unlockedSkins = new Set(data.unlockedSkins ?? [0]);
    game.leaderboard = data.leaderboard ?? [];
    if (data.stats) {
      game.stats = { ...game.stats, ...data.stats };
    }
    game.totalXP = data.totalXP ?? 0;
    if (data.levelBestStars) {
      for (let i = 0; i < Math.min(data.levelBestStars.length, 40); i++) {
        game.levelBestStars[i] = data.levelBestStars[i];
      }
    }
    game.highestUnlockedLevel = data.highestUnlockedLevel ?? 0;
    if (data.volume !== undefined) {
      game.audio.volume = data.volume;
      game.audio.setVolume(data.volume);
    }
  } catch (_e) { /* corrupted or unavailable */ }
}

// ─── 3D Floating Text ───────────────────────────────────────────────
interface FloatingText {
  mesh: Mesh;
  life: number;
  vy: number;
}

class FloatingTextManager {
  private texts: FloatingText[] = [];
  private scene: any;

  init(scene: any) { this.scene = scene; }

  spawn(x: number, y: number, z: number, color: string, scale = 0.5) {
    // Use a glowing sphere cluster as a visual "!" indicator
    const group = new Mesh(
      new IcosahedronGeometry(0.08, 1),
      new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 1, blending: AdditiveBlending })
    );
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    this.scene.add(group);
    this.texts.push({ mesh: group, life: 1.2, vy: 1.5 });
  }

  update(delta: number) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= delta;
      t.mesh.position.y += t.vy * delta;
      t.vy -= 0.5 * delta;
      (t.mesh.material as MeshBasicMaterial).opacity = Math.max(0, t.life / 1.2);
      t.mesh.scale.setScalar(0.5 + (1 - t.life / 1.2) * 0.3);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.texts.splice(i, 1);
      }
    }
  }
}

// ─── Screen Shake ───────────────────────────────────────────────────
class ScreenShake {
  private intensity = 0;
  private decay = 5;
  private offsetX = 0;
  private offsetY = 0;
  private offsetZ = 0;

  trigger(intensity: number) {
    this.intensity = Math.max(this.intensity, intensity);
  }

  update(delta: number, camera: any) {
    if (this.intensity < 0.001) {
      this.intensity = 0;
      return;
    }
    this.offsetX = (Math.random() - 0.5) * this.intensity * 2;
    this.offsetY = (Math.random() - 0.5) * this.intensity * 1;
    this.offsetZ = (Math.random() - 0.5) * this.intensity * 2;
    camera.position.x += this.offsetX;
    camera.position.y += this.offsetY;
    camera.position.z += this.offsetZ;
    this.intensity *= Math.max(0, 1 - this.decay * delta);
  }
}

// ─── GameManager ────────────────────────────────────────────────────
class GameManager {
  state: GameState = 'title';
  prevState: GameState = 'title';
  mode: Mode = 'campaign';
  difficulty: Difficulty = 'medium';
  currentLevel = 0;
  score = 0;
  starsCollected = 0;
  comboCount = 0;
  wellsUsed = 0;
  maxWells = 5;
  wellType: WellType = 'attractor';
  wellStrength = 5;
  timer = 0;
  countdownVal = 3;
  countdownTimer = 0;
  retryCount = 0;
  gauntletLevel = 0;
  gauntletWellsTotal = 15;
  gauntletWellsUsed = 0;
  levelStartTime = 0;
  zenTimer = 0;

  // Scene objects
  wells: GravityWell[] = [];
  starObjs: StarObj[] = [];
  wallObjs: WallObj[] = [];
  bhObjs: BlackHoleObj[] = [];
  particleMesh: Mesh | null = null;
  particleGlow: Mesh | null = null;
  particleVX = 0;
  particleVZ = 0;
  particleX = 0;
  particleZ = 0;
  particleActive = false;
  particleTrail: Vector3[] = [];
  trailLine: Line | null = null;
  previewDots: Mesh[] = [];
  startPortalMesh: Mesh | null = null;
  endPortalMesh: Mesh | null = null;
  startPortalGlow: PointLight | null = null;
  endPortalGlow: PointLight | null = null;
  fieldGroup: Group | null = null;
  gridHelper: GridHelper | null = null;
  fieldFloor: Mesh | null = null;
  wallMeshes: Mesh[] = [];

  // Data
  themeIdx = 0;
  skinIdx = 0;
  unlockedAchievements: Set<string> = new Set();
  unlockedSkins: Set<number> = new Set([0]);
  leaderboard: number[] = [];
  stats: Stats = { gamesPlayed: 0, wins: 0, starsTotal: 0, wellsPlaced: 0, timePlayed: 0, bestScore: 0 };
  totalXP = 0;
  achvPage = 0;
  lsPage = 0;
  attractorsPlaced = 0;
  repulsorsPlaced = 0;
  wallBounced = false;
  bumperHits = 0;
  speedPadHits = 0;
  warpUses = 0;
  lastWarpTime = 0;
  levelBestStars: number[] = new Array(40).fill(0);

  // Scene objects for new mechanics
  bumperObjs: BumperObj[] = [];
  padObjs: SpeedPadObj[] = [];
  warpObjs: WarpPortalObj[] = [];

  audio = new AudioEngine();
  scene: any = null;
  fx = new ParticleFX();
  starfield = new Starfield();
  ghostWell = new GhostWell();
  floatingText = new FloatingTextManager();
  screenShake = new ScreenShake();

  // Camera tracking
  camTargetX = 0;
  camTargetZ = 0;
  camSmoothing = 3;
  camOffsetY = 12;
  camOffsetZ = 5;
  cameraFollowEnabled = true;

  // Level unlock
  highestUnlockedLevel = 0;

  // Auto-save timer
  saveTimer = 0;
  saveInterval = 10; // seconds

  // Speed tracking for visual effects
  lastSpeed = 0;
  maxSpeedReached = 0;

  get theme(): ThemeDef { return THEMES[this.themeIdx]; }
  get skin(): SkinDef { return SKINS[this.skinIdx]; }
  get currentLevelDef(): LevelDef { return LEVELS[this.currentLevel] || LEVELS[0]; }

  getPlayerLevel(): number { return Math.floor(this.totalXP / 100) + 1; }
  getPlayerXPProgress(): number { return this.totalXP % 100; }

  getDifficultyMod(): number {
    if (this.difficulty === 'easy') return 1.5;
    if (this.difficulty === 'hard') return 0.6;
    return 1;
  }

  getMaxWells(): number {
    const base = this.mode === 'sandbox' ? 99 : this.mode === 'zen' ? 99 : this.currentLevelDef.maxWells;
    return Math.max(1, Math.round(base * this.getDifficultyMod()));
  }

  generateRandomLevel(): LevelDef {
    const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const sx = r(-3.5, -2.5), sz = r(-2, 2);
    const ex = r(2.5, 3.5), ez = r(-2, 2);
    const nw = Math.floor(Math.random() * 3);
    const ns = 1 + Math.floor(Math.random() * 3);
    const nb = Math.floor(Math.random() * 2);
    const walls: LevelDef['walls'] = [];
    for (let i = 0; i < nw; i++) walls.push({ x: r(-2, 2), z: r(-1.5, 1.5), w: r(0.3, 0.5), d: r(1, 3) });
    const stars: LevelDef['stars'] = [];
    for (let i = 0; i < ns; i++) stars.push({ x: r(-2.5, 2.5), z: r(-2, 2) });
    const bh: LevelDef['bh'] = [];
    for (let i = 0; i < nb; i++) bh.push({ x: r(-2, 2), z: r(-1.5, 1.5), r: r(0.3, 0.5) });
    return { sx, sz, ex, ez, maxWells: 4 + Math.floor(Math.random() * 3), threeStarWells: 2, walls, stars, bh };
  }

  getDailyLevel(): LevelDef {
    // Simple seeded random based on date
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const r = (n: number) => { const x = Math.sin(seed * n) * 10000; return x - Math.floor(x); };
    const sx = -3 + r(1) * -0.5, sz = -2 + r(2) * 4;
    const ex = 3 + r(3) * 0.5, ez = -2 + r(4) * 4;
    return { sx, sz, ex, ez, maxWells: 4, threeStarWells: 2, walls: [{ x: r(5) * 4 - 2, z: r(6) * 3 - 1.5, w: 0.3, d: 2 }], stars: [{ x: r(7) * 4 - 2, z: r(8) * 3 - 1.5 }], bh: [{ x: r(9) * 3 - 1.5, z: r(10) * 2 - 1, r: 0.4 }] };
  }

  calcStarRating(): number {
    const lvl = this.currentLevelDef;
    if (this.wellsUsed <= lvl.threeStarWells) return 3;
    if (this.wellsUsed <= lvl.threeStarWells + 1) return 2;
    return 1;
  }

  calcScore(): number {
    let s = 500;
    s += this.starsCollected * 200;
    s += Math.max(0, (this.maxWells - this.wellsUsed)) * 150;
    s += this.calcStarRating() * 300;
    if (this.comboCount >= 2) s += this.comboCount * 100;
    s += this.bumperHits * 50;
    s += this.speedPadHits * 75;
    s += this.warpUses * 100;
    return s;
  }

  addLeaderboardEntry(score: number) {
    this.leaderboard.push(score);
    this.leaderboard.sort((a, b) => b - a);
    if (this.leaderboard.length > 20) this.leaderboard.length = 20;
  }

  checkAchievements(): string[] {
    const unlocked: string[] = [];
    const tryUnlock = (id: string) => {
      if (!this.unlockedAchievements.has(id)) { this.unlockedAchievements.add(id); unlocked.push(id); }
    };
    if (this.stats.wellsPlaced >= 1) tryUnlock('first_well');
    if (this.stats.wins >= 1) tryUnlock('first_win');
    if (this.stats.wins >= 10) tryUnlock('ten_wins');
    if (this.stats.starsTotal >= 10) tryUnlock('all_stars_1');
    if (this.stats.starsTotal >= 50) tryUnlock('all_stars_2');
    if (this.stats.starsTotal >= 100) tryUnlock('all_stars_3');
    if (this.stats.gamesPlayed >= 5) tryUnlock('play_5');
    if (this.stats.gamesPlayed >= 20) tryUnlock('play_20');
    if (this.stats.gamesPlayed >= 50) tryUnlock('play_50');
    if (this.stats.bestScore >= 1000) tryUnlock('score_1k');
    if (this.stats.bestScore >= 5000) tryUnlock('score_5k');
    if (this.stats.bestScore >= 10000) tryUnlock('score_10k');
    if (this.attractorsPlaced >= 10) tryUnlock('attractor_10');
    if (this.repulsorsPlaced >= 10) tryUnlock('repulsor_10');
    if (this.totalXP >= 100) tryUnlock('xp_100');
    if (this.totalXP >= 500) tryUnlock('xp_500');
    if (this.totalXP >= 1000) tryUnlock('xp_1000');
    return unlocked;
  }
}

// ─── Scene Builder ──────────────────────────────────────────────────
function buildField(scene: any, game: GameManager): Group {
  const g = new Group();
  const theme = game.theme;

  // Floor
  const floor = new Mesh(
    new BoxGeometry(FIELD_W + 1, 0.05, FIELD_H + 1),
    new MeshStandardMaterial({ color: new Color(theme.bg), roughness: 0.9 })
  );
  floor.position.set(0, -0.025, 0);
  g.add(floor);
  game.fieldFloor = floor;

  // Grid
  const grid = new GridHelper(Math.max(FIELD_W, FIELD_H) + 2, 20, new Color(theme.grid), new Color(theme.grid));
  grid.position.y = 0.01;
  g.add(grid);
  game.gridHelper = grid;

  // Field boundary (wireframe box)
  const borderGeo = new EdgesGeometry(new BoxGeometry(FIELD_W, 0.3, FIELD_H));
  const borderLine = new LineSegments(borderGeo, new LineBasicMaterial({ color: new Color(theme.accent), transparent: true, opacity: 0.4 }));
  borderLine.position.y = 0.15;
  g.add(borderLine);

  scene.add(g);
  game.fieldGroup = g;
  return g;
}

function createPortal(color: string, x: number, z: number, scene: any): { mesh: Mesh; light: PointLight } {
  const mat = new MeshStandardMaterial({ color: new Color(color), emissive: new Color(color), emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
  const mesh = new Mesh(new TorusGeometry(PORTAL_R, 0.06, 8, 24), mat);
  mesh.position.set(x, 0.2, z);
  mesh.rotation.x = Math.PI / 2;
  scene.add(mesh);
  const light = new PointLight(new Color(color), 2, 3);
  light.position.set(x, 0.5, z);
  scene.add(light);
  return { mesh, light };
}

function createWellMesh(type: WellType, strength: number, theme: ThemeDef): { mesh: Mesh; glow: Mesh; ring: Mesh } {
  const col = type === 'attractor' ? theme.attractor : theme.repulsor;
  const mesh = new Mesh(
    new SphereGeometry(WELL_R, 16, 16),
    new MeshStandardMaterial({ color: new Color(col), emissive: new Color(col), emissiveIntensity: 0.6 })
  );
  const glow = new Mesh(
    new SphereGeometry(WELL_R * 1.8, 16, 16),
    new MeshBasicMaterial({ color: new Color(col), transparent: true, opacity: 0.15, blending: AdditiveBlending })
  );
  const ringR = 0.3 + strength * 0.08;
  const ring = new Mesh(
    new TorusGeometry(ringR, 0.02, 8, 32),
    new MeshBasicMaterial({ color: new Color(col), transparent: true, opacity: 0.3 })
  );
  ring.rotation.x = Math.PI / 2;
  return { mesh, glow, ring };
}

function createStarMesh(theme: ThemeDef): Mesh {
  return new Mesh(
    new OctahedronGeometry(STAR_R, 0),
    new MeshStandardMaterial({ color: new Color('#ffdd00'), emissive: new Color('#ffaa00'), emissiveIntensity: 0.5 })
  );
}

function createBlackHoleMesh(radius: number): { mesh: Mesh; glow: Mesh } {
  const mesh = new Mesh(
    new SphereGeometry(radius, 16, 16),
    new MeshStandardMaterial({ color: new Color('#111111'), emissive: new Color('#220033'), emissiveIntensity: 0.3 })
  );
  const glow = new Mesh(
    new SphereGeometry(radius * 1.5, 16, 16),
    new MeshBasicMaterial({ color: new Color('#440066'), transparent: true, opacity: 0.15, blending: AdditiveBlending })
  );
  return { mesh, glow };
}

function createBumperMesh(radius: number, theme: ThemeDef): { mesh: Mesh; glow: Mesh } {
  const col = '#ff44ff';
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, 0.3, 16),
    new MeshStandardMaterial({ color: new Color(col), emissive: new Color('#aa22aa'), emissiveIntensity: 0.6 })
  );
  const glow = new Mesh(
    new CylinderGeometry(radius * 1.4, radius * 1.4, 0.1, 16),
    new MeshBasicMaterial({ color: new Color(col), transparent: true, opacity: 0.2, blending: AdditiveBlending })
  );
  return { mesh, glow };
}

function createSpeedPadMesh(w: number, d: number, dx: number, dz: number): { mesh: Mesh; glow: Mesh } {
  const col = '#44ff44';
  const mesh = new Mesh(
    new BoxGeometry(w, 0.04, d),
    new MeshStandardMaterial({ color: new Color(col), emissive: new Color('#22aa22'), emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
  );
  // Arrow indicator mesh using a small cylinder
  const glow = new Mesh(
    new BoxGeometry(w * 0.6, 0.08, d * 0.4),
    new MeshBasicMaterial({ color: new Color('#88ff88'), transparent: true, opacity: 0.3, blending: AdditiveBlending })
  );
  return { mesh, glow };
}

function createWarpMesh(radius: number): { mesh: Mesh; glow: Mesh } {
  const col = '#ff8844';
  const mesh = new Mesh(
    new TorusGeometry(radius, 0.05, 8, 20),
    new MeshStandardMaterial({ color: new Color(col), emissive: new Color(col), emissiveIntensity: 0.7 })
  );
  const glow = new Mesh(
    new SphereGeometry(radius * 0.6, 12, 12),
    new MeshBasicMaterial({ color: new Color('#ffaa66'), transparent: true, opacity: 0.15, blending: AdditiveBlending })
  );
  return { mesh, glow };
}

function createParticleMesh(skin: SkinDef): { mesh: Mesh; glow: Mesh } {
  const mesh = new Mesh(
    new SphereGeometry(PARTICLE_R, 16, 16),
    new MeshStandardMaterial({ color: new Color(skin.color), emissive: new Color(skin.emissive), emissiveIntensity: 0.8 })
  );
  const glow = new Mesh(
    new SphereGeometry(PARTICLE_R * 2.5, 16, 16),
    new MeshBasicMaterial({ color: new Color(skin.color), transparent: true, opacity: 0.2, blending: AdditiveBlending })
  );
  return { mesh, glow };
}


// ─── Level Manager ──────────────────────────────────────────────────
function loadLevel(game: GameManager, scene: any) {
  // Clear previous level objects
  clearLevel(game, scene);
  // Reset camera position
  game.camTargetX = 0;
  game.camTargetZ = 5;

  const lvl = game.mode === 'quickplay' || game.mode === 'timetrial' || game.mode === 'minimal' || game.mode === 'zen'
    ? game.generateRandomLevel()
    : game.mode === 'daily' ? game.getDailyLevel() : game.currentLevelDef;

  game.maxWells = game.mode === 'sandbox' || game.mode === 'zen' ? 99 : Math.max(1, Math.round(lvl.maxWells * game.getDifficultyMod()));
  game.wellsUsed = 0;
  game.starsCollected = 0;
  game.comboCount = 0;
  game.score = 0;
  game.timer = 0;
  game.wallBounced = false;
  game.bumperHits = 0;
  game.speedPadHits = 0;
  game.warpUses = 0;
  game.lastWarpTime = 0;
  game.particleActive = false;
  game.particleTrail = [];
  game.lastSpeed = 0;
  game.maxSpeedReached = 0;

  // Start portal
  const sp = createPortal(game.theme.portal, lvl.sx, lvl.sz, scene);
  game.startPortalMesh = sp.mesh;
  game.startPortalGlow = sp.light;

  // End portal
  const ep = createPortal(game.theme.accent, lvl.ex, lvl.ez, scene);
  game.endPortalMesh = ep.mesh;
  game.endPortalGlow = ep.light;

  // Walls
  for (const w of lvl.walls) {
    const wallMesh = new Mesh(
      new BoxGeometry(w.w, 0.4, w.d),
      new MeshStandardMaterial({ color: new Color(game.theme.wall), emissive: new Color(game.theme.wall), emissiveIntensity: 0.3 })
    );
    wallMesh.position.set(w.x, 0.2, w.z);
    scene.add(wallMesh);
    game.wallObjs.push({ mesh: wallMesh, x: w.x, z: w.z, w: w.w, d: w.d });
  }

  // Stars
  for (const s of lvl.stars) {
    const sm = createStarMesh(game.theme);
    sm.position.set(s.x, 0.3, s.z);
    scene.add(sm);
    game.starObjs.push({ mesh: sm, x: s.x, z: s.z, collected: false });
  }

  // Black holes
  for (const b of lvl.bh) {
    const bm = createBlackHoleMesh(b.r);
    bm.mesh.position.set(b.x, 0.15, b.z);
    bm.glow.position.set(b.x, 0.15, b.z);
    scene.add(bm.mesh);
    scene.add(bm.glow);
    game.bhObjs.push({ mesh: bm.mesh, glow: bm.glow, x: b.x, z: b.z, radius: b.r });
  }

  // Bumpers
  if (lvl.bumpers) {
    for (const bp of lvl.bumpers) {
      const bm = createBumperMesh(bp.r, game.theme);
      bm.mesh.position.set(bp.x, 0.15, bp.z);
      bm.glow.position.set(bp.x, 0.03, bp.z);
      scene.add(bm.mesh);
      scene.add(bm.glow);
      game.bumperObjs.push({ mesh: bm.mesh, glow: bm.glow, x: bp.x, z: bp.z, radius: bp.r, cooldown: 0 });
    }
  }

  // Speed pads
  if (lvl.pads) {
    for (const pd of lvl.pads) {
      const pm = createSpeedPadMesh(pd.w, pd.d, pd.dx, pd.dz);
      pm.mesh.position.set(pd.x, 0.02, pd.z);
      pm.glow.position.set(pd.x, 0.04, pd.z);
      scene.add(pm.mesh);
      scene.add(pm.glow);
      game.padObjs.push({ mesh: pm.mesh, glow: pm.glow, x: pd.x, z: pd.z, w: pd.w, d: pd.d, dx: pd.dx, dz: pd.dz, boost: pd.boost });
    }
  }

  // Warp portals
  if (lvl.warps) {
    for (const wp of lvl.warps) {
      const wA = createWarpMesh(wp.r);
      wA.mesh.position.set(wp.ax, 0.2, wp.az);
      wA.mesh.rotation.x = Math.PI / 2;
      wA.glow.position.set(wp.ax, 0.15, wp.az);
      scene.add(wA.mesh);
      scene.add(wA.glow);

      const wB = createWarpMesh(wp.r);
      wB.mesh.position.set(wp.bx, 0.2, wp.bz);
      wB.mesh.rotation.x = Math.PI / 2;
      wB.glow.position.set(wp.bx, 0.15, wp.bz);
      scene.add(wB.mesh);
      scene.add(wB.glow);

      game.warpObjs.push({
        meshA: wA.mesh, glowA: wA.glow, meshB: wB.mesh, glowB: wB.glow,
        ax: wp.ax, az: wp.az, bx: wp.bx, bz: wp.bz,
        radius: wp.r, cooldown: 0,
      });
    }
  }

  // Create particle (hidden until launch)
  const pm = createParticleMesh(game.skin);
  pm.mesh.position.set(lvl.sx, 0.15, lvl.sz);
  pm.glow.position.set(lvl.sx, 0.15, lvl.sz);
  pm.mesh.visible = true;
  pm.glow.visible = true;
  scene.add(pm.mesh);
  scene.add(pm.glow);
  game.particleMesh = pm.mesh;
  game.particleGlow = pm.glow;
  game.particleX = lvl.sx;
  game.particleZ = lvl.sz;
  game.particleVX = 0;
  game.particleVZ = 0;

  // Trail line
  const trailGeo = new BufferGeometry();
  const positions = new Float32Array(TRAIL_LEN * 3);
  trailGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const trailMat = new LineBasicMaterial({ color: new Color(game.skin.color), transparent: true, opacity: 0.4 });
  game.trailLine = new Line(trailGeo, trailMat);
  scene.add(game.trailLine);
}

function clearLevel(game: GameManager, scene: any) {
  for (const w of game.wells) { scene.remove(w.mesh); scene.remove(w.glow); scene.remove(w.ring); }
  game.wells = [];
  for (const s of game.starObjs) scene.remove(s.mesh);
  game.starObjs = [];
  for (const w of game.wallObjs) scene.remove(w.mesh);
  game.wallObjs = [];
  for (const b of game.bhObjs) { scene.remove(b.mesh); scene.remove(b.glow); }
  game.bhObjs = [];
  for (const bp of game.bumperObjs) { scene.remove(bp.mesh); scene.remove(bp.glow); }
  game.bumperObjs = [];
  for (const pd of game.padObjs) { scene.remove(pd.mesh); scene.remove(pd.glow); }
  game.padObjs = [];
  for (const wp of game.warpObjs) { scene.remove(wp.meshA); scene.remove(wp.glowA); scene.remove(wp.meshB); scene.remove(wp.glowB); }
  game.warpObjs = [];
  if (game.particleMesh) { scene.remove(game.particleMesh); game.particleMesh = null; }
  if (game.particleGlow) { scene.remove(game.particleGlow); game.particleGlow = null; }
  if (game.startPortalMesh) { scene.remove(game.startPortalMesh); game.startPortalMesh = null; }
  if (game.endPortalMesh) { scene.remove(game.endPortalMesh); game.endPortalMesh = null; }
  if (game.startPortalGlow) { scene.remove(game.startPortalGlow); game.startPortalGlow = null; }
  if (game.endPortalGlow) { scene.remove(game.endPortalGlow); game.endPortalGlow = null; }
  if (game.trailLine) { scene.remove(game.trailLine); game.trailLine = null; }
  for (const d of game.previewDots) scene.remove(d);
  game.previewDots = [];
}

// ─── Physics ────────────────────────────────────────────────────────
function simulateStep(px: number, pz: number, vx: number, vz: number, wells: GravityWell[], dt: number): { px: number; pz: number; vx: number; vz: number } {
  for (const w of wells) {
    const dx = w.x - px;
    const dz = w.z - pz;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);
    if (dist < MIN_DIST) continue;
    const force = G_CONST * w.strength / Math.max(distSq, MIN_DIST * MIN_DIST);
    const dir = w.type === 'attractor' ? 1 : -1;
    vx += dir * force * (dx / dist) * dt;
    vz += dir * force * (dz / dist) * dt;
  }
  px += vx * dt;
  pz += vz * dt;
  return { px, pz, vx, vz };
}

function updatePreview(game: GameManager, scene: any) {
  // Remove old preview dots
  for (const d of game.previewDots) scene.remove(d);
  game.previewDots = [];

  if (game.state !== 'placing') return;

  // Draw field lines around wells
  if (game.wells.length > 0) {
    const lineMat = new MeshBasicMaterial({ color: new Color(game.theme.accent), transparent: true, opacity: 0.12 });
    const lineGeo = new SphereGeometry(0.02, 4, 4);
    for (const well of game.wells) {
      const numLines = 8;
      for (let l = 0; l < numLines; l++) {
        const angle = (l / numLines) * Math.PI * 2;
        const startDist = WELL_R * 2;
        const endDist = well.strength * 0.25 + 0.5;
        const steps = 8;
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const dist = startDist + t * endDist;
          const fx = well.x + Math.cos(angle + t * 0.3) * dist;
          const fz = well.z + Math.sin(angle + t * 0.3) * dist;
          if (Math.abs(fx) <= HF_W && Math.abs(fz) <= HF_H) {
            const dot = new Mesh(lineGeo, lineMat);
            dot.position.set(fx, 0.08, fz);
            scene.add(dot);
            game.previewDots.push(dot);
          }
        }
      }
    }
  }

  // Trajectory preview
  if (game.wells.length === 0) return;

  const lvl = game.mode === 'campaign' || game.mode === 'gauntlet' ? game.currentLevelDef : LEVELS[0];
  let px = game.particleX, pz = game.particleZ;
  let vx = (game.mode === 'campaign' || game.mode === 'gauntlet' ? lvl.ex : 3.5) - px;
  let vz = (game.mode === 'campaign' || game.mode === 'gauntlet' ? lvl.ez : 0) - pz;
  const mag = Math.sqrt(vx * vx + vz * vz);
  if (mag > 0) { vx = (vx / mag) * 3; vz = (vz / mag) * 3; }

  const dotMat = new MeshBasicMaterial({ color: new Color(game.skin.color), transparent: true, opacity: 0.3 });
  const dotGeo = new SphereGeometry(0.03, 4, 4);

  for (let i = 0; i < PREVIEW_STEPS; i++) {
    const result = simulateStep(px, pz, vx, vz, game.wells, PREVIEW_DT);
    px = result.px; pz = result.pz; vx = result.vx; vz = result.vz;

    if (Math.abs(px) > HF_W + 0.5 || Math.abs(pz) > HF_H + 0.5) break;

    if (i % 5 === 0) {
      const dot = new Mesh(dotGeo, dotMat);
      dot.position.set(px, 0.12, pz);
      scene.add(dot);
      game.previewDots.push(dot);
    }
  }
}

// ─── ECS Systems ────────────────────────────────────────────────────
class GravityPhysicsSystem extends createSystem({}) {
  private game!: GameManager;

  setRefs(refs: { game: GameManager }) { this.game = refs.game; }

  update(delta: number, _time: number) {
    const game = this.game;
    if (!game) return;

    // Update particle FX and starfield (always, every frame)
    game.fx.update(delta);
    game.starfield.update(delta);
    game.floatingText.update(delta);
    game.screenShake.update(delta, this.camera);

    // Auto-save periodically
    game.saveTimer += delta;
    if (game.saveTimer >= game.saveInterval) {
      game.saveTimer = 0;
      saveGame(game);
    }

    // Rotate stars
    for (const s of game.starObjs) {
      if (!s.collected) s.mesh.rotation.y += delta * 2;
    }

    // Rotate portals
    if (game.startPortalMesh) game.startPortalMesh.rotation.z += delta * 0.5;
    if (game.endPortalMesh) game.endPortalMesh.rotation.z -= delta * 0.5;

    // Pulse black holes
    for (const b of game.bhObjs) {
      const s = 1 + Math.sin(_time * 3) * 0.1;
      b.glow.scale.set(s, s, s);
    }

    // Pulse well rings
    for (const w of game.wells) {
      const s = 1 + Math.sin(_time * 4) * 0.15;
      w.ring.scale.set(s, 1, s);
    }

    // Pulse bumpers
    for (const bp of game.bumperObjs) {
      const s = 1 + Math.sin(_time * 5) * 0.08;
      bp.glow.scale.set(s, 1, s);
    }

    // Animate speed pads
    for (const pd of game.padObjs) {
      pd.glow.position.y = 0.04 + Math.sin(_time * 6) * 0.015;
    }

    // Rotate warp portals
    for (const wp of game.warpObjs) {
      wp.meshA.rotation.z += delta * 2;
      wp.meshB.rotation.z -= delta * 2;
      const ws = 1 + Math.sin(_time * 3) * 0.12;
      wp.glowA.scale.set(ws, ws, ws);
      wp.glowB.scale.set(ws, ws, ws);
    }

    // Countdown
    if (game.state === 'countdown') {
      game.countdownTimer += delta;
      const newVal = 3 - Math.floor(game.countdownTimer);
      if (newVal !== game.countdownVal && newVal > 0) {
        game.countdownVal = newVal;
        game.audio.countdown();
      }
      if (game.countdownTimer >= 3) {
        game.state = 'simulating';
        game.audio.countdownGo();
        // Launch particle
        const lvl = game.currentLevelDef;
        let tx = lvl.ex - game.particleX;
        let tz = lvl.ez - game.particleZ;
        const mag = Math.sqrt(tx * tx + tz * tz);
        if (mag > 0) { tx /= mag; tz /= mag; }
        game.particleVX = tx * 3;
        game.particleVZ = tz * 3;
        game.particleActive = true;
        game.levelStartTime = _time;
      }
      return;
    }

    if (game.state !== 'simulating' || !game.particleActive) return;

    // Timer
    game.timer += delta;

    // Zen mode timer for achievements
    if (game.mode === 'zen') {
      game.zenTimer += delta;
      if (game.zenTimer >= 300) game.unlockedAchievements.add('zen_5');
    }

    // Physics simulation
    const result = simulateStep(game.particleX, game.particleZ, game.particleVX, game.particleVZ, game.wells, delta);
    game.particleX = result.px;
    game.particleZ = result.pz;
    game.particleVX = result.vx;
    game.particleVZ = result.vz;

    // Speed cap — prevent runaway velocity
    const speed = Math.sqrt(game.particleVX * game.particleVX + game.particleVZ * game.particleVZ);
    const MAX_SPEED = 20;
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      game.particleVX *= scale;
      game.particleVZ *= scale;
    }

    // Update mesh position
    if (game.particleMesh) {
      game.particleMesh.position.set(game.particleX, 0.15, game.particleZ);
      game.particleGlow!.position.set(game.particleX, 0.15, game.particleZ);

      // Speed-based visual effects
      const curSpeed = Math.sqrt(game.particleVX * game.particleVX + game.particleVZ * game.particleVZ);
      game.lastSpeed = curSpeed;
      game.maxSpeedReached = Math.max(game.maxSpeedReached, curSpeed);

      // Dynamic particle glow based on speed
      const speedNorm = Math.min(curSpeed / MAX_SPEED, 1);
      const glowScale = PARTICLE_R * (2.5 + speedNorm * 3);
      game.particleGlow!.scale.setScalar(glowScale / (PARTICLE_R * 2.5));
      (game.particleGlow!.material as MeshBasicMaterial).opacity = 0.15 + speedNorm * 0.25;

      // Speed-based emissive intensity on particle
      (game.particleMesh.material as MeshStandardMaterial).emissiveIntensity = 0.8 + speedNorm * 1.2;
    }

    // Update trail with speed-based coloring
    game.particleTrail.push(new Vector3(game.particleX, 0.12, game.particleZ));
    if (game.particleTrail.length > TRAIL_LEN) game.particleTrail.shift();
    if (game.trailLine) {
      const positions = game.trailLine.geometry.attributes.position;
      for (let i = 0; i < TRAIL_LEN; i++) {
        const pt = game.particleTrail[i];
        if (pt) {
          positions.setXYZ(i, pt.x, pt.y, pt.z);
        } else {
          positions.setXYZ(i, game.particleX, 0.12, game.particleZ);
        }
      }
      positions.needsUpdate = true;
      game.trailLine.geometry.setDrawRange(0, game.particleTrail.length);

      // Dynamic trail color based on current speed
      const speedNorm2 = Math.min(game.lastSpeed / MAX_SPEED, 1);
      const trailColor = new Color();
      if (speedNorm2 < 0.33) {
        trailColor.setHSL(0.55, 1, 0.5); // cyan
      } else if (speedNorm2 < 0.66) {
        trailColor.setHSL(0.15, 1, 0.5); // yellow-orange
      } else {
        trailColor.setHSL(0.0, 1, 0.5);  // red
      }
      (game.trailLine.material as LineBasicMaterial).color.copy(trailColor);
      (game.trailLine.material as LineBasicMaterial).opacity = 0.3 + speedNorm2 * 0.4;
    }

    // Camera tracking — smoothly follow particle during simulation
    if (game.cameraFollowEnabled) {
      game.camTargetX = game.particleX * 0.4;
      game.camTargetZ = game.particleZ * 0.4 + game.camOffsetZ;
      const camPos = this.camera.position;
      const lerpFactor = 1 - Math.exp(-game.camSmoothing * delta);
      camPos.x += (game.camTargetX - camPos.x) * lerpFactor;
      camPos.z += (game.camTargetZ - camPos.z) * lerpFactor;
    }

    // Wall collisions
    for (const w of game.wallObjs) {
      const halfW = w.w / 2 + PARTICLE_R;
      const halfD = w.d / 2 + PARTICLE_R;
      if (game.particleX > w.x - halfW && game.particleX < w.x + halfW &&
          game.particleZ > w.z - halfD && game.particleZ < w.z + halfD) {
        // Find closest edge and bounce
        const dx1 = game.particleX - (w.x - halfW);
        const dx2 = (w.x + halfW) - game.particleX;
        const dz1 = game.particleZ - (w.z - halfD);
        const dz2 = (w.z + halfD) - game.particleZ;
        const minD = Math.min(dx1, dx2, dz1, dz2);
        if (minD === dx1 || minD === dx2) {
          game.particleVX *= -0.8;
          game.particleX += (minD === dx1 ? -0.05 : 0.05);
        } else {
          game.particleVZ *= -0.8;
          game.particleZ += (minD === dz1 ? -0.05 : 0.05);
        }
        if (!game.wallBounced) { game.wallBounced = true; }
        game.audio.wallBounce();
        game.screenShake.trigger(0.08);
      }
    }

    // Star collection
    for (const s of game.starObjs) {
      if (s.collected) continue;
      const dx = game.particleX - s.x;
      const dz = game.particleZ - s.z;
      if (dx * dx + dz * dz < (STAR_R + PARTICLE_R) * (STAR_R + PARTICLE_R)) {
        s.collected = true;
        s.mesh.visible = false;
        game.starsCollected++;
        game.comboCount++;
        game.stats.starsTotal++;
        game.audio.comboStar(game.comboCount);
        game.fx.burst(s.x, 0.3, s.z, '#ffdd00', 12 + game.comboCount * 4, 2.5, 0.5);
        // Floating combo indicator
        if (game.comboCount >= 2) {
          game.floatingText.spawn(s.x, 0.6, s.z, '#ffdd00', 0.4 + game.comboCount * 0.15);
        }
        // Warp star achievement — collected within 1s of warping
        if (game.lastWarpTime > 0 && (_time - game.lastWarpTime) < 1) {
          game.unlockedAchievements.add('warp_star');
        }
      }
    }

    // Black hole check
    for (const b of game.bhObjs) {
      const dx = game.particleX - b.x;
      const dz = game.particleZ - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < b.radius * 0.5) {
        // Death
        game.particleActive = false;
        game.audio.blackHoleDeath();
        game.fx.burst(game.particleX, 0.15, game.particleZ, '#440066', 30, 4, 0.8);
        game.screenShake.trigger(0.4);
        game.state = 'gameover';
        game.score = 0;
        saveGame(game);
        return;
      }
      // Close call achievement check
      if (dist < b.radius + 0.3 && dist > b.radius * 0.5) {
        if (!game.unlockedAchievements.has('close_call')) {
          game.unlockedAchievements.add('close_call');
        }
      }
    }

    // Bumper collision
    for (const bp of game.bumperObjs) {
      if (bp.cooldown > 0) { bp.cooldown -= delta; continue; }
      const dx = game.particleX - bp.x;
      const dz = game.particleZ - bp.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bp.radius + PARTICLE_R) {
        // Bounce off bumper
        const nx = dx / dist;
        const nz = dz / dist;
        const dot = game.particleVX * nx + game.particleVZ * nz;
        game.particleVX -= 2 * dot * nx;
        game.particleVZ -= 2 * dot * nz;
        // Add a kick
        const kickMag = 4;
        game.particleVX += nx * kickMag;
        game.particleVZ += nz * kickMag;
        // Push out of bumper
        game.particleX = bp.x + nx * (bp.radius + PARTICLE_R + 0.05);
        game.particleZ = bp.z + nz * (bp.radius + PARTICLE_R + 0.05);
        bp.cooldown = 0.2;
        game.bumperHits++;
        game.audio.bumperHit();
        game.fx.burst(game.particleX, 0.15, game.particleZ, '#ff44ff', 10, 3, 0.4);
        game.screenShake.trigger(0.15);
        // Flash bumper
        const origScale = bp.mesh.scale.x;
        bp.mesh.scale.set(origScale * 1.3, 1, origScale * 1.3);
        setTimeout(() => bp.mesh.scale.set(origScale, 1, origScale), 100);
        // Achievements
        game.unlockedAchievements.add('bumper_bounce');
        if (game.bumperHits >= 3) game.unlockedAchievements.add('bumper_chain_3');
      }
    }

    // Speed pad collision
    for (const pd of game.padObjs) {
      const halfW = pd.w / 2;
      const halfD = pd.d / 2;
      if (game.particleX > pd.x - halfW && game.particleX < pd.x + halfW &&
          game.particleZ > pd.z - halfD && game.particleZ < pd.z + halfD) {
        const mag = Math.sqrt(pd.dx * pd.dx + pd.dz * pd.dz);
        if (mag > 0) {
          game.particleVX += (pd.dx / mag) * pd.boost;
          game.particleVZ += (pd.dz / mag) * pd.boost;
        }
        game.speedPadHits++;
        game.audio.speedBoost();
        game.fx.burst(game.particleX, 0.1, game.particleZ, '#44ff44', 8, 2, 0.3);
        game.unlockedAchievements.add('speed_boost');
        if (game.speedPadHits >= 3) game.unlockedAchievements.add('speed_3');
        // Move particle past pad to prevent re-trigger
        game.particleX += (pd.dx / (mag || 1)) * 0.15;
        game.particleZ += (pd.dz / (mag || 1)) * 0.15;
      }
    }

    // Warp portal collision
    for (const wp of game.warpObjs) {
      if (wp.cooldown > 0) { wp.cooldown -= delta; continue; }
      const dxA = game.particleX - wp.ax;
      const dzA = game.particleZ - wp.az;
      const distA = Math.sqrt(dxA * dxA + dzA * dzA);
      if (distA < wp.radius) {
        game.particleX = wp.bx;
        game.particleZ = wp.bz;
        wp.cooldown = 0.5;
        game.warpUses++;
        game.lastWarpTime = _time;
        game.audio.warpPortal();
        game.fx.ring(wp.ax, 0.2, wp.az, '#ff8844', wp.radius, 12);
        game.fx.burst(wp.bx, 0.2, wp.bz, '#ff8844', 8, 2, 0.4);
        game.unlockedAchievements.add('warp_used');
        continue;
      }
      const dxB = game.particleX - wp.bx;
      const dzB = game.particleZ - wp.bz;
      const distB = Math.sqrt(dxB * dxB + dzB * dzB);
      if (distB < wp.radius) {
        game.particleX = wp.ax;
        game.particleZ = wp.az;
        wp.cooldown = 0.5;
        game.warpUses++;
        game.lastWarpTime = _time;
        game.audio.warpPortal();
        game.fx.ring(wp.bx, 0.2, wp.bz, '#ff8844', wp.radius, 12);
        game.fx.burst(wp.ax, 0.2, wp.az, '#ff8844', 8, 2, 0.4);
        game.unlockedAchievements.add('warp_used');
      }
    }

    // End portal check
    if (game.endPortalMesh) {
      const dx = game.particleX - game.endPortalMesh.position.x;
      const dz = game.particleZ - game.endPortalMesh.position.z;
      if (dx * dx + dz * dz < PORTAL_R * PORTAL_R) {
        // Win!
        game.particleActive = false;
        game.score = game.calcScore();
        game.stats.wins++;
        game.stats.gamesPlayed++;
        game.stats.timePlayed += game.timer;
        if (game.score > game.stats.bestScore) game.stats.bestScore = game.score;
        game.addLeaderboardEntry(game.score);
        game.totalXP += Math.floor(game.score / 10);

        const rating = game.calcStarRating();
        if (game.mode === 'campaign' && game.currentLevel < 40) {
          game.levelBestStars[game.currentLevel] = Math.max(game.levelBestStars[game.currentLevel], rating);
          game.highestUnlockedLevel = Math.max(game.highestUnlockedLevel, game.currentLevel + 1);
        }

        // Check specific achievements
        if (rating === 3) game.unlockedAchievements.add('three_stars');
        if (game.starsCollected === 0 && game.starObjs.length > 0) game.unlockedAchievements.add('no_stars');
        if (game.timer < 5) game.unlockedAchievements.add('fast_clear');
        if (game.timer > 30) game.unlockedAchievements.add('slow_clear');
        if (game.wallBounced) game.unlockedAchievements.add('bounce_wall');
        if (game.comboCount >= 2) game.unlockedAchievements.add('combo_2');
        if (game.comboCount >= 3) game.unlockedAchievements.add('combo_3');
        if (game.wellsUsed === 1) game.unlockedAchievements.add('min_wells_1');
        const hasAttractor = game.wells.some(w => w.type === 'attractor');
        const hasRepulsor = game.wells.some(w => w.type === 'repulsor');
        if (hasAttractor && hasRepulsor) game.unlockedAchievements.add('mixed_wells');
        if (game.mode === 'campaign' && game.currentLevel >= 9) game.unlockedAchievements.add('campaign_5');
        if (game.mode === 'campaign' && game.currentLevel >= 19) game.unlockedAchievements.add('campaign_20');
        if (game.mode === 'campaign' && game.currentLevel >= 29) game.unlockedAchievements.add('campaign_all');
        if (game.mode === 'campaign' && game.currentLevel >= 30) game.unlockedAchievements.add('campaign_30');
        if (game.mode === 'campaign' && game.currentLevel >= 39) game.unlockedAchievements.add('campaign_40');
        if (game.mode === 'quickplay') game.unlockedAchievements.add('quickplay_1');
        if (game.mode === 'timetrial' && game.timer < 30) game.unlockedAchievements.add('timetrial_1');
        if (game.mode === 'minimal') game.unlockedAchievements.add('minimal_1');
        if (game.mode === 'daily') game.unlockedAchievements.add('daily_1');
        if (game.stats.starsTotal >= 200) game.unlockedAchievements.add('all_stars_200');
        // No bumper achievement
        if (game.bumperObjs.length > 0 && game.bumperHits === 0) game.unlockedAchievements.add('no_bumper');
        game.checkAchievements();

        game.audio.levelWin();
        game.fx.ring(game.endPortalMesh!.position.x, 0.2, game.endPortalMesh!.position.z, game.theme.accent, 1.5, 24);
        game.fx.burst(game.endPortalMesh!.position.x, 0.3, game.endPortalMesh!.position.z, '#ffdd00', 20, 3, 0.7);
        game.screenShake.trigger(0.2);
        saveGame(game);
        game.state = 'gameover';
        return;
      }
    }

    // Out of bounds
    if (Math.abs(game.particleX) > HF_W + 1 || Math.abs(game.particleZ) > HF_H + 1) {
      game.particleActive = false;
      game.stats.gamesPlayed++;
      game.audio.levelFail();
      game.fx.burst(game.particleX, 0.15, game.particleZ, '#ff4444', 15, 3, 0.5);
      game.screenShake.trigger(0.25);
      game.state = 'gameover';
      game.score = 0;
      saveGame(game);
    }

    // Time trial: check time limit
    if (game.mode === 'timetrial' && game.timer > 60) {
      game.particleActive = false;
      game.stats.gamesPlayed++;
      game.audio.levelFail();
      game.state = 'gameover';
      game.score = 0;
      saveGame(game);
    }
  }
}


// ─── UI System ──────────────────────────────────────────────────────
class GravityUISystem extends createSystem({
  title: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/title.json')] },
  modes: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/modes.json')] },
  diff: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/difficulty.json')] },
  hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  pause: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  gameover: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
  lb: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/leaderboard.json')] },
  achv: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achvlist.json')] },
  settings: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  stats: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
  skins: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/skins.json')] },
  help: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/help.json')] },
  toast: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/toast.json')] },
  cd: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/countdown.json')] },
  ls: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/levelselect.json')] },
  wp: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/wellpicker.json')] },
}) {
  private game!: GameManager;
  private panelEntities: Map<string, Entity> = new Map();
  private toastTimer = 0;
  private toastVisible = false;

  setRefs(refs: { game: GameManager; panelEntities: Map<string, Entity> }) {
    this.game = refs.game;
    this.panelEntities = refs.panelEntities;
  }

  private getDoc(entity: Entity): UIKitDocument | undefined {
    return entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  }

  private setText(entity: Entity, id: string, text: string) {
    const doc = this.getDoc(entity);
    const el = doc?.getElementById(id) as UIKit.Text | undefined;
    el?.setProperties({ text });
  }

  private wireBtn(entity: Entity, id: string, fn: () => void) {
    const doc = this.getDoc(entity);
    const el = doc?.getElementById(id);
    if (el) (el as any).addEventListener('click', fn);
  }

  private showPanel(name: string) {
    for (const [n, e] of this.panelEntities) {
      if (e.object3D) e.object3D.visible = (n === name);
    }
  }

  private showPanels(...names: string[]) {
    for (const [n, e] of this.panelEntities) {
      if (e.object3D) e.object3D.visible = names.includes(n);
    }
  }

  private showToast(text: string) {
    const toastEntity = this.panelEntities.get('toast');
    if (toastEntity) {
      this.setText(toastEntity, 'toast-text', text);
      if (toastEntity.object3D) toastEntity.object3D.visible = true;
      this.toastVisible = true;
      this.toastTimer = 0;
    }
  }

  init() {
    const game = this.game;
    const show = (name: string) => { game.audio.buttonClick(); this.showPanel(name); };

    // Title panel
    this.queries.title.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-play', () => { show('modes'); game.state = 'modes'; });
      this.wireBtn(entity, 'btn-scores', () => { this.updateLeaderboard(entity); show('leaderboard'); game.state = 'leaderboard'; });
      this.wireBtn(entity, 'btn-achv', () => { game.achvPage = 0; this.updateAchievements(); show('achvlist'); game.state = 'achievements'; });
      this.wireBtn(entity, 'btn-stats', () => { this.updateStats(); show('stats'); game.state = 'stats'; });
      this.wireBtn(entity, 'btn-skins', () => { this.updateSkins(); show('skins'); game.state = 'skins'; });
      this.wireBtn(entity, 'btn-settings', () => { show('settings'); game.state = 'settings'; });
      this.wireBtn(entity, 'btn-help', () => { show('help'); game.state = 'help'; });
    });

    // Modes panel
    this.queries.modes.subscribe('qualify', (entity) => {
      const startMode = (mode: Mode) => {
        game.mode = mode;
        game.audio.buttonClick();
        if (mode === 'campaign') { game.lsPage = 0; this.updateLevelSelect(); this.showPanel('levelselect'); game.state = 'levelselect'; }
        else { this.showPanel('difficulty'); game.state = 'difficulty'; }
      };
      this.wireBtn(entity, 'btn-campaign', () => startMode('campaign'));
      this.wireBtn(entity, 'btn-quickplay', () => startMode('quickplay'));
      this.wireBtn(entity, 'btn-timetrial', () => startMode('timetrial'));
      this.wireBtn(entity, 'btn-minimal', () => startMode('minimal'));
      this.wireBtn(entity, 'btn-daily', () => startMode('daily'));
      this.wireBtn(entity, 'btn-sandbox', () => startMode('sandbox'));
      this.wireBtn(entity, 'btn-gauntlet', () => startMode('gauntlet'));
      this.wireBtn(entity, 'btn-zen', () => startMode('zen'));
      this.wireBtn(entity, 'btn-modes-back', () => { show('title'); game.state = 'title'; });
    });

    // Difficulty panel
    this.queries.diff.subscribe('qualify', (entity) => {
      const startWithDiff = (diff: Difficulty) => {
        game.difficulty = diff;
        game.audio.buttonClick();
        game.retryCount = 0;
        if (game.mode !== 'campaign') {
          game.currentLevel = 0;
        }
        loadLevel(game, this.scene);
        this.showPanels('hud', 'wellpicker');
        game.state = 'placing';
        updatePreview(game, this.scene);
      };
      this.wireBtn(entity, 'btn-easy', () => startWithDiff('easy'));
      this.wireBtn(entity, 'btn-medium', () => startWithDiff('medium'));
      this.wireBtn(entity, 'btn-hard', () => startWithDiff('hard'));
      this.wireBtn(entity, 'btn-diff-back', () => { show('modes'); game.state = 'modes'; });
    });

    // HUD - no buttons, just display

    // Pause panel
    this.queries.pause.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-resume', () => {
        game.audio.buttonClick();
        game.state = game.prevState;
        if (game.state === 'placing') this.showPanels('hud', 'wellpicker');
        else this.showPanel('hud');
      });
      this.wireBtn(entity, 'btn-quit', () => {
        game.audio.buttonClick();
        clearLevel(game, this.scene);
        this.showPanel('title');
        game.state = 'title';
      });
    });

    // Game Over panel
    this.queries.gameover.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-retry', () => {
        game.audio.buttonClick();
        game.retryCount++;
        if (game.retryCount >= 5) game.unlockedAchievements.add('retry_5');
        loadLevel(game, this.scene);
        this.showPanels('hud', 'wellpicker');
        game.state = 'placing';
        updatePreview(game, this.scene);
      });
      this.wireBtn(entity, 'btn-next', () => {
        game.audio.buttonClick();
        if (game.mode === 'campaign' && game.currentLevel < 39) {
          game.currentLevel++;
          game.retryCount = 0;
          loadLevel(game, this.scene);
          this.showPanels('hud', 'wellpicker');
          game.state = 'placing';
          updatePreview(game, this.scene);
        } else if (game.mode === 'gauntlet') {
          game.gauntletLevel++;
          game.currentLevel = Math.min(game.gauntletLevel, 39);
          loadLevel(game, this.scene);
          this.showPanels('hud', 'wellpicker');
          game.state = 'placing';
          updatePreview(game, this.scene);
        } else {
          clearLevel(game, this.scene);
          this.showPanel('title');
          game.state = 'title';
        }
      });
      this.wireBtn(entity, 'btn-go-menu', () => {
        game.audio.buttonClick();
        clearLevel(game, this.scene);
        this.showPanel('title');
        game.state = 'title';
      });
    });

    // Leaderboard panel
    this.queries.lb.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-lb-back', () => { show('title'); game.state = 'title'; });
    });

    // Achievements panel
    this.queries.achv.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-achv-prev', () => { if (game.achvPage > 0) game.achvPage--; this.updateAchievements(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-achv-next', () => { if ((game.achvPage + 1) * 8 < ACHIEVEMENTS.length) game.achvPage++; this.updateAchievements(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-achv-back', () => { show('title'); game.state = 'title'; });
    });

    // Settings panel
    this.queries.settings.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-vol-up', () => { game.audio.volume = Math.min(1, game.audio.volume + 0.1); game.audio.setVolume(game.audio.volume); this.updateSettings(); game.audio.buttonClick(); saveGame(game); });
      this.wireBtn(entity, 'btn-vol-down', () => { game.audio.volume = Math.max(0, game.audio.volume - 0.1); game.audio.setVolume(game.audio.volume); this.updateSettings(); game.audio.buttonClick(); saveGame(game); });
      this.wireBtn(entity, 'btn-theme-next', () => { game.themeIdx = (game.themeIdx + 1) % THEMES.length; this.updateSettings(); this.applyTheme(); game.unlockedAchievements.add('theme_change'); game.audio.buttonClick(); saveGame(game); });
      this.wireBtn(entity, 'btn-theme-prev', () => { game.themeIdx = (game.themeIdx - 1 + THEMES.length) % THEMES.length; this.updateSettings(); this.applyTheme(); game.audio.buttonClick(); saveGame(game); });
      this.wireBtn(entity, 'btn-set-back', () => { show('title'); game.state = 'title'; });
    });

    // Stats panel
    this.queries.stats.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-stat-back', () => { show('title'); game.state = 'title'; });
    });

    // Skins panel
    this.queries.skins.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-skin-prev', () => { game.skinIdx = (game.skinIdx - 1 + SKINS.length) % SKINS.length; this.updateSkins(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-skin-next', () => { game.skinIdx = (game.skinIdx + 1) % SKINS.length; this.updateSkins(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-skin-select', () => {
        if (game.unlockedSkins.has(game.skinIdx)) {
          game.unlockedAchievements.add('skin_change');
          game.audio.buttonClick();
        }
      });
      this.wireBtn(entity, 'btn-skin-back', () => { show('title'); game.state = 'title'; });
    });

    // Help panel
    this.queries.help.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-help-back', () => { show('title'); game.state = 'title'; });
    });

    // Level select panel
    this.queries.ls.subscribe('qualify', (entity) => {
      for (let i = 1; i <= 10; i++) {
        const idx = i;
        this.wireBtn(entity, `ls-${idx}`, () => {
          const lvlIdx = game.lsPage * 10 + idx - 1;
          if (lvlIdx < 40 && lvlIdx <= game.highestUnlockedLevel) {
            game.currentLevel = lvlIdx;
            game.audio.buttonClick();
            this.showPanel('difficulty');
            game.state = 'difficulty';
          }
        });
      }
      this.wireBtn(entity, 'btn-ls-prev', () => { if (game.lsPage > 0) game.lsPage--; this.updateLevelSelect(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-ls-next', () => { if (game.lsPage < 3) game.lsPage++; this.updateLevelSelect(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-ls-back', () => { show('modes'); game.state = 'modes'; });
    });

    // Well picker panel
    this.queries.wp.subscribe('qualify', (entity) => {
      this.wireBtn(entity, 'btn-wp-attract', () => { game.wellType = 'attractor'; this.updateWellPicker(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-wp-repulse', () => { game.wellType = 'repulsor'; this.updateWellPicker(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-wp-str-up', () => { game.wellStrength = Math.min(10, game.wellStrength + 1); this.updateWellPicker(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-wp-str-down', () => { game.wellStrength = Math.max(1, game.wellStrength - 1); this.updateWellPicker(); game.audio.buttonClick(); });
      this.wireBtn(entity, 'btn-wp-undo', () => {
        game.audio.buttonClick();
        if (game.wells.length > 0) {
          const w = game.wells.pop()!;
          this.scene.remove(w.mesh);
          this.scene.remove(w.glow);
          this.scene.remove(w.ring);
          game.wellsUsed--;
          game.audio.removeWell();
          updatePreview(game, this.scene);
        }
      });
      this.wireBtn(entity, 'btn-wp-close', () => {
        game.audio.buttonClick();
        // Start countdown to launch
        game.countdownVal = 3;
        game.countdownTimer = 0;
        game.state = 'countdown';
        this.showPanels('hud', 'countdown');
        game.audio.launch();
      });
    });
  }

  private updateTitle() {
    const entity = this.panelEntities.get('title');
    if (!entity) return;
    const lvl = this.game.getPlayerLevel();
    const xpProg = this.game.getPlayerXPProgress();
    this.setText(entity, 'lvl-badge', `LVL ${lvl}`);
    this.setText(entity, 'xp-text', `${xpProg} / 100 XP`);
    // Campaign progress
    const cleared = this.game.highestUnlockedLevel;
    const totalStars = this.game.levelBestStars.reduce((a, b) => a + b, 0);
    this.setText(entity, 'title-progress', `Campaign: ${cleared}/40 | Stars: ${totalStars}/120`);
  }

  private updateLeaderboard(_triggerEntity: Entity) {
    const lbEntity = this.panelEntities.get('leaderboard');
    if (!lbEntity) return;
    for (let i = 1; i <= 10; i++) {
      const score = this.game.leaderboard[i - 1];
      this.setText(lbEntity, `lb-${i}`, score !== undefined ? String(score) : '---');
    }
  }

  private updateAchievements() {
    const entity = this.panelEntities.get('achvlist');
    if (!entity) return;
    const start = this.game.achvPage * 8;
    this.setText(entity, 'achv-count', `${this.game.unlockedAchievements.size} / ${ACHIEVEMENTS.length} Unlocked`);
    for (let i = 1; i <= 8; i++) {
      const a = ACHIEVEMENTS[start + i - 1];
      if (a) {
        const unlocked = this.game.unlockedAchievements.has(a.id);
        this.setText(entity, `ach-name-${i}`, unlocked ? a.name : '???');
        this.setText(entity, `ach-desc-${i}`, unlocked ? a.desc : 'Locked');
      } else {
        this.setText(entity, `ach-name-${i}`, '');
        this.setText(entity, `ach-desc-${i}`, '');
      }
    }
  }

  private updateStats() {
    const entity = this.panelEntities.get('stats');
    if (!entity) return;
    const s = this.game.stats;
    this.setText(entity, 'stat-games', String(s.gamesPlayed));
    this.setText(entity, 'stat-wins', String(s.wins));
    this.setText(entity, 'stat-stars-total', String(s.starsTotal));
    this.setText(entity, 'stat-wells-placed', String(s.wellsPlaced));
    this.setText(entity, 'stat-time-played', `${Math.floor(s.timePlayed / 60)}m`);
    this.setText(entity, 'stat-best-score', String(s.bestScore));
  }

  private updateSkins() {
    const entity = this.panelEntities.get('skins');
    if (!entity) return;
    const skin = SKINS[this.game.skinIdx];
    this.setText(entity, 'skin-name', skin.name);
    this.setText(entity, 'skin-status', this.game.unlockedSkins.has(this.game.skinIdx) ? 'Unlocked' : `Locked: ${skin.unlock}`);
  }

  private updateSettings() {
    const entity = this.panelEntities.get('settings');
    if (!entity) return;
    this.setText(entity, 'vol-label', `${Math.round(this.game.audio.volume * 100)}%`);
    this.setText(entity, 'theme-label', this.game.theme.name);
  }

  private updateLevelSelect() {
    const entity = this.panelEntities.get('levelselect');
    if (!entity) return;
    this.setText(entity, 'ls-page', `Page ${this.game.lsPage + 1} / 4`);
    for (let i = 1; i <= 10; i++) {
      const lvlIdx = this.game.lsPage * 10 + i - 1;
      const stars = this.game.levelBestStars[lvlIdx] || 0;
      const locked = lvlIdx > this.game.highestUnlockedLevel;
      if (locked) {
        this.setText(entity, `ls-${i}`, lvlIdx < 40 ? `[${lvlIdx + 1}]` : '');
      } else {
        const starStr = stars > 0 ? ` ${'*'.repeat(stars)}` : '';
        this.setText(entity, `ls-${i}`, lvlIdx < 40 ? `${lvlIdx + 1}${starStr}` : '');
      }
    }
  }

  private updateWellPicker() {
    const entity = this.panelEntities.get('wellpicker');
    if (!entity) return;
    this.setText(entity, 'wp-type', this.game.wellType === 'attractor' ? 'Attractor' : 'Repulsor');
    this.setText(entity, 'wp-strength', String(this.game.wellStrength));
  }

  private updateHUD() {
    const entity = this.panelEntities.get('hud');
    if (!entity) return;
    this.setText(entity, 'hud-score', String(this.game.score));
    this.setText(entity, 'hud-wells', `${this.game.maxWells - this.game.wellsUsed}`);
    this.setText(entity, 'hud-stars', `${this.game.starsCollected}/${this.game.starObjs.length}`);
    this.setText(entity, 'hud-level', this.game.mode === 'campaign' ? String(this.game.currentLevel + 1) : '-');
    this.setText(entity, 'hud-mode', MODE_NAMES[this.game.mode] || '');
    const speedDisplay = Math.round(this.game.lastSpeed * 10);
    this.setText(entity, 'hud-speed', String(speedDisplay));
    this.setText(entity, 'hud-combo', this.game.comboCount > 0 ? `x${this.game.comboCount}` : '-');
    const mins = Math.floor(this.game.timer / 60);
    const secs = Math.floor(this.game.timer % 60);
    this.setText(entity, 'hud-timer', `${mins}:${secs < 10 ? '0' : ''}${secs}`);
  }

  private updateGameOver() {
    const entity = this.panelEntities.get('gameover');
    if (!entity) return;
    const won = this.game.score > 0;
    this.setText(entity, 'go-title', won ? 'LEVEL COMPLETE' : 'LEVEL FAILED');
    this.setText(entity, 'go-score', `Score: ${this.game.score}`);
    this.setText(entity, 'go-stars', `Stars: ${this.game.starsCollected}/${this.game.starObjs.length}`);
    this.setText(entity, 'go-wells', `Wells Used: ${this.game.wellsUsed}`);
    const extras: string[] = [];
    if (this.game.bumperHits > 0) extras.push(`Bumpers: ${this.game.bumperHits}`);
    if (this.game.speedPadHits > 0) extras.push(`Boosts: ${this.game.speedPadHits}`);
    if (this.game.warpUses > 0) extras.push(`Warps: ${this.game.warpUses}`);
    const extraStr = extras.length > 0 ? extras.join(' / ') : '';
    const rating = won ? this.game.calcStarRating() : 0;
    this.setText(entity, 'go-rating', rating > 0
      ? '*'.repeat(rating) + (rating < 3 ? '-'.repeat(3 - rating) : '') + (extraStr ? ` ${extraStr}` : '')
      : (extraStr || '---'));
    // Max speed and time
    const maxSpd = Math.round(this.game.maxSpeedReached * 10);
    this.setText(entity, 'go-max-speed', `Max Speed: ${maxSpd}`);
    const mins = Math.floor(this.game.timer / 60);
    const secs = Math.floor(this.game.timer % 60);
    this.setText(entity, 'go-time', `Time: ${mins}:${secs < 10 ? '0' : ''}${secs}`);
    // XP earned
    const xpEarned = won ? Math.floor(this.game.score / 10) : 0;
    this.setText(entity, 'go-xp', won ? `+${xpEarned} XP` : '');
    this.setText(entity, 'go-lvl', won ? `LVL ${this.game.getPlayerLevel()}` : '');
  }

  private updateCountdown() {
    const entity = this.panelEntities.get('countdown');
    if (!entity) return;
    const val = Math.max(1, this.game.countdownVal);
    this.setText(entity, 'cd-text', this.game.countdownTimer >= 2.5 ? 'GO!' : String(val));
  }

  private applyTheme() {
    const theme = this.game.theme;
    if (this.scene) {
      this.scene.background = new Color(theme.bg);
      this.scene.fog = new FogExp2(new Color(theme.fog), 0.04);
    }
    if (this.game.gridHelper) {
      this.game.gridHelper.material.color = new Color(theme.grid);
    }
    if (this.game.fieldFloor) {
      this.game.fieldFloor.material.color = new Color(theme.bg);
    }
  }

  update(delta: number, _time: number) {
    if (!this.game) return;

    // Toast timer
    if (this.toastVisible) {
      this.toastTimer += delta;
      if (this.toastTimer > 2) {
        this.toastVisible = false;
        const toastEntity = this.panelEntities.get('toast');
        if (toastEntity?.object3D) toastEntity.object3D.visible = false;
      }
    }

    // State-driven panel visibility
    const g = this.game;
    switch (g.state) {
      case 'title': this.showPanel('title'); this.updateTitle(); break;
      case 'modes': this.showPanel('modes'); break;
      case 'difficulty': this.showPanel('difficulty'); break;
      case 'levelselect': this.showPanel('levelselect'); break;
      case 'placing': this.showPanels('hud', 'wellpicker'); this.updateHUD(); this.updateWellPicker(); break;
      case 'countdown': this.showPanels('hud', 'countdown'); this.updateHUD(); this.updateCountdown(); break;
      case 'simulating': this.showPanel('hud'); this.updateHUD(); break;
      case 'gameover': this.updateGameOver(); this.showPanel('gameover'); break;
      case 'paused': this.showPanel('pause'); break;
      case 'leaderboard': this.showPanel('leaderboard'); break;
      case 'achievements': this.showPanel('achvlist'); break;
      case 'settings': this.showPanel('settings'); break;
      case 'stats': this.showPanel('stats'); break;
      case 'skins': this.showPanel('skins'); break;
      case 'help': this.showPanel('help'); break;
    }

    // Check for new achievement unlocks
    const newAchievements = g.checkAchievements();
    for (const id of newAchievements) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        this.showToast(`Unlocked: ${ach.name}`);
        g.audio.achievementUnlock();
      }
    }
  }
}


// ─── Input System ───────────────────────────────────────────────────
class GravityInputSystem extends createSystem({}) {
  private game!: GameManager;
  private raycaster = new Raycaster();
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private mouse = new Vector2();
  private intersection = new Vector3();
  private mouseDown = false;

  setRefs(refs: { game: GameManager }) {
    this.game = refs.game;

    // Mouse events on renderer
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', (e: MouseEvent) => {
      if (this.game.state !== 'placing') return;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersection);
      if (hit && this.game.wellsUsed < this.game.maxWells) {
        const wx = this.intersection.x;
        const wz = this.intersection.z;
        // Check within bounds
        if (Math.abs(wx) <= HF_W && Math.abs(wz) <= HF_H) {
          this.placeWell(wx, wz);
        }
      }
    });

    // Mouse move for ghost well preview
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.game.state !== 'placing') { this.game.ghostWell.hide(); return; }
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersection);
      if (hit && Math.abs(this.intersection.x) <= HF_W && Math.abs(this.intersection.z) <= HF_H && this.game.wellsUsed < this.game.maxWells) {
        this.game.ghostWell.update(this.intersection.x, this.intersection.z, this.game.wellType, this.game.wellStrength, this.game.theme);
      } else {
        this.game.ghostWell.hide();
      }
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (this.game.state !== 'placing') return;
      e.preventDefault();
      if (e.deltaY < 0) this.game.wellStrength = Math.min(10, this.game.wellStrength + 1);
      else this.game.wellStrength = Math.max(1, this.game.wellStrength - 1);
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (this.game.state !== 'placing') return;
      // Right-click to toggle well type
      this.game.wellType = this.game.wellType === 'attractor' ? 'repulsor' : 'attractor';
      this.game.audio.buttonClick();
    });
  }

  private placeWell(x: number, z: number) {
    const game = this.game;
    const wm = createWellMesh(game.wellType, game.wellStrength, game.theme);
    wm.mesh.position.set(x, 0.2, z);
    wm.glow.position.set(x, 0.2, z);
    wm.ring.position.set(x, 0.05, z);
    this.scene.add(wm.mesh);
    this.scene.add(wm.glow);
    this.scene.add(wm.ring);

    const well: GravityWell = {
      mesh: wm.mesh, glow: wm.glow, ring: wm.ring,
      x, z, type: game.wellType, strength: game.wellStrength,
    };
    game.wells.push(well);
    game.wellsUsed++;
    game.stats.wellsPlaced++;
    if (game.wellType === 'attractor') game.attractorsPlaced++;
    else game.repulsorsPlaced++;

    // Sandbox achievement
    if (game.mode === 'sandbox' && game.wellsUsed >= 10) {
      game.unlockedAchievements.add('sandbox_1');
    }

    game.audio.placeWell();
    const fxCol = game.wellType === 'attractor' ? game.theme.attractor : game.theme.repulsor;
    game.fx.burst(x, 0.2, z, fxCol, 10, 2, 0.4);
    updatePreview(game, this.scene);
  }

  update(delta: number, _time: number) {
    if (!this.game) return;
    const game = this.game;
    const kb = this.input.keyboard;

    // Hide ghost well when not placing
    if (game.state !== 'placing') game.ghostWell.hide();

    // Keyboard controls
    if (game.state === 'placing' || game.state === 'simulating') {
      // WASD camera pan
      const panSpeed = 5 * delta;
      if (kb.getKeyPressed('KeyW')) this.player.position.z -= panSpeed;
      if (kb.getKeyPressed('KeyS')) this.player.position.z += panSpeed;
      if (kb.getKeyPressed('KeyA')) this.player.position.x -= panSpeed;
      if (kb.getKeyPressed('KeyD')) this.player.position.x += panSpeed;
    }

    // Space to launch (from placing state)
    if (game.state === 'placing' && kb.getKeyDown('Space')) {
      game.countdownVal = 3;
      game.countdownTimer = 0;
      game.state = 'countdown';
      game.audio.launch();
    }

    // R to reset
    if ((game.state === 'placing' || game.state === 'simulating') && kb.getKeyDown('KeyR')) {
      game.audio.resetLevel();
      loadLevel(game, this.scene);
      game.state = 'placing';
      updatePreview(game, this.scene);
    }

    // Z to undo last well
    if (game.state === 'placing' && kb.getKeyDown('KeyZ')) {
      if (game.wells.length > 0) {
        const w = game.wells.pop()!;
        this.scene.remove(w.mesh);
        this.scene.remove(w.glow);
        this.scene.remove(w.ring);
        game.wellsUsed--;
        game.audio.removeWell();
        updatePreview(game, this.scene);
      }
    }

    // ESC to pause
    if ((game.state === 'placing' || game.state === 'simulating') && kb.getKeyDown('Escape')) {
      game.prevState = game.state;
      game.state = 'paused';
    }

    // XR input
    const right = this.input.xr.gamepads.right;
    if (right) {
      // Trigger to place well
      if (right.getButtonDown(InputComponent.Trigger) && game.state === 'placing') {
        const raySpace = this.world.playerSpaceEntities.raySpaces.right.object3D;
        if (raySpace) {
          const pos = new Vector3();
          const dir = new Vector3(0, 0, -1);
          raySpace.getWorldPosition(pos);
          raySpace.getWorldDirection(dir);
          this.raycaster.set(pos, dir);
          const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersection);
          if (hit && game.wellsUsed < game.maxWells) {
            if (Math.abs(this.intersection.x) <= HF_W && Math.abs(this.intersection.z) <= HF_H) {
              this.placeWell(this.intersection.x, this.intersection.z);
            }
          }
        }
      }

      // A button to launch
      if (right.getButtonDown(InputComponent.A_Button) && game.state === 'placing') {
        game.countdownVal = 3;
        game.countdownTimer = 0;
        game.state = 'countdown';
        game.audio.launch();
      }

      // B button to pause
      if (right.getButtonDown(InputComponent.B_Button) && (game.state === 'placing' || game.state === 'simulating')) {
        game.prevState = game.state;
        game.state = 'paused';
      }

      // Thumbstick to adjust strength
      const stick = right.getAxesValues(InputComponent.Thumbstick);
      if (stick && game.state === 'placing') {
        if (stick.y > 0.5) game.wellStrength = Math.min(10, game.wellStrength + 1);
        if (stick.y < -0.5) game.wellStrength = Math.max(1, game.wellStrength - 1);
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  if (!container) return;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    render: {
      near: 0.1,
      far: 100,
      camera: { position: [0, 12, 5], lookAt: [0, 0, 0] },
    },
    input: { canvasPointerEvents: true },
    features: {
      grabbing: false,
      locomotion: { browserControls: false },
    },
  });

  const game = new GameManager();
  game.scene = world.scene;

  // Scene setup
  const theme = game.theme;
  world.scene.background = new Color(theme.bg);
  world.scene.fog = new FogExp2(new Color(theme.fog), 0.04);

  // Lights
  const ambient = new AmbientLight(new Color('#ffffff'), 0.4);
  world.scene.add(ambient);
  const dirLight = new DirectionalLight(new Color('#ffffff'), 0.6);
  dirLight.position.set(5, 10, 5);
  world.scene.add(dirLight);

  // Build field
  buildField(world.scene, game);

  // Initialize visual effects
  game.fx.init(world.scene);
  game.starfield.init(world.scene);
  game.ghostWell.addToScene(world.scene);
  game.floatingText.init(world.scene);

  // Load saved progress
  loadGame(game);

  // Create panel entities
  const panelConfigs = [
    'title', 'modes', 'difficulty', 'hud', 'pause', 'gameover',
    'leaderboard', 'achvlist', 'settings', 'stats', 'skins',
    'help', 'toast', 'countdown', 'levelselect', 'wellpicker',
  ];

  const panelEntities = new Map<string, Entity>();
  for (const name of panelConfigs) {
    const entity = world.createTransformEntity();
    entity.addComponent(PanelUI, { config: `./ui/${name}.json` });
    entity.addComponent(ScreenSpace);
    if (entity.object3D) entity.object3D.visible = (name === 'title');
    panelEntities.set(name, entity);
  }

  // Register systems
  world.registerSystem(GravityPhysicsSystem);
  world.registerSystem(GravityUISystem);
  world.registerSystem(GravityInputSystem);

  const physicsSystem = world.getSystem(GravityPhysicsSystem)!;
  physicsSystem.setRefs({ game });

  const uiSystem = world.getSystem(GravityUISystem)!;
  uiSystem.setRefs({ game, panelEntities });

  const inputSystem = world.getSystem(GravityInputSystem)!;
  inputSystem.setRefs({ game });

  // Ambient audio
  game.audio.ambient();
}

main();
