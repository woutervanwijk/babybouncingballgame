// Game Configuration and Initialization
// Check if Phaser is loaded
if (typeof Phaser === 'undefined') {
    document.body.innerHTML = '<h1>Error: Phaser not loaded</h1>' +
        '<p>Please make sure phaser.min.js is in the phaser directory.</p>';
} else {
    // Game configuration
    const getGameSize = () => {
        const container = document.getElementById('game-container');
        if (container) {
            return {
                width: container.clientWidth,
                height: container.clientHeight
            };
        }
        return { width: window.innerWidth, height: window.innerHeight };
    };

    const gameSize = getGameSize();

    const config = {
        type: Phaser.AUTO,
        width: gameSize.width,
        height: gameSize.height,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 300 },
                debug: false,
                fps: 120,
                fixedStep: true
            }
        },
        scene: [BabyBallGame],
        render: {
            pixelArt: false,
            antialias: true,
            roundPixels: false
        },
        backgroundColor: '#87CEEB',
        transparent: false,
        resolution: window.devicePixelRatio || 1,
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container',
            expandParent: true
        }
    };

    const game = new Phaser.Game(config);

    // Handle window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            const newSize = getGameSize();
            if (game.scale) {
                game.scale.resize(newSize.width, newSize.height);
            }
            if (game.scene.scenes.length > 0) {
                const scene = game.scene.scenes[0];
                if (scene.gameWidth !== undefined && scene.gameHeight !== undefined) {
                    const oldWidth = scene.gameWidth;
                    const oldHeight = scene.gameHeight;
                    scene.gameWidth = newSize.width;
                    scene.gameHeight = newSize.height;
                    if (scene.physics && scene.physics.world) {
                        scene.physics.world.setBounds(0, 0, newSize.width, newSize.height);
                    }
                    if (scene.handleResizeCollisions) {
                        scene.handleResizeCollisions(oldWidth, oldHeight, newSize.width, newSize.height);
                    }
                }
            }
        }, 100);
    });

    // Add reset button event listener
    document.getElementById('reset-button').addEventListener('click', (event) => {
        event.preventDefault();
        if (game.scene.scenes.length > 0) {
            const scene = game.scene.scenes[0];
            if (scene.resetGame) {
                scene.resetGame();
            }
        }
        document.getElementById('reset-button').blur();
    });

    // Add mute button event listener
    document.getElementById('mute-button').addEventListener('click', (event) => {
        event.preventDefault();
        if (game.scene.scenes.length > 0) {
            const scene = game.scene.scenes[0];
            if (scene.toggleMute) {
                scene.toggleMute();
            }
        }
        document.getElementById('mute-button').blur();
    });
}
