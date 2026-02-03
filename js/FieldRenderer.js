// ===== Field Renderer =====
export default class FieldRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pins = [];
        this.setupCanvas();
    }

    setupCanvas() {
        // Lacrosse field: 110 yards tall × 80 yards wide
        const FIELD_WIDTH_YARDS = 80;
        const FIELD_HEIGHT_YARDS = 110;
        const ASPECT_RATIO = FIELD_HEIGHT_YARDS / FIELD_WIDTH_YARDS;

        const containerWidth = this.canvas.parentElement.clientWidth;
        // Ensure we have a valid width, default to 640 if container isn't ready
        const maxWidth = containerWidth > 100 ? Math.min(containerWidth, 1000) : 640;

        this.canvas.width = maxWidth;
        this.canvas.height = maxWidth * ASPECT_RATIO;

        // Store actual dimensions for calculations
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Store yard-to-pixel conversion factor
        this.yardsToPixels = (this.width - 20) / FIELD_WIDTH_YARDS; // Accounting for margins
    }

    drawField(teamAName = null, teamAColor = null) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // Safety check - don't draw if canvas isn't properly sized
        if (!w || !h || w < 100 || h < 100) {
            return;
        }

        // --- basics
        ctx.clearRect(0, 0, w, h);

        // Draw white field background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        ctx.save();

        // proportions (tweak if you want tighter/looser spacing)
        const borderW = Math.max(6, Math.round(Math.min(w, h) * 0.012));   // outer border thickness
        const pad      = Math.max(6, Math.round(Math.min(w, h) * 0.02));   // outer padding used for interior shapes
        const restrain = Math.round(h * 0.27);                              // distance of restraining lines from each end
        const wingHalf = Math.round(h * 0.10);                              // half-height of wing lines
        const wingDx   = Math.round(w * 0.32);                              // horizontal offset of wing lines from center
        const boxSideInset = Math.round(w * 0.16);                          // left/right inset for top/bottom boxes
        const creaseR  = Math.max(6, Math.round(Math.min(w, h) * 0.035));   // goal crease radius
        const minusLen = Math.round(creaseR * 0.9);                         // length of the "–" inside crease

        // common styles - BLACK LINES
        ctx.strokeStyle = "#000000";
        ctx.fillStyle   = "#000000";
        ctx.lineCap     = "butt";
        ctx.lineJoin    = "miter";
        ctx.lineWidth   = borderW;

        const centerX = w / 2;
        const topY    = borderW / 2;
        const botY    = h - borderW / 2;

        // --- outer border
        ctx.strokeRect(borderW / 2, borderW / 2, w - borderW, h - borderW);

        // --- restraining lines (full width)
        const topRestrainingY    = topY + restrain;
        const bottomRestrainingY = botY - restrain;

        ctx.beginPath();
        ctx.moveTo(borderW / 2, topRestrainingY);
        ctx.lineTo(w - borderW / 2, topRestrainingY);
        ctx.moveTo(borderW / 2, bottomRestrainingY);
        ctx.lineTo(w - borderW / 2, bottomRestrainingY);
        ctx.stroke();

        // --- midfield line
        const midY = h / 2;
        ctx.beginPath();
        ctx.moveTo(borderW / 2, midY);
        ctx.lineTo(w - borderW / 2, midY);
        ctx.stroke();

        // --- center "X"
        const xSize = Math.round(Math.min(w, h) * 0.025);
        ctx.beginPath();
        ctx.moveTo(centerX - xSize, midY - xSize);
        ctx.lineTo(centerX + xSize, midY + xSize);
        ctx.moveTo(centerX + xSize, midY - xSize);
        ctx.lineTo(centerX - xSize, midY + xSize);
        ctx.lineWidth = Math.max(2, Math.round(borderW * 0.5));
        ctx.stroke();

        // --- wing lines (short verticals centered on the midfield line)
        ctx.beginPath();
        // left
        ctx.moveTo(centerX - wingDx, midY - wingHalf);
        ctx.lineTo(centerX - wingDx, midY + wingHalf);
        // right
        ctx.moveTo(centerX + wingDx, midY - wingHalf);
        ctx.lineTo(centerX + wingDx, midY + wingHalf);
        ctx.lineWidth = borderW; // match image thickness
        ctx.stroke();

        // --- top & bottom large boxes (span between end line and restraining line
        //     with left/right insets)
        ctx.lineWidth = borderW;
        // top box
        ctx.strokeRect(
          boxSideInset,
          topY + borderW / 2,
          w - 2 * boxSideInset,
          topRestrainingY - (topY + borderW / 2)
        );
        // bottom box
        ctx.strokeRect(
          boxSideInset,
          bottomRestrainingY,
          w - 2 * boxSideInset,
          (botY - borderW / 2) - bottomRestrainingY
        );

        // --- goal creases with "–" inside (top & bottom centers)
        ctx.lineWidth = borderW;
        // top crease
        const topCreaseY = Math.round(topY + restrain * 0.45);
        ctx.beginPath();
        ctx.arc(centerX, topCreaseY, creaseR, 0, Math.PI * 2);
        ctx.stroke();
        // minus sign
        ctx.beginPath();
        ctx.moveTo(centerX - minusLen / 2, topCreaseY);
        ctx.lineTo(centerX + minusLen / 2, topCreaseY);
        ctx.stroke();

        // bottom crease
        const botCreaseY = Math.round(botY - restrain * 0.45);
        ctx.beginPath();
        ctx.arc(centerX, botCreaseY, creaseR, 0, Math.PI * 2);
        ctx.stroke();
        // minus sign
        ctx.beginPath();
        ctx.moveTo(centerX - minusLen / 2, botCreaseY);
        ctx.lineTo(centerX + minusLen / 2, botCreaseY);
        ctx.stroke();

        // --- Team direction indicator (Team A going up)
        if (teamAName && teamAColor) {
            // Position: near right sideline at midline
            const indicatorX = w - borderW - pad - 40;
            const indicatorY = midY + 50;

            // Get first letter of team name
            const teamLetter = teamAName.charAt(0).toUpperCase();

            // Draw team letter
            ctx.fillStyle = teamAColor;
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(teamLetter, indicatorX, indicatorY);

            // Draw upward arrow below the letter
            const arrowY = indicatorY + 25;
            const arrowSize = 12;
            ctx.fillStyle = teamAColor;
            ctx.beginPath();
            // Arrow pointing up
            ctx.moveTo(indicatorX, arrowY - arrowSize); // Top point
            ctx.lineTo(indicatorX - arrowSize / 2, arrowY); // Bottom left
            ctx.lineTo(indicatorX + arrowSize / 2, arrowY); // Bottom right
            ctx.closePath();
            ctx.fill();

            // Arrow shaft
            ctx.fillRect(indicatorX - 3, arrowY, 6, arrowSize);
        }

        ctx.restore();
      }


    drawPins(pins, showClampRings = true) {
        this.pins = pins;

        // Filter out whistle violation pins - they should not appear on the field/heat map
        // Post-whistle violations should still appear since faceoff occurred
        const visiblePins = pins.filter(pin => !pin.isWhistleViolation);

        visiblePins.forEach((pin, index) => {
            // Use team colors if provided, otherwise fall back to old format
            const faceoffColor = pin.faceoffColor || (pin.faceoffResult === 'win' ? '#10b981' : '#ef4444');
            const clampColor = pin.clampColor || (pin.clampResult === 'win' ? '#10b981' : '#ef4444');
            this.drawPin(pin.x, pin.y, faceoffColor, clampColor, showClampRings, index === visiblePins.length - 1);
        });
    }

    drawPin(x, y, faceoffColor, clampColor, showClampRings = true, isLatest = false) {
        const ctx = this.ctx;
        const innerRadius = 5; // Inner circle size
        const outerRadius = 8; // Outer ring size

        // Pin shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Draw outer ring (clamp result) - only if showClampRings is true
        if (showClampRings) {
            ctx.fillStyle = clampColor;
            ctx.beginPath();
            ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Reset shadow for inner circle
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw inner circle (face-off result)
        ctx.fillStyle = faceoffColor;
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        // White border around inner circle for definition
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Highlight latest pin
        if (isLatest) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const highlightRadius = showClampRings ? outerRadius + 3 : innerRadius + 3;
            ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    render(pins, showClampRings = true, teamAName = null, teamAColor = null) {
        this.drawField(teamAName, teamAColor);
        this.drawPins(pins, showClampRings);
    }

    renderHeatmap(pins, teamAColor = '#10b981', teamBColor = '#ef4444', teamAName = 'Team A', teamBName = 'Team B') {
        this.drawField(teamAName, teamAColor);

        // Filter out whistle violation pins - they should not appear on the field/heat map
        // Post-whistle violations should still appear since faceoff occurred
        const visiblePins = pins.filter(pin => !pin.isWhistleViolation);

        if (visiblePins.length === 0) return;

        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // Create heat map grid
        const gridSize = 15; // Size of each heat map cell (smaller = more detail)
        const cols = Math.ceil(w / gridSize);
        const rows = Math.ceil(h / gridSize);
        const teamAGrid = Array(rows).fill().map(() => Array(cols).fill(0));
        const teamBGrid = Array(rows).fill().map(() => Array(cols).fill(0));

        // Count pins in each grid cell
        visiblePins.forEach(pin => {
            const col = Math.floor(pin.x / gridSize);
            const row = Math.floor(pin.y / gridSize);

            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                // Handle both old and new pin data structures
                const faceoffResult = pin.faceoffResult || pin.type || 'win';
                if (faceoffResult === 'win') {
                    teamAGrid[row][col]++;
                } else {
                    teamBGrid[row][col]++;
                }
            }
        });

        // Find max values for normalization
        let maxTeamA = 0;
        let maxTeamB = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                maxTeamA = Math.max(maxTeamA, teamAGrid[r][c]);
                maxTeamB = Math.max(maxTeamB, teamBGrid[r][c]);
            }
        }

        // Helper function to convert hex to rgba
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Draw heat map
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * gridSize;
                const y = r * gridSize;
                const teamACount = teamAGrid[r][c];
                const teamBCount = teamBGrid[r][c];

                if (teamACount > 0 || teamBCount > 0) {
                    let color, alpha;

                    if (teamACount > teamBCount) {
                        // More Team A wins - use Team A color
                        alpha = Math.min(0.7, (teamACount / maxTeamA) * 0.7);
                        color = hexToRgba(teamAColor, alpha);
                    } else if (teamBCount > teamACount) {
                        // More Team B wins - use Team B color
                        alpha = Math.min(0.7, (teamBCount / maxTeamB) * 0.7);
                        color = hexToRgba(teamBColor, alpha);
                    } else {
                        // Equal - blend both colors
                        alpha = 0.5;
                        color = `rgba(245, 158, 11, ${alpha})`; // Yellow for tie
                    }

                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, gridSize, gridSize);

                    // Draw count in cell if significant
                    const total = teamACount + teamBCount;
                    if (total >= 3) {
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(total, x + gridSize / 2, y + gridSize / 2);
                    }
                }
            }
        }

        // Draw legend on the field
        this.drawHeatmapLegend(teamAColor, teamBColor, teamAName, teamBName);
    }

    drawHeatmapLegend(teamAColor = '#10b981', teamBColor = '#ef4444', teamAName = 'Team A', teamBName = 'Team B') {
        const ctx = this.ctx;
        const legendX = 20;
        const legendY = this.height - 80;

        // Helper function to convert hex to rgba
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Calculate legend width based on team name lengths
        const maxNameLength = Math.max(teamAName.length, teamBName.length);
        const legendWidth = Math.max(200, maxNameLength * 6 + 40);

        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(legendX, legendY, legendWidth, 60);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(legendX, legendY, legendWidth, 60);

        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Heat Map Legend:', legendX + 10, legendY + 15);

        // Color samples
        const sampleY = legendY + 35;
        const sampleSize = 15;

        // Team A
        ctx.fillStyle = hexToRgba(teamAColor, 0.7);
        ctx.fillRect(legendX + 10, sampleY, sampleSize, sampleSize);
        ctx.fillStyle = 'white';
        ctx.font = '11px sans-serif';
        ctx.fillText(teamAName, legendX + 30, sampleY + 11);

        // Team B
        const teamBX = legendX + legendWidth / 2 + 10;
        ctx.fillStyle = hexToRgba(teamBColor, 0.7);
        ctx.fillRect(teamBX, sampleY, sampleSize, sampleSize);
        ctx.fillStyle = 'white';
        ctx.fillText(teamBName, teamBX + 20, sampleY + 11);
    }

    getClickCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }
}
