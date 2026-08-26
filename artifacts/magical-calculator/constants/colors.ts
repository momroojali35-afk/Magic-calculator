/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#10192F',
    tint: '#3F7CFF',

    // Core surfaces
    background: '#FFFFFF',
    foreground: '#10192F',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#10192F',
    numberButton: '#F6F7F9',

    // Primary action color (buttons, links, active states)
    primary: '#3F7CFF',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EEF2F9',
    secondaryForeground: '#273456',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E8EDF7',
    mutedForeground: '#7D89A5',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#E7EEFF',
    accentForeground: '#2D5CC8',

    // Destructive actions (delete, error states)
    destructive: '#E35D6A',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DDE4F1',
    input: '#DDE4F1',
  },

  dark: {
    // Legacy aliases
    text: '#F4F6FA',
    tint: '#9BB2FF',

    // Core surfaces
    background: '#11141B',
    foreground: '#F4F6FA',

    // Cards / elevated surfaces
    card: '#1B202B',
    cardForeground: '#F4F6FA',
    numberButton: '#252B38',

    // Primary action color (buttons, links, active states)
    primary: '#9BB2FF',
    primaryForeground: '#111827',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#2A3140',
    secondaryForeground: '#DCE3F5',

    // Muted / subdued elements
    muted: '#333B4C',
    mutedForeground: '#A7B1C6',

    // Accent highlights
    accent: '#2E3C68',
    accentForeground: '#C8D5FF',

    // Destructive actions
    destructive: '#FF8C99',
    destructiveForeground: '#241218',

    // Borders and input outlines
    border: '#3B4558',
    input: '#3B4558',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 22,
};

export default colors;
