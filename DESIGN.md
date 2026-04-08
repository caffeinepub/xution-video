# Design Brief: Xution Video

## Overview
Professional brutalist video composition editor. Gold accents on deep black. Monospace throughout. Grid-based, high-contrast, intentional. Every UI element communicates its function.

## Tone
Industrial, technical, precise. Video editor language: collapsible panels, timeline aesthetic, active/recording hints via gold accents. No ornamentation — every pixel serves function.

## Color Palette

| Token                    | OKLCH         | Hex     | Use                              |
|--------------------------|---------------|---------|----------------------------------|
| Gold (primary/accent)    | 84 31 47      | #FFD700 | Borders, active states, critical actions |
| Black (background)       | 8 0 0         | #141414 | Deep surfaces, focus state        |
| Dark grey (card)         | 18 0 0        | #2A2A2A | Secondary surfaces, panels       |
| Muted grey               | 28 0 0        | #464646 | Tertiary backgrounds, disabled   |
| Light grey (border)      | 60 0 0        | #969696 | Input borders, dividers          |
| Desaturated gold         | 58 8 47       | #B8860B | Hover states, secondary accents  |

## Typography
- **Font**: JetBrains Mono (all text)
- **Display**: JetBrains Mono 18px, letter-spacing -0.5px (section headers)
- **Body**: JetBrains Mono 14px (UI controls, labels)
- **Mono**: JetBrains Mono 12px (timelines, technical data)

## Elevation & Depth
- **Borders**: 1–2px solid gold for active/critical zones; 1px solid muted grey for inactive
- **Cards/Panels**: `bg-card` with `border border-border`, no shadows
- **Active panels**: Gold top border accent (2px)
- **Hover**: `bg-secondary`, border remains gold if primary action

## Structural Zones

| Zone            | Surface         | Border                    | Typography |
|-----------------|-----------------|---------------------------|-----------|
| Header/Title    | bg-card         | border-b border-border    | text-mono text-accent |
| Sidebar panels  | bg-card         | border border-border      | text-mono text-foreground |
| Content canvas  | bg-background   | border-2 border-primary   | —         |
| Active panel    | bg-card         | border-l-4 border-primary | text-mono text-accent |
| Timeline/input  | bg-input        | border border-border      | text-mono text-foreground |

## Spacing & Rhythm
- **Gutter**: 16px (panels to viewport)
- **Panel gap**: 12px (between collapsible sections)
- **Internal padding**: 12px (card content)
- **Element gap**: 8px (controls within section)
- Border-radius: 2px max (sharp corners reinforce industrial aesthetic)

## Component Patterns
- **Buttons**: Monospace, gold text on black bg, gold border, hover: `bg-secondary`. No shadow.
- **Inputs**: Dark bg, muted border, gold focus ring, monospace
- **Toggle/Collapse**: Gold arrow icon, text label on same row
- **Sliders**: Gold track, black thumb, crisp corners
- **Select**: Monospace, gold accent on active option

## Motion
- Collapse/expand panels: 0.2s ease-out (accordion animation)
- Hover state: 0.15s smooth (border + bg change)
- Canvas preview updates: real-time (no animation)
- No decorative effects — movement serves function only

## Constraints
- Monospace font throughout (no serif, no sans-serif mixing)
- Minimum border: 1px solid gold on interactive elements
- No gradients, no blur, no rounded corners >2px
- Maximum shadow: none (depth via layering + borders)
- Accessibility: 7:1 contrast ratio on all text (gold on black verified)

## Signature Detail
Gold borders frame the canvas preview — the composition output is the star. All UI recedes behind the canvas area. Collapsible panels with gold left-edge accent when expanded echo professional video editing UIs (DaVinci, Premiere).
