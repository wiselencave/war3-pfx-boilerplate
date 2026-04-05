# Warcraft 3 PopcornFX Boilerplate

Ready-to-use PopcornFX 2.5 project for creating custom particle effects for Warcraft III: Reforged.

## What's inside

The project is pre-configured so you can start making effects right away without dealing with axis setup, texture formats, baking configs, and path issues.

- **Relocated Library** — `Library/` moved into `Popcorn/Library/` so baked paths match Reforged's expected `Popcorn/Library/PopcornFXCore/...` structure
- **BC3 textures** — all default `.dds` textures re-compressed to BC3 (DXT5) for Reforged compatibility
- **Coordinate system** — the project axes coincide with the Warcraft axes *(I hope)*
- **Baking config** — minimal setup targeting a map folder, ready to use with Quick Bake
- **Attribute templates** — `War3Game` and `War3Weather` public templates with standard runtime attributes

## Attribute templates

Two public templates in `Library/Wiselen/` provide commonly used Reforged runtime attributes as reusable nodes:

### War3Game

| Attribute | Type |
|---|---|
| Game.LifespanMultiplier | float |
| Game.EmissionRateMultiplier | float |
| Game.SpeedMultiplier | float |
| Game.ColorMultiplier | float4 |
| Game.TeamColor | float4 |
| Game.TargetPosition | float3 |
| Game.Scale | float |

### War3Weather

| Attribute | Type |
|---|---|
| Weather.TileCenter | float3 |
| Weather.Size | float2 |
| Weather.EmissionRate | float |

To use them, add the `War3Game` or `War3Weather` node to any effect's particle graph. The attributes will automatically appear in the Effect Interface.

## Quick start

1. Clone the repo
2. Open the project in PK-Editor v2.5
3. Create a new effect in `FX/`
4. Add `War3Game` / `War3Weather` nodes if you need runtime attributes
5. Use **Quick Bake** to export into the map folder

## Baking

The baking config is located at `Popcorn/AssetBaker.pkcf`. It targets `map.w3x/` — an unpacked map folder at the project root, so baked files and assets end up directly inside the map.

Baking is also possible via the CLI tool `PopcornAssetBakerd.exe` for more advanced pipelines, but documentation for that workflow is not yet available.

## Important notes

- PK-Editor version **2.5.x** is required. Other versions may not be compatible with Reforged's runtime.
- The project uses a slightly different PopcornFX build version than what ships with Reforged, but baked files still load correctly.

## Links

- [PopcornFX Documentation (v2.5)](https://documentation.popcornfx.com/PopcornFX/v2.5/index.html)
- [PopcornFX Basics for Reforged (Hive Workshop)](https://www.hiveworkshop.com/threads/popcornfx-basics.353681/)