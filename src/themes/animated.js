/**
 * Dedicated ambient-motion themes. Their palettes stand on their own when the optional
 * stylesheet is absent; `motion` only enables a cosmetic root glow when it is available.
 */

export const ANIMATED = [
    {
        slug: 'aurora-drift',
        name: 'Aurora Drift',
        family: 'animated',
        motion: 'aurora-drift',
        mode: 'dark',
        surface: {
            headFrom: '#10162f', headTo: '#29214d',
            bodyFrom: '#0b1128', bodyTo: '#151d3d',
            row: 'rgba(125,227,238,0.07)', rowAlt: 'rgba(177,140,255,0.14)',
            inset: 'rgba(125,227,238,0.10)', chip: 'rgba(177,140,255,0.13)',
        },
        ink: {
            head: '#d9f8ff', body: '#e4e9f7', label: '#82e6d8', muted: '#9aa7c7',
            strong: '#ffffff', warm: '#f6b7df', cool: '#8be9ff',
        },
        line: { head: 'rgba(125,227,238,0.46)', body: 'rgba(177,140,255,0.25)', width: '1px', edge: '3px' },
        shadow: { head: '0 8px 24px rgba(6,10,34,0.46)', body: 'none' },
        accents: ['#7de3ee', '#b18cff', '#f2a6d2', '#86e5c2', '#8bbdff', '#f5d58a', '#cfb9ff'],
        radius: { head: '16px 8px 16px 8px', body: '8px 16px 8px 16px', row: '12px', slot: '10px' },
        type: {
            family: '"Trebuchet MS", "Gill Sans", ui-sans-serif, sans-serif',
            bodyFamily: 'system-ui, sans-serif', headSize: '12px', headTracking: '0.06em',
        },
        glyph: { section: '*', sectionAlt: 'o', bullet: '-', sep: '~', chevron: 'v' },
        extra: { header: 'text-shadow:0 0 10px rgba(139,233,255,0.28)' },
    },
    {
        slug: 'signal-pulse',
        name: 'Signal Pulse',
        family: 'animated',
        motion: 'signal-pulse',
        mode: 'dark',
        surface: {
            headFrom: '#0b1024', headTo: '#29114a',
            bodyFrom: '#060a18', bodyTo: '#0c1230',
            row: 'rgba(102,231,255,0.06)', rowAlt: 'rgba(255,104,199,0.15)',
            inset: 'rgba(102,231,255,0.10)', chip: 'rgba(255,104,199,0.13)',
        },
        ink: {
            head: '#9cf7ff', body: '#e1e8ff', label: '#ff83cb', muted: '#8591b4',
            strong: '#ffffff', warm: '#ffd166', cool: '#66e7ff',
        },
        line: { head: 'rgba(102,231,255,0.52)', body: 'rgba(255,104,199,0.26)', width: '1px', edge: '2px' },
        shadow: { head: '0 0 18px rgba(75,226,255,0.25), inset 0 0 24px rgba(255,61,175,0.08)', body: 'none' },
        accents: ['#66e7ff', '#ff68c7', '#ffd166', '#9b8cff', '#6ef2ba', '#ff9d6c', '#b9c8ff'],
        radius: { head: '4px', body: '4px', row: '3px', slot: '3px', pill: '4px', chip: '4px' },
        frame: 'brackets',
        scan: { color: 'rgba(102,231,255,0.045)', size: '4px' },
        type: {
            family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            bodyFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            headSize: '10px', headCase: 'uppercase', headTracking: '0.14em', labelCase: 'uppercase',
        },
        glyph: { section: '>', sectionAlt: '+', bullet: '-', sep: '//', chevron: 'v', chipSep: '::' },
    },
    {
        slug: 'moonlit-garden',
        name: 'Moonlit Garden',
        family: 'animated',
        motion: 'moonlit-garden',
        mode: 'dark',
        surface: {
            headFrom: '#13273c', headTo: '#20314d',
            bodyFrom: '#091b25', bodyTo: '#10283a',
            row: 'rgba(158,220,225,0.06)', rowAlt: 'rgba(194,183,239,0.14)',
            inset: 'rgba(240,215,154,0.09)', chip: 'rgba(158,220,225,0.11)',
        },
        ink: {
            head: '#e5ecff', body: '#dde8e7', label: '#c2b7ef', muted: '#9aa9ab',
            strong: '#ffffff', warm: '#f0d79a', cool: '#9edce1',
        },
        line: { head: 'rgba(194,183,239,0.42)', body: 'rgba(158,220,225,0.22)', width: '1px', edge: '3px' },
        shadow: { head: '0 8px 24px rgba(3,13,18,0.48)', body: 'none' },
        accents: ['#c2b7ef', '#9edce1', '#f0d79a', '#a9d6a1', '#e3a9c5', '#9bb8e8', '#d6ead1'],
        radius: { head: '18px', body: '18px', row: '14px', slot: '12px' },
        type: {
            family: '"Palatino Linotype", Palatino, Georgia, serif',
            bodyFamily: 'Georgia, serif', headSize: '13px', headTracking: '0.05em',
        },
        glyph: { section: '*', sectionAlt: '+', bullet: '-', sep: '~', chevron: 'v' },
        extra: { header: 'text-shadow:0 1px 8px rgba(194,183,239,0.32)' },
    },
];
