// Chart colours, checked with the data-visualisation validator: a lighter step of brand royal and brand sky.
// Sky is low-contrast on white, so every chart that uses it also has a legend, a tooltip and a table view.
// Kept outside the chart component so server pages (the legend) and the browser (the bars) share one source.
export const chartColours = { connected: '#3D4FB8', other: '#57C1E8' }
