// Chart colours, checked with the data-visualisation validator: on white, a lighter step of brand royal and brand sky;
// on the dark surface (#111F2E), a lighter royal and a deeper sky. Sky is low-contrast on white, so every chart that uses it
// also has a legend, a tooltip and a table view. The values live in style.css as --chart-connected and --chart-other, so
// a chart follows the theme without the server knowing it; chartPalette records them for the tests.
export const chartPalette = { light: { connected: '#3D4FB8', other: '#57C1E8' }, dark: { connected: '#6676E0', other: '#2BA3B8' } }
export const chartColours = { connected: 'var(--chart-connected)', other: 'var(--chart-other)' }
