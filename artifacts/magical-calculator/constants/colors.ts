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

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 22,
};

export default colors;
