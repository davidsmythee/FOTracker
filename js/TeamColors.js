// Team Colors for D1 Lacrosse Teams
export const TEAM_COLORS = {
    // Ivy League
    'Princeton University': '#FF8F00',  // Orange
    'Yale University': '#00356B',       // Yale Blue
    'Harvard University': '#A51C30',    // Crimson
    'University of Pennsylvania': '#990000', // Penn Red
    'Cornell University': '#B31B1B',    // Cornell Red
    'Brown University': '#4E3629',      // Brown
    'Dartmouth College': '#00693E',     // Dartmouth Green
    'Columbia University': '#B9D9EB',   // Columbia Blue

    // ACC
    'Duke University': '#003087',       // Duke Blue
    'University of North Carolina': '#7BAFD4', // Carolina Blue
    'University of Virginia': '#E57200', // Virginia Orange
    'Syracuse University': '#F76900',   // Orange
    'University of Notre Dame': '#0C2340', // Navy

    // Big Ten
    'Johns Hopkins University': '#002D72', // Hopkins Blue
    'University of Maryland': '#E03A3E', // Maryland Red
    'Ohio State University': '#BB0000',  // Scarlet
    'University of Michigan': '#00274C', // Michigan Blue
    'Penn State University': '#041E42',  // Nittany Navy
    'Rutgers University': '#CC0033',     // Scarlet

    // Patriot League
    'United States Military Academy': '#000000', // Army Black
    'United States Naval Academy': '#003B5C', // Navy Blue
    'Boston University': '#CC0000',      // BU Red
    'Bucknell University': '#E87722',    // Orange
    'Colgate University': '#821019',     // Maroon
    'College of the Holy Cross': '#602D89', // Purple
    'Lafayette College': '#8B0015',      // Maroon
    'Lehigh University': '#653819',      // Brown
    'Loyola University Maryland': '#006747', // Green

    // ASUN
    'University of Richmond': '#002855',  // Richmond Blue
    'High Point University': '#330072',  // Purple
    'Bellarmine University': '#BE0F34',  // Scarlet
    'Cleveland State University': '#00594C', // Forest Green
    'Detroit Mercy': '#FFC82E',          // Titan Gold
    'Robert Morris University': '#005DAA', // RMU Blue

    // Other conferences
    'Villanova University': '#00205B',   // Navy Blue
    'Georgetown University': '#041E42',  // Georgetown Blue
    'University of Denver': '#8B2332',   // Crimson
    'University of Massachusetts': '#881C1C', // Maroon
    'Fairfield University': '#C8102E',   // Red
    'Hofstra University': '#00234F',     // Blue
    'Towson University': '#FFBF00',      // Gold
    'Drexel University': '#07294D',      // Navy Blue
    'University of Delaware': '#00539F', // Blue
    'Marquette University': '#003876',   // Blue
    'Providence College': '#000000',     // Black
    'University of Utah': '#CC0000',     // Utah Red
    'University of Detroit Mercy': '#FFC82E', // Gold
    'Merrimack College': '#003087',      // Blue
    'Sacred Heart University': '#C8102E', // Red
    'Quinnipiac University': '#002856',  // Navy
    'Marist College': '#C8102E',         // Red
    'Manhattan College': '#005430',      // Green
    'Monmouth University': '#003F87',    // Blue
    'Mount St. Mary\'s University': '#003DA5', // Blue
    'Siena College': '#046A38',          // Green
    'St. Bonaventure University': '#5E3926', // Brown
    'Canisius College': '#003DA5',       // Blue
    'Niagara University': '#4F2984',     // Purple
    'VMI': '#C8102E',                    // Red (Virginia Military Institute)
    'Virginia Military Institute': '#C8102E', // Red
    'University of Albany': '#461660',   // Purple
    'Binghamton University': '#005A43',  // Green
    'Stony Brook University': '#990000', // Red
    'University of Hartford': '#C8102E', // Red
    'University of Vermont': '#007155',  // Green
    'UMBC': '#000000',                   // Black (University of Maryland, Baltimore County)
    'University of New Hampshire': '#003B71', // Blue
    'Wagner College': '#00693E',         // Green
    'Bryant University': '#000000',      // Black
    'LIU': '#003087',                    // Blue (Long Island University)
    'St. Joseph\'s University': '#660018', // Crimson
    'Hobart College': '#5C0B7A',         // Purple
    'Air Force': '#003087',              // Blue
    'United States Air Force Academy': '#003087', // Blue

    // Default fallback
    'default': '#6B7280'                 // Gray
};

/**
 * Get the color for a team
 * @param {string} teamName - The team name
 * @returns {string} The team's hex color
 */
export function getTeamColor(teamName) {
    if (!teamName) return TEAM_COLORS['default'];

    // Try exact match first
    if (TEAM_COLORS[teamName]) {
        return TEAM_COLORS[teamName];
    }

    // Try partial match (case insensitive)
    const normalizedName = teamName.toLowerCase();
    for (const [key, color] of Object.entries(TEAM_COLORS)) {
        if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
            return color;
        }
    }

    // Return default if no match
    return TEAM_COLORS['default'];
}
