# Baby Bouncing Ball Game

A simple, responsive HTML5 game built with Phaser.js where you can bounce a ball around the screen and interact with clouds and a sun. Perfect for babies and toddlers!

**Play it here**: 🎮 [https://woutervanwijk.github.io/babybouncingballgame/](https://woutervanwijk.github.io/babybouncingballgame/)

## Features

- **Simple Controls**: Click/tap anywhere to throw the ball
- **Responsive Design**: Adapts to different screen sizes
- **Adaptive Scaling**: Objects scale based on screen size:
  - Large screens (≥1200px): 150% size, 6 clouds
  - Medium screens (≥800px): 100% size, 4 clouds  
  - Small screens (<800px): 50% size, 3 clouds
- **Physics-Based**: Realistic bouncing and collisions
- **Mobile-Friendly**: Works on touch devices
- **Fullscreen**: Takes up the entire browser window

## How to Play

1. Open `babygame-phaser-fast-soft.html` in any modern browser
2. Click or tap anywhere on the screen to throw the ball
3. Watch the ball bounce off clouds, the sun, and the edges
4. Enjoy the colorful, simple visuals perfect for young children

## Screen Size Modes

The game automatically detects your screen size and adjusts:

| Screen Size | Mode | Object Size | Cloud Count | Speed |
|-------------|------|-------------|-------------|-------|
| ≥1200px | Large | 150% | 6 | 150% |
| ≥800px | Medium | 100% | 4 | 100% |
| <800px | Small | 50% | 3 | 50% |

## Technical Details

- **Framework**: Phaser 3 (Arcade Physics)
- **Language**: JavaScript (ES6)
- **No Dependencies**: Self-contained HTML file
- **Responsive**: Adapts to window resizing
- **Performance**: Optimized for smooth animation

## Development

### File Structure

- `babygame-phaser-fast-soft.html` - Main game file
- `phaser/` - Phaser.js library files
- `README.md` - This documentation

### Key Code Components

1. **Screen Detection**:
   ```javascript
   this.screenMode = this.gameWidth >= 1200 ? "largeScreen" : 
                     (this.gameWidth >= 800 ? "mediumScreen" : "smallScreen");
   ```

2. **Adaptive Scaling**:
   ```javascript
   this.sizeMultiplier = this.screenMode === "largeScreen" ? 1.5 : 
                        (this.screenMode === "mediumScreen" ? 1.0 : 0.5);
   object.setScale(this.sizeMultiplier);
   ```

3. **Dynamic Cloud Count**:
   ```javascript
   const cloudCount = this.screenMode === "largeScreen" ? 6 : 
                     (this.screenMode === "mediumScreen" ? 4 : 3);
   ```

## Customization

You can easily customize the game by modifying:

- **Colors**: Change the hex codes in the texture creation methods
- **Speeds**: Adjust the speed multipliers and gravity values
- **Object Sizes**: Modify the size multipliers
- **Bounce Physics**: Change the bounce values (0.6 for ball, 1.0 for clouds)

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (Chromium) ✅
- Firefox ✅
- Safari ✅
- Mobile browsers ✅

## License

This is a simple educational game. Feel free to use, modify, and share it!

## Credits

- Built with [Phaser 3](https://phaser.io/)
- Simple physics for baby-friendly interaction
- Responsive design for all devices

Perfect for keeping little ones entertained while being gentle on the eyes!