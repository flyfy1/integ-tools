// One decorative line-icon vocabulary for React and the initial static catalog.
export const iconPaths = {
 developer: ["m8 6-6 6 6 6", "m16 6 6 6-6 6", "m14 4-4 16"],
 finance: ["M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z", "M8 6h8v4H8Z", "M8 14h1m6 0h1m-8 4h1m6 0h1"],
 ai: ["m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z", "M20 2v4m-2-2h4"],
 local: ["M4 3h16v13H4Z", "M2 20h20", "m9 9 2 2 4-4"],
 account: ["M4 4h11v16H4Z", "M9 12h13m-3-3 3 3-3 3"],
 tracking: ["M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z", "m8 12 3 3 5-6"],
 arrow: ["M4 12h16m-6-6 6 6-6 6"],
} as const;
export type IconName = keyof typeof iconPaths;
export function iconMarkup(name: IconName) {
 return `<svg class="line-icon" data-icon="${name}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name].map(d=>`<path d="${d}"/>`).join("")}</svg>`;
}
