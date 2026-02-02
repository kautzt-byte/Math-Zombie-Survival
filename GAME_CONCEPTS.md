# Game Concepts (Zombie Arena)

## Elevator Pitch
An arcade-style 3D arena survival game where you kite and dodge waves of zombies in quick, replayable runs with tight controls and readable feedback.

## Design Pillars
- **Fast feedback:** every answer immediately affects the arena.
- **Skill-forward:** players improve through mastery of movement, timing, and positioning.
- **Fair challenge:** difficulty scales smoothly; deaths feel earned and teachable.
- **Replayable runs:** short sessions, varied encounters, meaningful progression.

## Core Loop
1. Enter an arena round (solo or versus).
2. Fight enemies using a small, expressive moveset (attack/guard/dash/ability).
3. Manage risk: commit to aggressive plays for faster clears and better rewards.
4. Win by depleting the opponent / surviving the timer / completing objectives.
5. Earn rewards and unlock modifiers for the next round/run.

## Combat Feel Targets
- **Readability:** enemy tells and hitboxes are clear.
- **Responsiveness:** low input latency, consistent cancel windows.
- **Satisfaction:** strong hitstop, sound, camera shake (subtle), and VFX clarity.

## Difficulty & Scoring (Optional)
- Simple end-of-round results (time survived, enemies defeated, damage taken).
- Optional “rank” (S/A/B/C) to encourage replay without requiring perfection.

## Modes
- **Arcade Run:** short run with escalating arenas and modifiers.
- **Training:** sandbox room to test weapons/abilities.
- **Boss Challenge:** a single tough fight with learnable patterns.

## Progression
- Unlock weapons/abilities/characters (or variants) that change playstyle.
- Cosmetic rewards (skins, trails, arenas) as low-stakes goals.
- Light build system: equip 2–3 modifiers (e.g., “dash resets”, “guard heals”, “crit on perfect timing”).

## Accessibility & Learning
- Adjustable difficulty and assist options (damage taken, enemy speed, aim assist if relevant).
- Practice-friendly failure: quick restart, clear post-death tips (“you got hit by X after Y tell”).
- Colorblind-safe UI and readable typography.

## MVP Definition
- One arena, one enemy type (plus a tougher variant), one boss.
- One player kit: move, dash, light/heavy attack, simple ability, heal/guard.
- One run structure: 5 short rooms → boss → results screen → upgrade choice.
- Basic HUD: health, stamina/cooldowns, room count, run modifiers.

## Stretch Ideas
- Procedural arenas + hazards.
- Co-op survival.
- Daily challenges and leaderboards.
- “Mutators” that meaningfully change play (low gravity, glass cannon, relentless enemies).
