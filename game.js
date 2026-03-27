// Check if Phaser is loaded
if (typeof Phaser === 'undefined') {
    document.body.innerHTML = '<h1>Error: Phaser not loaded</h1>' +
        '<p>Please make sure phaser.min.js is in the phaser directory.</p>';
} else {
    class BabyBallGame extends Phaser.Scene {
        constructor() {
            super({ key: 'BabyBallGame' });
            this.gameWidth = 800;
            this.gameHeight = 600;
            this.grassHeight = 0; // Will be set in create() method
            this.totalPoints = 0;
            this.sessionPoints = 0;
            // Object-specific bounce counters
            this.ballBounces = 0;
            this.sunBounces = 0;
            this.cloudBounces = 0;
            // Current streak counters (reset on throw)
            this.ballStreak = 0;
            this.sunStreak = 0;
            this.cloudStreak = 0;
            this.isAiming = false;
            this.directionIndicator = null;
            this.aimAngle = 0;
            this.keyDownTime = 0;
            this.rotationSpeed = 0.05; // Radians per frame (slower for smoother rotation)
            this.rotationDirection = 1; // 1 for clockwise, -1 for counter-clockwise
            this.arrowShowTimeout = null; // Timeout for showing arrow
            this.isDragging = false; // Track if an object is being dragged
            this.lastDragEndTime = 0; // Timestamp of last drag end
            this.counterUpdatesEnabled = true; // Allow counter updates by default

            // Debug configuration
            this.debugEnabled = false; // Master debug switch
            this.debugHitAreas = false; // Show hit test areas
            this.debugObjectSizes = false; // Show object bounding boxes
            this.debugPhysics = false; // Show physics bodies
            this.debugGrassArea = false; // Show grass boundary

            // Sound priority system removed (sounds play immediately)
        }

        preload() {
            // Load SVG assets from the svg directory
            // Load SVG assets with higher resolution for Retina displays
            // We load them at 2x the display size to ensure they're sharp
            this.load.svg('cloud', 'svg/cloud.svg', { width: 250, height: 250 });
            this.load.svg('sun', 'svg/sun.svg', { width: 240, height: 240 });
            this.load.svg('ball', 'svg/ball.svg', { width: 200, height: 200 });

            // Load sound effects
            this.load.audio('throw', 'assets/audio/throw.mp3');
            this.load.audio('ballSound', 'assets/audio/ball.mp3');
            this.load.audio('sunSound', 'assets/audio/sun.mp3');
            this.load.audio('cloudSound', 'assets/audio/cloud.mp3');
        }


        create() {
            // Initialize sound effects as null - they will be created after first user interaction
            this.throwSound = null;
            this.ballSound = null;
            this.sunSound = null;
            this.cloudSound = null;

            // Flag to track if audio context has been unlocked by user interaction
            this.audioContextUnlocked = false;

            // Initialize sounds after first user interaction
            // Initialize sounds immediately (but they are muted by Phaser's default state)
            // They will be resumed/unlocked on first interaction.
            this.throwSound = this.sound.add('throw', { volume: 0.25 });
            this.ballSound = this.sound.add('ballSound', { volume: 0.2 });
            this.sunSound = this.sound.add('sunSound', { volume: 0.25 });
            this.cloudSound = this.sound.add('cloudSound', { volume: 0.25 });

            // Initialize sounds after first user interaction
            const initializeSounds = () => {
                if (this.audioContextUnlocked) return;
                this.audioContextUnlocked = true;

                // Derive the target mute state from the UI button's current appearance.
                const muteButton = document.getElementById('mute-button');
                const isUIAlreadyUnmuted = muteButton ? !muteButton.classList.contains('muted') : !this.initialMuteState;
                this.sound.mute = !isUIAlreadyUnmuted;

                // For Safari Specific: Use a native HTMLAudioElement to force unlock
                if (this.isSafari()) {
                    try {
                        const unlockSound = new Audio();
                        unlockSound.src = 'assets/audio/throw.mp3';
                        unlockSound.volume = 0.01; // Tiny volume might help Safari acknowledge play
                        unlockSound.play().then(() => {
                            setTimeout(() => unlockSound.pause(), 10);
                        }).catch(() => {});
                    } catch (e) {}
                }

                // Call Pharaoh's internal unlock if available
                if (this.sound && typeof this.sound.unlock === 'function') {
                    this.sound.unlock();
                }
            }



                // Critical: Force button state to match the saved mute state
                // Use a longer timeout to ensure this happens after all initialization
                setTimeout(() => {
                    const muteButton = document.getElementById('mute-button');
                    if (muteButton) {
                        // Always use the initialMuteState for the button during initialization
                        // This prevents any temporary state changes from affecting the UI
                        if (this.initialMuteState) {
                            muteButton.classList.add('muted');
                        } else {
                            muteButton.classList.remove('muted');
                        }

                        // Double-check after a brief delay
                        setTimeout(() => {
                            if (muteButton.classList.contains('muted') !== this.initialMuteState) {
                                console.log('Fixing button state mismatch');
                                if (this.initialMuteState) {
                                    muteButton.classList.add('muted');
                                } else {
                                    muteButton.classList.remove('muted');
                                }
                            }
                        }, 50);
                    }
                }, 100); // Increased timeout to ensure it runs after everything else


            const handleFirstInteraction = () => {
                // Ensure context is resumed synchronously
                if (this.sound.context && typeof this.sound.context.resume === 'function') {
                    this.sound.context.resume();
                }
                
                // Call initialize sounds synchronously! 
                initializeSounds();
                
                console.log('Interaction detected: Audio system resumed synchronously');

                window.removeEventListener('pointerdown', handleFirstInteraction);
                window.removeEventListener('touchstart', handleFirstInteraction);
                window.removeEventListener('click', handleFirstInteraction);
                window.removeEventListener('keydown', handleFirstInteraction);
            };

            window.addEventListener('pointerdown', handleFirstInteraction);
            window.addEventListener('touchstart', handleFirstInteraction);
            window.addEventListener('click', handleFirstInteraction);
            window.addEventListener('keydown', handleFirstInteraction);

            // Safari sometimes pauses audio on blur (even briefly during UI transitions)
            this.sound.pauseOnBlur = false;

            // Load saved mute state or default to unmuted (false)
            // We'll store this and apply it when sounds are initialized
            this.initialMuteState = false;
            try {
                const storedValue = localStorage.getItem('babyBallGameMuted');
                // Only use stored value if it's explicitly 'true' or 'false'
                if (storedValue === 'true' || storedValue === 'false') {
                    this.initialMuteState = (storedValue === 'true');
                }
                // Don't set this.sound.mute here - wait until sounds are initialized
            } catch (e) {
                // Handle Safari private mode or quota exceeded errors
                console.warn('LocalStorage access failed, defaulting to unmuted');
                this.initialMuteState = false;
            }

            // Sync the button icon state with the loaded mute state
            // Use setTimeout to ensure DOM is ready and button exists
            setTimeout(() => {
                const muteButton = document.getElementById('mute-button');
                if (muteButton) {

                    // Explicitly set the icon state based on the loaded setting
                    if (this.initialMuteState) {
                        muteButton.classList.add('muted');
                    } else {
                        muteButton.classList.remove('muted');
                    }
                }
            }, 50);



            // Set up physics - only ball has gravity
            this.physics.world.gravity.y = 300;

            // Store game dimensions
            this.gameWidth = this.game.config.width;
            this.gameHeight = this.game.config.height;

            // Create grass boundary (adaptive height based on screen size)
            // Extra height for safe area and rotation overdraw
            this.grassHeight = Math.min(this.gameHeight * 0.2, 150);
            const grassWidth = this.gameWidth + 2000; // Plenty of overdraw
            this.grass = this.add.rectangle(-1000, this.gameHeight - this.grassHeight / 2 + 250,
                grassWidth, this.grassHeight + 500, 0x7CFC00) // 500px extra depth for safe areas
                .setOrigin(0, 0.5)
                .setDepth(0);

            // Create sky background (fill remaining space with plenty of overdraw for rotation)
            const overdraw = 1000;
            this.sky = this.add.rectangle(-overdraw, -overdraw, this.gameWidth + overdraw * 2, this.gameHeight + overdraw * 2, 0x87CEEB)
                .setOrigin(0, 0)
                .setDepth(-10);

            // Create ball (only object with gravity) - position above grass
            this.ball = this.physics.add.sprite(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50, 'ball');
            this.ball.setDisplaySize(72, 72);
            this.ball.setBounce(0.6);
            this.ball.setCollideWorldBounds(true);
            this.ball.body.onWorldBounds = true;
            this.ball.setAngularDrag(150); // Natural rotation damping
            this.ball.setDepth(50); // Bring ball to front
            this.ball.body.setCircle(this.ball.width / 2);
            this.ball.body.onWorldBounds = true; // Enable world bounds events

            // Play bounce sound when objects hit world bounds
            this.physics.world.on('worldbounds', (body) => {
                if (body && body.gameObject) {
                    // Lower threshold for clouds/sun which tend to move slower than the ball
                    const threshold = (body.gameObject === this.ball) ? 30 : 5;
                    if (Math.abs(body.velocity.x) > threshold || Math.abs(body.velocity.y) > threshold) {
                        if (body.gameObject === this.ball) {
                            const ballSound = this.getSound('ballSound');
                            if (ballSound && this.canPlayAudio()) ballSound.play();
                        } else if (this.clouds && this.clouds.includes(body.gameObject)) {
                            const cloudSound = this.getSound('cloudSound');
                            if (cloudSound && this.canPlayAudio()) cloudSound.play();
                        } else if (body.gameObject === this.sun) {
                            const sunSound = this.getSound('sunSound');
                            if (sunSound && this.canPlayAudio()) sunSound.play();
                        }
                    }
                }
            });
            // Create sun (NO GRAVITY - only moves when hit)
            const playAreaHeight = this.gameHeight - this.grassHeight;
            const sunPosition = this.getRandomSunPosition();
            this.sun = this.physics.add.sprite(sunPosition.x, sunPosition.y, 'sun');
            this.sun.setDisplaySize(120, 120);
            this.sun.setFlipX(Math.random() < 0.5);
            this.sun.setAngle(Phaser.Math.Between(-5, 5));
            this.sun.setBounce(1.0);
            this.sun.setCollideWorldBounds(true);
            this.sun.setImmovable(true);
            this.sun.setVelocity(0, 0);

            // Set sun hitbox to 25% of width (half of previous size)
            const sunRadius = this.sun.width * 0.25; 
            this.sun.body.setCircle(sunRadius, this.sun.width * 0.25, this.sun.width * 0.25); // Centered hitbox
            this.sun.body.allowGravity = false;
            this.sun.body.onWorldBounds = true; // Enable world bounds events for sun
            this.sun.setDepth(10); // Sun stays in back

            // Prevent counter updates during initialization period
            this.counterUpdatesEnabled = false;

            // Re-enable counters after 500ms to avoid counting initial object bounces
            setTimeout(() => {
                this.totalPoints = 0;
                this.sessionPoints = 0;
                this.ballBounces = 0;
                this.sunBounces = 0;
                this.cloudBounces = 0;
                this.ballStreak = 0;
                this.sunStreak = 0;
                this.cloudStreak = 0;
                this.counterUpdatesEnabled = true;
                this.updateCounters();
            }, 1000);

            // Determine screen mode based on width
            if (this.gameWidth >= 1200 || this.gameHeight >= 1200) {
                this.screenMode = "xxlargeScreen";
            } else if (this.gameWidth >= 1024 || this.gameHeight >= 1024) {
                this.screenMode = "xlargeScreen";
            } else if (this.gameWidth >= 750 || this.gameHeight >= 750) {
                this.screenMode = "largeScreen";
            } else if (this.gameWidth >= 600 || this.gameHeight >= 600) {
                this.screenMode = "mediumScreen";
            } else {
                this.screenMode = "smallScreen";
            }

            // Create clouds (NO GRAVITY - only move when hit)
            const cloudTextures = ["cloud"];
            const cloudCount = this.screenMode === "xxlargeScreen" ? 12 : this.screenMode === "xlargeScreen" ? 9 : this.screenMode === "largeScreen" ? 7 : this.screenMode === "mediumScreen" ? 5 : 3;
            this.clouds = [];
            for (let i = 0; i < cloudCount; i++) {
                const texture = cloudTextures[i % cloudTextures.length];
                let cloudX, cloudY, overlaps;
                let attempts = 0;
                do {
                    cloudX = Phaser.Math.Between(150, this.gameWidth - 150);
                    cloudY = Phaser.Math.Between(100, playAreaHeight * 0.7);
                    overlaps = false;
                    // Check against other clouds
                    for (const existingCloud of this.clouds) {
                        const dist = Phaser.Math.Distance.Between(cloudX, cloudY, existingCloud.x, existingCloud.y);
                        if (dist < 250) { // Width is 225, so 250 gives a small gap
                            overlaps = true;
                            break;
                        }
                    }
                    // Check against sun
                    if (this.sun) {
                        const distToSun = Phaser.Math.Distance.Between(cloudX, cloudY, this.sun.x, this.sun.y);
                        if (distToSun < 200) {
                            overlaps = true;
                        }
                    }
                    attempts++;
                } while (overlaps && attempts < 100);

                const cloud = this.physics.add.sprite(cloudX, cloudY, texture);
                // Vary cloud size by ±30% (100.8 to 187.2, rounded to integers)
                const baseSize = 124;
                const sizeVariation = Phaser.Math.Between(-30, 30); // -30% to +30%
                const cloudSize = baseSize + Math.round(baseSize * sizeVariation / 100);
                cloud.setDisplaySize(cloudSize, cloudSize);
                cloud.setBounce(1.0);
                cloud.setCollideWorldBounds(true);
                cloud.setImmovable(true);
                cloud.body.allowGravity = false;
                cloud.body.onWorldBounds = true; // Enable world bounds events for clouds
                const cloudRadius = cloud.width * 0.25; // 25% of width as radius
                cloud.body.setCircle(cloudRadius, cloud.width * 0.25, cloud.width * 0.25); // Centered hitbox
                cloud.setFlipX(Math.random() < 0.5);
                cloud.setAngle(Phaser.Math.Between(-5, 5));
                cloud.setDepth(20); // Clouds stay in front of sun
                this.clouds.push(cloud);
            }

            // Set up collisions
            this.physics.add.collider(this.ball, this.clouds, this.handleBallCloudCollision, null, this);
            this.physics.add.collider(this.ball, this.sun, this.handleBallSunCollision, null, this);
            this.physics.add.collider(this.clouds, this.clouds, this.handleCloudCloudCollision, null, this);
            // Removed cloud-sun collision: this.physics.add.collider(this.clouds, this.sun, this.handleCloudSunCollision, null, this);

            // Set up input for centrifuge aiming system (any key)
            this.input.keyboard.on('keydown', (event) => {
                // Ignore modifier keys and already handled keys
                if (!event.repeat && event.key.length === 1) {
                    this.startCentrifugeAiming();
                }
            }, this);

            this.input.keyboard.on('keyup', (event) => {
                // Any key release throws the ball
                if (event.key.length === 1) {
                    this.throwBallInDirection(true); // True means from keyboard
                }

                // Debug toggle with D key
                if (event.key === 'd' || event.key === 'D') {
                    const debugState = this.toggleDebug();
                    console.log('Debug mode: ' + (debugState ? 'ON' : 'OFF'));
                }
            }, this);

            // Make objects interactive and draggable with explicit circular grab bounds
            this.ball.setInteractive({
                hitArea: new Phaser.Geom.Circle(this.ball.width / 2, this.ball.height / 2, this.ball.width / 2),
                hitAreaCallback: Phaser.Geom.Circle.Contains,
                draggable: true,
                useHandCursor: true
            });

            this.sun.setInteractive({
                hitArea: new Phaser.Geom.Circle(this.sun.width / 2, this.sun.height / 2, this.sun.width / 2),
                hitAreaCallback: Phaser.Geom.Circle.Contains,
                draggable: true,
                useHandCursor: true
            });

            this.clouds.forEach(cloud => {
                // The cloud's grab radius is specifically half its full width as requested (radius = width / 4)
                cloud.setInteractive({
                    hitArea: new Phaser.Geom.Circle(cloud.width / 2, cloud.height / 2, cloud.width / 4),
                    hitAreaCallback: Phaser.Geom.Circle.Contains,
                    draggable: true,
                    useHandCursor: true
                });
            });



            // Pointer/touch input for centrifuge aiming
            this.input.on('pointerdown', (pointer, currentlyOver) => {
                // 1. Only start if we didn't click directly on an interactive object
                // We check both the provided currentlyOver AND a manual hit test for safety
                const manualHitTest = this.input.hitTestPointer(pointer);
                if (currentlyOver.length > 0 || manualHitTest.length > 0) return;

                // 2. Cooldown check: don't start if we just finished dragging (prevents double-tap issues)
                if (this.isDragging || Date.now() - this.lastDragEndTime < 250) return;

                // 3. Safety zone check: don't start if we clicked very near the ball or other objects
                // This prevents "near misses" from turning into accidental centrifuge throws
                const objects = [this.ball, this.sun, ...this.clouds];
                const interactionBuffer = 40; // Reduced from 120 to allow throwing closer to objects

                const isNearRelevantObject = objects.some(obj => {
                    if (!obj || !obj.active) return false;
                    return Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, obj.x, obj.y) < interactionBuffer;
                });

                if (isNearRelevantObject) return;

                this.startCentrifugeAiming();
            }, this);

            this.input.on('pointerup', (pointer) => {
                // ONLY throw if aiming is active AND we are not in the middle of a drag
                // AND it's been a moment since the last drag ended (prevents firing during a flick release)
                if (this.isAiming && !this.isDragging && Date.now() - this.lastDragEndTime > 200) {
                    this.throwBallInDirection(false); // False means from pointer (mouse/touch)
                } else if (this.isAiming) {
                    // If we were aiming but it was a "dirty" release, just cancel it
                    this.isAiming = false;
                    this.directionIndicator.visible = false;
                    if (this.arrowShowTimeout) {
                        clearTimeout(this.arrowShowTimeout);
                        this.arrowShowTimeout = null;
                    }
                }
            }, this);

            this.input.on('dragstart', (pointer, gameObject) => {
                // If we were aiming (centrifuge), cancel it if we start dragging
                if (this.isAiming) {
                    this.isAiming = false;
                    this.directionIndicator.visible = false;
                    if (this.arrowShowTimeout) {
                        clearTimeout(this.arrowShowTimeout);
                        this.arrowShowTimeout = null;
                    }
                }

                this.isDragging = true;
                gameObject.setImmovable(false);
                if (gameObject.body) {
                    gameObject.body.allowGravity = false;
                    gameObject.setVelocity(0, 0);
                    gameObject.setAngularVelocity(0);
                }
                gameObject.setDepth(100); // Bring to front while dragging

                // Store drag start position and time for throw velocity calculation
                this.dragStartX = pointer.x;
                this.dragStartY = pointer.y;
                this.dragStartTime = Date.now();
            }, this);

            this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
                // Simply move object to pointer position - no physics during drag
                gameObject.x = dragX;
                gameObject.y = dragY;

                // If it's the ball, ensure gravity is disabled while dragging
                if (gameObject === this.ball) {
                    gameObject.body.allowGravity = false;
                }
            }, this);

            this.input.on('dragend', (pointer, gameObject) => {
                console.log('Drag end detected on:', gameObject === this.ball ? 'ball' : gameObject === this.sun ? 'sun' : 'cloud');
                this.isDragging = false;
                this.lastDragEndTime = Date.now();

                // Restore original depths: Ball (50) > Clouds (20) > Sun (10)
                if (gameObject === this.ball) {
                    gameObject.setDepth(50);
                } else if (gameObject === this.sun) {
                    gameObject.setDepth(10);
                } else {
                    // It's a cloud
                    gameObject.setDepth(20);
                }

                if (gameObject.body) {
                    // Re-enable gravity for ball only
                    if (gameObject === this.ball) {
                        gameObject.body.allowGravity = true;
                    }

                    // Calculate throw velocity based on drag distance and time
                    const dragDuration = Date.now() - this.dragStartTime;
                    const dragDistance = Math.sqrt(
                        Math.pow(pointer.x - this.dragStartX, 2) +
                        Math.pow(pointer.y - this.dragStartY, 2)
                    );

                    // Calculate speed (pixels per second)
                    const releaseSpeed = dragDuration > 0 ? (dragDistance / dragDuration) * 1000 : 0;

                    // Threshold for considering it a "throw" vs "place"
                    const throwThreshold = 300; // pixels per second
                    const isFastFlick = releaseSpeed > throwThreshold;

                    if (isFastFlick) {
                        // Fast flick = THROW: calculate velocity based on drag direction and speed
                        const throwAngle = Math.atan2(
                            pointer.y - this.dragStartY,
                            pointer.x - this.dragStartX
                        );
                        const throwSpeed = Math.min(releaseSpeed * 3, 6000);
                        const finalVelX = Math.cos(throwAngle) * throwSpeed;
                        const finalVelY = Math.sin(throwAngle) * throwSpeed;
                        gameObject.setVelocity(finalVelX, finalVelY);

                        // Add rotation based on flick (increased multiplier)
                        gameObject.setAngularVelocity(finalVelX * 1.5);

                        // Play throw sound
                        const throwSound = this.getSound('throwSound');
                        if (throwSound && this.canPlayAudio()) throwSound.play();

                        // Reset streak counters on throw
                        this.resetStreakCounters();

                        // If ball was thrown, reset session counter
                        if (gameObject === this.ball) {
                            this.isBallMoving = true;

                        }
                    } else {
                        // Slow drag = PLACE: stop the object gently
                        gameObject.setVelocity(0, 0);
                        gameObject.setAngularVelocity(0);

                        // Don't reset counters on placement
                    }
                }
            }, this);

            // Game state
            this.isBallMoving = false;

            // Initialize counters
            this.updateCounters();

            // Create direction indicator (hidden initially)
            this.directionIndicator = this.add.graphics();
            this.directionIndicator.setDepth(100); // Always stay on top
            this.directionIndicator.visible = false;

            // Set world bounds to full screen height
            this.physics.world.setBounds(0, 0, this.gameWidth, this.gameHeight);
        }

        throwBall() {
            // Calculate random angle between 20 and 160 degrees
            const randomAngle = Phaser.Math.Between(20, 160);
            const angleInRadians = Phaser.Math.DegToRad(randomAngle);

            // Convert angle to velocity components with MORE horizontal movement
            const speed = Phaser.Math.Between(300, 600); // Base speed

            // Double the horizontal component for more pronounced horizontal movement
            const velX = Math.cos(angleInRadians) * speed * 2; // Double horizontal
            const velY = -Math.sin(angleInRadians) * speed * 2; // Keep double vertical

            if (Phaser.Math.FloatBetween(0, 1) > 0.5) {
                this.ball.setVelocity(-velX, velY);
            } else {
                this.ball.setVelocity(velX, velY);
            }

            // Play throw sound
            const throwSound = this.getSound('throwSound');
            if (throwSound && this.canPlayAudio()) throwSound.play();

            // Set natural rotation based on horizontal velocity (increased multiplier)
            this.ball.setAngularVelocity(this.ball.body.velocity.x * 1.5);

            this.isBallMoving = true;

            // Reset session counter when ball is thrown
            this.resetStreakCounters();

            // DON'T reset cloud and sun velocities - let them keep moving
            // Only reset if they're not already moving
            this.clouds.forEach(cloud => {
                if (cloud.body.velocity.x === 0 && cloud.body.velocity.y === 0) {
                    cloud.setImmovable(true);
                }
            });
            if (this.sun.body.velocity.x === 0 && this.sun.body.velocity.y === 0) {
                this.sun.setImmovable(true);
            }
        }

        handleBallCloudCollision(ball, cloud) {
            // Make cloud movable when hit
            cloud.setImmovable(false);

            // Calculate bounce angle
            const angle = Phaser.Math.Angle.Between(ball.x, ball.y, cloud.x, cloud.y);

            // Add a "profound" nudge to separate them immediately
            // Reduced slightly for 120fps precision to keep it smooth
            const nudgeOffset = 12;
            ball.x -= Math.cos(angle) * nudgeOffset;
            ball.y -= Math.sin(angle) * nudgeOffset;
            cloud.x += Math.cos(angle) * nudgeOffset;
            cloud.y += Math.sin(angle) * nudgeOffset;

            // Set cloud velocity based on ball velocity and angle - 1.5x speed (Lighter)
            const ballVelocity = ball.body.velocity;
            let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 350); // Increased from 300

            // Softer collision with 25% energy loss (-25% speed)
            cloud.setVelocity(
                Math.cos(angle) * speed * 1.5 * 0.75, // Increased from 1.2
                Math.sin(angle) * speed * 1.5 * 0.75   // Increased from 1.2
            );

            // Also reduce ball's speed by 25% for more realistic physics
            ball.setVelocity(
                ballVelocity.x * 0.75,
                ballVelocity.y * 0.75
            );

            // Add natural rotation based on horizontal velocity after bounce (increased multiplier)
            ball.setAngularVelocity(ball.body.velocity.x * 1.5);

            // Add rotation to cloud on bounce
            const rotationSpeed = Phaser.Math.Between(-1, 1); // Random rotation speed
            cloud.setAngularVelocity(rotationSpeed * 100); // Degrees per second

            const ballSound = this.getSound('ballSound');
            const cloudSound = this.getSound('cloudSound');
            if (ballSound && this.canPlayAudio()) ballSound.play();
            if (cloudSound && this.canPlayAudio()) cloudSound.play();
            // Don't count points/bounces when dragging
            if (!this.isDragging) {
                this.incrementBounceCounter('ball', false, true, true); // Don't play redundant sound here
                this.incrementBounceCounter('cloud', false, false, false); // Don't play redundant sound here
            }
        }

        handleBallSunCollision(ball, sun) {
            // Make sun movable when hit
            sun.setImmovable(false);

            // Calculate bounce angle
            const angle = Phaser.Math.Angle.Between(ball.x, ball.y, sun.x, sun.y);

            // Add a "profound" nudge to separate them immediately
            const nudgeOffset = 4; // Halved from 8 (double heavy)
            ball.x -= Math.cos(angle) * (nudgeOffset * 4); // Ball still bounces away
            ball.y -= Math.sin(angle) * (nudgeOffset * 4);
            sun.x += Math.cos(angle) * nudgeOffset;
            sun.y += Math.sin(angle) * nudgeOffset;

            // Set sun velocity based on ball velocity and angle (Heavier)
            const ballVelocity = ball.body.velocity;
            let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 150); // Decreased from 250

            // Softer collision with 25% energy loss (-25% speed)
            sun.setVelocity(
                Math.cos(angle) * speed * 0.15 * 0.75, // Halved from 0.3
                Math.sin(angle) * speed * 0.15 * 0.75   // Halved from 0.3
            );

            // Also reduce ball's speed by 25% for more realistic physics
            ball.setVelocity(
                ballVelocity.x * 0.75,
                ballVelocity.y * 0.75
            );

            // Add natural rotation based on horizontal velocity after bounce (increased multiplier)
            ball.setAngularVelocity(ball.body.velocity.x * 1.5);

            // Add rotation to sun on bounce
            const rotationSpeed = Phaser.Math.Between(-0.5, 0.5); // Slower rotation for sun
            sun.setAngularVelocity(rotationSpeed * 50); // Degrees per second

            const ballSound = this.getSound('ballSound');
            const sunSound = this.getSound('sunSound');
            if (ballSound && this.canPlayAudio()) ballSound.play();
            if (sunSound && this.canPlayAudio()) sunSound.play();

            // Scoring: 1st hit = 2pts, 2nd hit = 4pts, 3rd+ hit = 8pts
            const sunPoints = this.sunStreak === 0 ? 2 : 4;

            // Don't count points/bounces when dragging
            if (!this.isDragging) {
                this.incrementBounceCounter('ball', false, true, true, sunPoints); // Add points to total/session
                this.incrementBounceCounter('sun', false, false, false); // Increment sun hits counter only
            }
        }

        // Add soft collision handling for cloud-cloud and cloud-sun collisions
        handleCloudCloudCollision(cloud1, cloud2) {
            // Calculate overlap and apply softer bounce
            const angle = Phaser.Math.Angle.Between(cloud1.x, cloud1.y, cloud2.x, cloud2.y);

            // Add a "profound" nudge to separate them immediately
            const nudgeOffset = 8;
            cloud1.x -= Math.cos(angle) * nudgeOffset;
            cloud1.y -= Math.sin(angle) * nudgeOffset;
            cloud2.x += Math.cos(angle) * nudgeOffset;
            cloud2.y += Math.sin(angle) * nudgeOffset;

            // Get velocities
            const vel1 = cloud1.body.velocity;
            const vel2 = cloud2.body.velocity;

            // Calculate relative velocity
            const relVelX = vel1.x - vel2.x;
            const relVelY = vel1.y - vel2.y;

            // Softer collision response with 25% energy loss (-25% speed)
            let speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 150);

            // Apply softer bounce with some overlap allowed and 25% energy loss
            const bounceX = Math.cos(angle) * speed * 0.9 * 0.75; // Increased from 0.6
            const bounceY = Math.sin(angle) * speed * 0.9 * 0.75; // Increased from 0.6

            cloud1.setVelocity(
                (vel1.x - bounceX) * 0.75, // 25% reduction
                (vel1.y - bounceY) * 0.75  // 25% reduction
            );
            cloud2.setVelocity(
                (vel2.x + bounceX) * 0.75, // 25% reduction
                (vel2.y + bounceY) * 0.75  // 25% reduction
            );

            // Add rotation to both clouds on collision
            cloud1.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
            cloud2.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);

            const cloudSound = this.getSound('cloudSound');
            if (cloudSound && this.canPlayAudio()) cloudSound.play();

            // Increment bounce counter (only when not dragging)
            if (!this.isDragging) {
                this.incrementBounceCounter('cloud', true, true, true);
            }
        }

        handleCloudSunCollision(cloud, sun) {
            // Similar soft collision for cloud-sun
            const angle = Phaser.Math.Angle.Between(cloud.x, cloud.y, sun.x, sun.y);

            // Add a "profound" nudge to separate them immediately
            const nudgeOffset = 10;
            cloud.x -= Math.cos(angle) * nudgeOffset;
            cloud.y -= Math.sin(angle) * nudgeOffset;
            sun.x += Math.cos(angle) * nudgeOffset;
            sun.y += Math.sin(angle) * nudgeOffset;

            // Get velocities
            const cloudVel = cloud.body.velocity;
            const sunVel = sun.body.velocity;

            // Calculate relative velocity
            const relVelX = cloudVel.x - sunVel.x;
            const relVelY = cloudVel.y - sunVel.y;

            // Softer collision response with 10% energy loss
            let speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 150);

            // Apply softer bounce with 25% energy loss (-25% speed)
            const bounceX = Math.cos(angle) * speed * 0.15 * 0.75; // Halved from 0.3
            const bounceY = Math.sin(angle) * speed * 0.15 * 0.75; // Halved from 0.3

            cloud.setVelocity(
                (cloudVel.x - bounceX) * 0.75, // 25% reduction
                (cloudVel.y - bounceY) * 0.75  // 25% reduction
            );
            sun.setVelocity(
                (sunVel.x + bounceX) * 0.75, // 25% reduction
                (sunVel.y + bounceY) * 0.75  // 25% reduction
            );

            // Add rotation to both objects on collision
            cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
            sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 50);

            const sunSound = this.getSound('sunSound');
            const cloudSound = this.getSound('cloudSound');
            if (sunSound && this.canPlayAudio()) sunSound.play();
            if (cloudSound && this.canPlayAudio()) cloudSound.play();

            // Increment bounce counter for cloud-sun collisions (only when not dragging)
            if (!this.isDragging) {
                this.incrementBounceCounter('sun', true, true, true);
                this.incrementBounceCounter('cloud', true, false, false);
            }
        }

        handleResizeCollisions(oldWidth, oldHeight, newWidth, newHeight) {
            // Safety: bail if objects aren't initialized yet (prevents crash on early resize)
            if (!this.ball || !this.clouds || !this.sun) return;

            // Update grass height for new screen size
            this.grassHeight = Math.min(newHeight * 0.2, 150);
            const playAreaHeight = newHeight - this.grassHeight;

            // Update grass and sky to new dimensions
            if (this.grass) {
                const overdraw = 1000;
                this.grass.width = newWidth + overdraw * 2;
                this.grass.height = this.grassHeight + 500; // Extra depth for bottom safe zones
                this.grass.x = -overdraw;
                this.grass.y = newHeight - this.grassHeight / 2 + 250; // Centered but shifted down
            }
            if (this.sky) {
                const overdraw = 1000;
                this.sky.width = newWidth + overdraw * 2;
                this.sky.height = newHeight + overdraw * 2;
                this.sky.x = -overdraw;
                this.sky.y = -overdraw;
            }

            // Force immediate redraw of camera to prevent garbled background on some mobile browsers
            this.cameras.main.setBackgroundColor('#87CEEB');
            this.cameras.main.setDirty();

            // Check if objects are now outside the new bounds and make them bounce
            const grassBottom = newHeight - this.grassHeight;

            // Check ball collision with new grass position
            if (this.ball && this.ball.y + this.ball.displayHeight / 2 > grassBottom) {
                // Ball is below grass - make it bounce
                this.ball.y = grassBottom - this.ball.displayHeight / 2;
                if (this.ball.body) {
                    const bounceVelocityY = -Math.abs(this.ball.body.velocity.y || 200) * 0.7;
                    const bounceVelocityX = (this.ball.body.velocity.x || 0) * 0.9;
                    this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
                }
            }

            // Check clouds collision with new boundaries
            this.clouds.forEach(cloud => {
                // Check bottom collision with grass
                if (cloud.y + cloud.displayHeight / 2 > grassBottom) {
                    cloud.y = grassBottom - cloud.displayHeight / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = -Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }

                // Check top collision with screen top
                if (cloud.y - cloud.displayHeight / 2 < 0) {
                    cloud.y = cloud.displayHeight / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }

                // Check side collisions
                if (cloud.x - cloud.displayWidth / 2 < 0) {
                    cloud.x = cloud.displayWidth / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityX = Math.abs(cloud.body.velocity.x) * 0.7;
                        const bounceVelocityY = cloud.body.velocity.y * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (cloud.x + cloud.displayWidth / 2 > newWidth) {
                    cloud.x = newWidth - cloud.displayWidth / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityX = -Math.abs(cloud.body.velocity.x) * 0.7;
                        const bounceVelocityY = cloud.body.velocity.y * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                }
            });

            // Check sun collision with new boundaries
            if (this.sun) {
                // Check bottom collision with grass
                if (this.sun.y + this.sun.displayHeight / 2 > grassBottom) {
                    this.sun.y = grassBottom - this.sun.displayHeight / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityY = -Math.abs(this.sun.body.velocity.y) * 0.7;
                        const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add gentle rotation on bounce
                        this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                    }
                }

                // Check top collision with screen top
                if (this.sun.y - this.sun.displayHeight / 2 < 0) {
                    this.sun.y = this.sun.displayHeight / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityY = Math.abs(this.sun.body.velocity.y) * 0.7;
                        const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add gentle rotation on bounce
                        this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                    }
                }

                // Check side collisions
                const currentWidth = this.gameWidth;
                if (this.sun.x - this.sun.displayWidth / 2 < 0) {
                    this.sun.x = this.sun.displayWidth / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityX = Math.abs(this.sun.body.velocity.x) * 0.7;
                        const bounceVelocityY = this.sun.body.velocity.y * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (this.sun.x + this.sun.displayWidth / 2 > currentWidth) {
                    this.sun.x = currentWidth - this.sun.displayWidth / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityX = -Math.abs(this.sun.body.velocity.x) * 0.7;
                        const bounceVelocityY = this.sun.body.velocity.y * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                }
            }
        }

        update() {


            // Spin the arrow continuously when aiming (centrifuge effect)
            if (this.isAiming) {
                // Add rotation speed in the random direction
                this.aimAngle += this.rotationSpeed * this.rotationDirection;

                // Wrap angle around 2π to keep it in valid range
                if (this.aimAngle >= Math.PI * 2) {
                    this.aimAngle -= Math.PI * 2;
                } else if (this.aimAngle < 0) {
                    this.aimAngle += Math.PI * 2;
                }

                this.updateDirectionIndicator();
            }

            // Sound priority execution removed

            // Draw debug information
            this.drawDebug();

            // Check if ball has stopped moving
            if (this.isBallMoving &&
                Math.abs(this.ball.body.velocity.x) < 5 &&
                Math.abs(this.ball.body.velocity.y) < 5) {
                this.isBallMoving = false;
                this.ball.setVelocity(0, 0);
                this.ball.setAngularVelocity(0);
                // Keep gravity enabled so ball falls if not on ground
                this.ball.body.allowGravity = true;
            }

            // Apply minimal damping to clouds to make them stop very gradually
            this.clouds.forEach(cloud => {
                if (cloud.body && cloud.body.velocity) {
                    const velX = cloud.body.velocity.x;
                    const velY = cloud.body.velocity.y;

                    // Apply much stronger damping to make them stop eventually
                    if (Math.abs(velX) < 100 && Math.abs(velY) < 100) {
                        cloud.setVelocity(velX * 0.96, velY * 0.96); // 4% damping (stopped from 2%)
                    } else {
                        cloud.setVelocity(velX * 0.98, velY * 0.98); // 2% damping (stopped from 1%)
                    }

                    // Stop completely if moving very slowly
                    if (Math.abs(velX) < 2 && Math.abs(velY) < 2) {
                        cloud.setVelocity(0, 0);
                        if (Math.abs(cloud.body.angularVelocity) < 1) {
                            cloud.setAngularVelocity(0);
                        }
                    }

                    // Dampen rotation as well
                    if (cloud.body.angularVelocity !== 0) {
                        cloud.setAngularVelocity(cloud.body.angularVelocity * 0.96); // 4% rotation damping
                    }
                }

                // Full screen/grass boundary checks mirroring the sun's logic
                // Check top collision
                if (cloud.y - cloud.displayHeight / 2 < 0) {
                    cloud.y = cloud.displayHeight / 2;
                    if (cloud.body && cloud.body.velocity) {
                        cloud.setVelocity(cloud.body.velocity.x * 0.9, Math.abs(cloud.body.velocity.y) * 0.7);
                    }
                }

                // Check side collisions
                if (cloud.x - cloud.displayWidth / 2 < 0) {
                    cloud.x = cloud.displayWidth / 2;
                    if (cloud.body && cloud.body.velocity) {
                        cloud.setVelocity(Math.abs(cloud.body.velocity.x) * 0.7, cloud.body.velocity.y * 0.9);
                    }
                } else if (cloud.x + cloud.displayWidth / 2 > this.gameWidth) {
                    cloud.x = this.gameWidth - cloud.displayWidth / 2;
                    if (cloud.body && cloud.body.velocity) {
                        cloud.setVelocity(-Math.abs(cloud.body.velocity.x) * 0.7, cloud.body.velocity.y * 0.9);
                    }
                }

                // Grass/Ground bounce (bottom boundary)
                if (cloud.y > this.gameHeight - this.grassHeight - cloud.displayHeight / 2 + 20) {
                    cloud.y = this.gameHeight - this.grassHeight - cloud.displayHeight / 2;
                    if (cloud.body && cloud.body.velocity) {
                        cloud.setVelocity(cloud.body.velocity.x * 0.9, -Math.abs(cloud.body.velocity.y) * 0.7);
                    }
                }
            });

            // Apply tiny damping to sun to make it slow down gradually
            if (this.sun && this.sun.body && this.sun.body.velocity) {
                const velX = this.sun.body.velocity.x;
                const velY = this.sun.body.velocity.y;

                // Apply damping to sun movement
                if (Math.abs(velX) < 100 && Math.abs(velY) < 100) {
                    this.sun.setVelocity(velX * 0.97, velY * 0.97); // 3% damping
                } else {
                    this.sun.setVelocity(velX * 0.99, velY * 0.99); // 1% damping
                }

                // Stop completely if moving very slowly
                if (Math.abs(velX) < 2 && Math.abs(velY) < 2) {
                    this.sun.setVelocity(0, 0);
                    if (Math.abs(this.sun.body.angularVelocity) < 1) {
                        this.sun.setAngularVelocity(0);
                    }
                }

                // Dampen sun rotation as well
                if (this.sun.body.angularVelocity !== 0) {
                    this.sun.setAngularVelocity(this.sun.body.angularVelocity * 0.97); // 3% rotation damping
                }
            }

            // Sun boundary collisions (top, sides, grass)
            if (this.sun && this.sun.body && this.sun.body.velocity) {
                const bounceThreshold = 30;

                // Top boundary
                if (this.sun.y - this.sun.displayHeight / 2 < 0) {
                    this.sun.y = this.sun.displayHeight / 2;
                    if (Math.abs(this.sun.body.velocity.y) > bounceThreshold) {
                        const sunSound = this.getSound('sunSound');
                        if (sunSound && this.canPlayAudio()) sunSound.play();
                    }
                    this.sun.setVelocity(this.sun.body.velocity.x * 0.9, Math.abs(this.sun.body.velocity.y) * 0.7);
                    this.sun.setAngularVelocity(this.sun.body.angularVelocity + Phaser.Math.Between(-10, 10));
                }

                // Side boundaries
                if (this.sun.x - this.sun.displayWidth / 2 < 0) {
                    this.sun.x = this.sun.displayWidth / 2;
                    if (Math.abs(this.sun.body.velocity.x) > bounceThreshold) {
                        const sunSound = this.getSound('sunSound');
                        if (sunSound && this.canPlayAudio()) sunSound.play();
                    }
                    this.sun.setVelocity(Math.abs(this.sun.body.velocity.x) * 0.7, this.sun.body.velocity.y * 0.9);
                } else if (this.sun.x + this.sun.displayWidth / 2 > this.gameWidth) {
                    this.sun.x = this.gameWidth - this.sun.displayWidth / 2;
                    if (Math.abs(this.sun.body.velocity.x) > bounceThreshold) {
                        const sunSound = this.getSound('sunSound');
                        if (sunSound && this.canPlayAudio()) sunSound.play();
                    }
                    this.sun.setVelocity(-Math.abs(this.sun.body.velocity.x) * 0.7, this.sun.body.velocity.y * 0.9);
                }

                // Grass/Ground bounce
                if (this.sun.y > this.gameHeight - this.grassHeight - this.sun.displayHeight / 2 + 20) {
                    this.sun.y = this.gameHeight - this.grassHeight - this.sun.displayHeight / 2;
                    if (Math.abs(this.sun.body.velocity.y) > bounceThreshold) {
                        const sunSound = this.getSound('sunSound');
                        if (sunSound && this.canPlayAudio()) sunSound.play();
                    }
                    this.sun.setVelocity(this.sun.body.velocity.x * 0.9, -Math.abs(this.sun.body.velocity.y) * 0.7);
                }
            }
            // Limit ball bounce to half of grass height, raised 10px higher
            const maxBounceHeight = this.gameHeight - this.grassHeight / 2 - 10;
            if (this.ball.y > maxBounceHeight) {
                // If ball is falling slowly, just settle it on the grass
                if (Math.abs(this.ball.body.velocity.y) < 30) {
                    this.ball.y = maxBounceHeight;
                    this.ball.setVelocity(this.ball.body.velocity.x * 0.9, 0);
                    if (Math.abs(this.ball.body.velocity.x) < 5) {
                        this.ball.setVelocity(0, 0);
                        this.ball.setAngularVelocity(0);
                        this.isBallMoving = false;
                    }
                } else {
                    this.ball.y = maxBounceHeight;
                    if (this.ball.body.velocity) {
                        // Play bounce sound if velocity is significant
                        if (Math.abs(this.ball.body.velocity.y) > 30) {
                            const ballSound = this.getSound('ballSound');
                            if (ballSound && this.canPlayAudio()) ballSound.play();
                        }

                        // Bounce the ball with reduced velocity
                        const bounceVelocityY = -Math.abs(this.ball.body.velocity.y) * 0.6;
                        const bounceVelocityX = this.ball.body.velocity.x * 0.9;
                        this.ball.setVelocity(bounceVelocityX, bounceVelocityY);

                        // Add natural rotation from grass bounce (increased multiplier)
                        this.ball.setAngularVelocity(bounceVelocityX * 1.5);
                    }
                }
            }

            // Remove manual border collision handling - let Phaser handle it naturally
            // The ball's collideWorldBounds property will handle border collisions properly

            // Check if ball is stuck (very slow movement) and give it a nudge
            if (this.isBallMoving &&
                Math.abs(this.ball.body.velocity.x) < 1 &&
                Math.abs(this.ball.body.velocity.y) < 1 &&
                (this.ball.body.velocity.x !== 0 || this.ball.body.velocity.y !== 0)) { // Only nudge if not completely stopped
                // Ball is moving very slowly - give it a small random nudge
                this.ball.setVelocity(
                    this.ball.body.velocity.x + Phaser.Math.Between(-5, 5),
                    this.ball.body.velocity.y + Phaser.Math.Between(-5, 5)
                );
            }
        }

        startCentrifugeAiming() {
            // Never start aiming if we are in the middle of a drag or just finished one
            if (this.isDragging || Date.now() - this.lastDragEndTime < 250) return;

            // Re-enable gravity for the ball if we start aiming (it might have been disabled while stopped)
            if (this.ball && this.ball.body) {
                this.ball.body.allowGravity = true;
            }

            this.isAiming = true;
            this.directionIndicator.visible = false; // Start hidden
            this.keyDownTime = Date.now();
            // Start with a random angle (different each time)
            this.aimAngle = Math.PI + Math.random() * Math.PI; // π to 2π radians (top 180 degrees)
            // Random direction: clockwise or counter-clockwise
            this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
            // Reset session counter immediately when aiming starts
            this.resetStreakCounters();

            // Set timeout to show arrow after 200ms
            this.arrowShowTimeout = setTimeout(() => {
                if (this.isAiming) {
                    this.directionIndicator.visible = true;
                }
            }, 200);
        }

        // Helper method to generate random sun position in upper half of screen
        getRandomSunPosition() {
            const minX = 120; // Minimum X position (left margin)
            const maxX = this.gameWidth - 120; // Maximum X position (right margin)
            const minY = 80; // Minimum Y position (top margin)
            const maxY = (this.gameHeight - this.grassHeight) * 0.4; // Upper half of playable area

            return {
                x: Phaser.Math.Between(minX, maxX),
                y: Phaser.Math.Between(minY, maxY)
            };
        }

        updateDirectionIndicator() {
            if (!this.directionIndicator || !this.ball) return;

            const graphics = this.directionIndicator;
            graphics.clear();

            // Calculate arrow length based on press duration
            const pressDuration = Date.now() - this.keyDownTime;
            const maxLength = 100;
            const minLength = 40;
            const durationForFullShrink = 7500;
            const normalizedDuration = Math.min(pressDuration, durationForFullShrink) / durationForFullShrink;
            const easeOutDuration = 1 - Math.pow(1 - normalizedDuration, 1.5);
            const arrowLength = maxLength - (maxLength - minLength) * easeOutDuration;

            // Main arrow geometry
            const startX = this.ball.x;
            const startY = this.ball.y;
            const endX = startX + Math.cos(this.aimAngle) * arrowLength;
            const endY = startY + Math.sin(this.aimAngle) * arrowLength;

            // Arrowhead calculations
            const headLength = arrowLength * 0.1; // Halved from 0.2
            const headWidth = arrowLength * 0.06; // Halved from 0.12
            const angle = this.aimAngle;

            // Vertices for the triangular arrowhead
            const p1X = endX;
            const p1Y = endY;
            const p2X = endX - headLength * Math.cos(angle) + headWidth * Math.sin(angle);
            const p2Y = endY - headLength * Math.sin(angle) - headWidth * Math.cos(angle);
            const p3X = endX - headLength * Math.cos(angle) - headWidth * Math.sin(angle);
            const p3Y = endY - headLength * Math.sin(angle) + headWidth * Math.cos(angle);

            // 1. Draw MAIN BLACK ARROW
            graphics.lineStyle(3, 0x000000, 1.0); // Halved from 6
            graphics.beginPath();
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();

            // Draw black filled arrowhead
            graphics.fillStyle(0x000000, 1.0);
            graphics.beginPath();
            graphics.moveTo(p1X, p1Y);
            graphics.lineTo(p2X, p2Y);
            graphics.lineTo(p3X, p3Y);
            graphics.closePath();
            graphics.fillPath();
        }

        throwBallInDirection(fromKeyboard = false) {
            if (!this.isAiming) return;

            // Calculate press duration
            const pressDuration = Date.now() - this.keyDownTime;

            // Prevent accidental "double throws" from quick background taps while dragging/flicking
            // If it's a mouse/touch interaction (not keyboard), ignore it if it's less than 40ms
            if (!fromKeyboard && pressDuration < 40) {
                this.isAiming = false;
                this.directionIndicator.visible = false;
                if (this.arrowShowTimeout) {
                    clearTimeout(this.arrowShowTimeout);
                    this.arrowShowTimeout = null;
                }
                return;
            }

            this.isAiming = false;
            this.directionIndicator.visible = false;

            // Clear the arrow show timeout if it exists
            if (this.arrowShowTimeout) {
                clearTimeout(this.arrowShowTimeout);
                this.arrowShowTimeout = null;
            }

            // Calculate speed based on press duration with step-based halving
            const baseSpeed = Phaser.Math.Between(1600, 2800); // Initial speed for <200ms
            let speed;

            // Step-based slowdown: halve speed at each time threshold (3x slower than previous)
            if (pressDuration < 1800) {
                // 0-1800ms: full speed
                speed = baseSpeed;
            } else if (pressDuration < 4500) {
                // 1800-4500ms: half speed
                speed = baseSpeed * 0.5;
            } else if (pressDuration < 9000) {
                // 4500-9000ms: quarter speed
                speed = baseSpeed * 0.25;
            } else {
                // >9000ms: minimum speed (still throws the ball)
                speed = baseSpeed * 0.15; // Ensures the ball still moves
            }

            // Use the current aim angle (where the arrow stopped)
            const finalAngle = this.aimAngle;

            // Calculate velocity
            const velX = Math.cos(finalAngle) * speed;
            const velY = Math.sin(finalAngle) * speed;

            // Apply velocity to ball
            this.ball.setVelocity(velX, velY);

            // Reset streak counters on button throw
            this.resetStreakCounters();

            // Play throw sound
            const throwSound = this.getSound('throwSound');
            if (throwSound && this.canPlayAudio()) throwSound.play();

            // Set natural rotation based on horizontal velocity (increased multiplier)
            this.ball.setAngularVelocity(velX * 1.5);

            this.isBallMoving = true;

            // Removed the code that set objects to 'immovable' here.
            // Objects now slow down naturally via damping, which prevents accidental 'freezing'.
        }

        resetStreakCounters() {
            this.sessionPoints = 0;
            this.ballStreak = 0;
            this.sunStreak = 0;
            this.cloudStreak = 0;
            this.updateCounters();
        }

        updateCounters() {
            // Create new counter table structure
            const counterTable = document.getElementById('counter-table');
            if (counterTable) {
                // Clear existing content
                counterTable.innerHTML = '';

                // Create table HTML with SVG icons and larger font
                const tableHTML = `
                    <table>
                        <tr>
                            <th style="text-align: left;"><span style="margin-left: 6px">P</span></th>
                            <td style="text-align: right;">${this.totalPoints}</td>
                            <td style="text-align: right;">${this.sessionPoints}</td>
                        </tr>
                        <tr>
                            <td style="text-align: left; vertical-align: middle;"><img src="svg/ballnoblur.svg" width="16" height="16" style="vertical-align: middle; margin-left: 2px;"></td>
                            <td style="text-align: right; vertical-align: middle;">${this.ballBounces}</td>
                            <td style="text-align: right; vertical-align: middle;">${this.ballStreak}</td>
                        </tr>
                        <tr>
                            <td style="text-align: left; vertical-align: middle;"><img src="svg/sunnoblur.svg" width="20" height="20" style="vertical-align: middle;"></td>
                            <td style="text-align: right; vertical-align: middle;">${this.sunBounces}</td>
                            <td style="text-align: right; vertical-align: middle;">${this.sunStreak}</td>
                        </tr>
                        <tr>
                            <td style="text-align: left; vertical-align: middle;"><img src="svg/cloudnoblur.svg" width="20" height="20" style="vertical-align: middle;"></td>
                            <td style="text-align: right; vertical-align: middle;">${this.cloudBounces}</td>
                            <td style="text-align: right; vertical-align: middle;">${this.cloudStreak}</td>
                        </tr>
                    </table>
                `;
                counterTable.innerHTML = tableHTML;
            }
        }

        // Helper method to detect Safari browser
        isSafari() {
            const userAgent = window.navigator.userAgent;
            const isiOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            return isiOS || (userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium'));
        }

        // Helper method to check if audio can be played
        canPlayAudio() {
            return this.audioContextUnlocked && !this.sound.mute;
        }

        // Helper method to get sound instance (handles lazy initialization)
        getSound(soundName) {
            if (!this.audioContextUnlocked) return null;
            return this[soundName];
        }

        incrementBounceCounter(objectType = 'ball', playSound = true, incrementTotal = true, incrementSession = true, points = 1) {
            // console.log('increment', objectType, incrementTotal, incrementSession, this.sessionPoints)
            // Skip counter updates during initialization period
            if (!this.counterUpdatesEnabled) {
                return;
            }

            if (incrementTotal) {
                this.totalPoints += points;
            }
            if (incrementSession) {
                this.sessionPoints += points;
            }
            // console.log('increment2', objectType, incrementTotal, incrementSession, this.totalPoints, this.sessionPoints)
            // Increment object-specific counter
            switch (objectType) {
                case 'ball':
                    this.ballBounces++;
                    this.ballStreak++;
                    break;
                case 'sun':
                    this.sunBounces++;
                    this.sunStreak++;
                    break;
                case 'cloud':
                    this.cloudBounces++;
                    this.cloudStreak++;
                    break;
                default:
                    this.ballBounces++;
                    this.ballStreak++;
            }

            this.updateCounters();

            // Play generic bounce sound only if requested and audio is unlocked
            if (playSound && this.canPlayAudio()) {
                const ballSound = this.getSound('ballSound');
                if (ballSound) ballSound.play();
            }
        }


        resetGame() {
            // Reset ball position and velocity
            this.ball.setPosition(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50);
            this.ball.setVelocity(0, 0);
            this.ball.setAngularVelocity(0);
            this.ball.setAngle(0);

            // Reset sun position and velocity (random position in upper half)
            const sunPosition = this.getRandomSunPosition();
            this.sun.setPosition(sunPosition.x, sunPosition.y);
            this.sun.setVelocity(0, 0);
            this.sun.setAngularVelocity(0);
            this.sun.setAngle(Phaser.Math.Between(-5, 5));
            this.sun.setFlipX(Math.random() < 0.5);
            this.sun.setImmovable(true);

            // Reset clouds positions and velocities
            const playAreaHeight = this.gameHeight - this.grassHeight;
            const placedClouds = [];
            this.clouds.forEach(cloud => {
                let cloudX, cloudY, overlaps;
                let attempts = 0;
                do {
                    cloudX = Phaser.Math.Between(150, this.gameWidth - 150);
                    cloudY = Phaser.Math.Between(100, playAreaHeight * 0.7);
                    overlaps = false;
                    // Check against other reset clouds
                    for (const pc of placedClouds) {
                        const dist = Phaser.Math.Distance.Between(cloudX, cloudY, pc.x, pc.y);
                        if (dist < 250) {
                            overlaps = true;
                            break;
                        }
                    }
                    // Check against sun
                    const distToSun = Phaser.Math.Distance.Between(cloudX, cloudY, this.sun.x, this.sun.y);
                    if (distToSun < 200) {
                        overlaps = true;
                    }
                    attempts++;
                } while (overlaps && attempts < 100);

                cloud.setPosition(cloudX, cloudY);
                cloud.setVelocity(0, 0);
                cloud.setAngularVelocity(0);
                cloud.setAngle(Phaser.Math.Between(-5, 5));
                cloud.setFlipX(Math.random() < 0.5);
                cloud.setImmovable(true);
                placedClouds.push({ x: cloudX, y: cloudY });
            });

            // Reset game state
            this.isBallMoving = false;

            // Cancel any active aiming
            this.isAiming = false;
            this.directionIndicator.visible = false;
            if (this.arrowShowTimeout) {
                clearTimeout(this.arrowShowTimeout);
                this.arrowShowTimeout = null;
            }

            // Reset all counters
            this.totalPoints = 0;
            this.sessionPoints = 0;
            this.ballBounces = 0;
            this.sunBounces = 0;
            this.cloudBounces = 0;
            this.ballStreak = 0;
            this.sunStreak = 0;
            this.cloudStreak = 0;

            // Prevent counter updates during reset period
            this.counterUpdatesEnabled = false;

            // Re-enable counters after 500ms to avoid counting initial object bounces
            setTimeout(() => {
                this.counterUpdatesEnabled = true;
            }, 500);

            this.updateCounters();
        }

        toggleMute() {
            // Ensure sound system is initialized before toggling
            if (!this.audioContextUnlocked) {
                // If sounds aren't initialized yet, just update the UI and return
                // The actual mute state will be set when sounds are initialized
                const muteButton = document.getElementById('mute-button');
                if (muteButton) {
                    if (muteButton.classList.contains('muted')) {
                        muteButton.classList.remove('muted');
                    } else {
                        muteButton.classList.add('muted');
                    }
                }
                return !muteButton.classList.contains('muted');
            }

            // Toggle the master mute setting in Phaser
            const newMuteState = !this.sound.mute;
            this.sound.mute = newMuteState;

            // Update the UI icon immediately using explicit add/remove
            const muteButton = document.getElementById('mute-button');
            if (muteButton) {
                if (newMuteState) {
                    muteButton.classList.add('muted');
                } else {
                    muteButton.classList.remove('muted');
                }
            }

            // Save preference with better error handling
            try {
                // Check if localStorage is available and working
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('babyBallGameMuted', newMuteState);
                }
            } catch (e) {
                // Handle Safari private mode or quota exceeded errors
                console.warn('Failed to save mute state to localStorage:', e);
            }

            return newMuteState;
        }

        // Toggle debug mode
        toggleDebug() {
            this.debugEnabled = !this.debugEnabled;

            // When enabling debug, enable all debug features
            if (this.debugEnabled) {
                this.debugHitAreas = true;
                this.debugObjectSizes = true;
                this.debugPhysics = true;
                this.debugGrassArea = true;
            } else {
                // When disabling debug, disable all debug features
                this.debugHitAreas = false;
                this.debugObjectSizes = false;
                this.debugPhysics = false;
                this.debugGrassArea = false;
            }

            return this.debugEnabled;
        }

        // Draw debug information
        drawDebug() {
            if (!this.debugEnabled) return;

            const graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 }, fillStyle: { color: 0xff0000 } });

            // Draw grass boundary
            if (this.debugGrassArea && this.grassHeight > 0) {
                graphics.lineStyle(2, 0xffff00); // Yellow line for grass boundary
                graphics.strokeRect(0, this.gameHeight - this.grassHeight, this.gameWidth, this.grassHeight);

                // Draw grass top boundary line
                graphics.lineStyle(3, 0xff0000); // Red line for grass top
                graphics.beginPath();
                graphics.moveTo(0, this.gameHeight - this.grassHeight);
                graphics.lineTo(this.gameWidth, this.gameHeight - this.grassHeight);
                graphics.strokePath();
            }

            // Draw object hit areas
            if (this.debugHitAreas || this.debugObjectSizes) {
                // Ball hit area
                if (this.ball && this.ball.body) {
                    graphics.lineStyle(2, 0x00ff00); // Green for ball
                    const ballRadius = this.ball.body.radius;
                    graphics.strokeCircle(this.ball.x, this.ball.y, ballRadius);

                    // Draw ball center cross
                    graphics.lineStyle(1, 0x00ff00);
                    graphics.beginPath();
                    graphics.moveTo(this.ball.x - 10, this.ball.y);
                    graphics.lineTo(this.ball.x + 10, this.ball.y);
                    graphics.moveTo(this.ball.x, this.ball.y - 10);
                    graphics.lineTo(this.ball.x, this.ball.y + 10);
                    graphics.strokePath();
                }

                // Sun hit area
                if (this.sun && this.sun.body) {
                    graphics.lineStyle(2, 0xffff00); // Yellow for sun
                    const sunRadius = this.sun.body.radius;
                    graphics.strokeCircle(this.sun.x, this.sun.y, sunRadius);

                    // Draw sun center cross
                    graphics.lineStyle(1, 0xffff00);
                    graphics.beginPath();
                    graphics.moveTo(this.sun.x - 8, this.sun.y);
                    graphics.lineTo(this.sun.x + 8, this.sun.y);
                    graphics.moveTo(this.sun.x, this.sun.y - 8);
                    graphics.lineTo(this.sun.x, this.sun.y + 8);
                    graphics.strokePath();
                }

                // Cloud hit areas
                this.clouds.forEach(cloud => {
                    if (!cloud.active || !cloud.body) return;
                    graphics.lineStyle(2, 0x00ffff); // Cyan for clouds
                    const cloudRadius = cloud.body.radius;
                    graphics.strokeCircle(cloud.x, cloud.y, cloudRadius);

                    // Draw cloud center cross
                    graphics.lineStyle(1, 0x00ffff);
                    graphics.beginPath();
                    graphics.moveTo(cloud.x - 8, cloud.y);
                    graphics.lineTo(cloud.x + 8, cloud.y);
                    graphics.moveTo(cloud.x, cloud.y - 8);
                    graphics.lineTo(cloud.x, cloud.y + 8);
                    graphics.strokePath();
                });
            }

            // Physics body boundaries are now shown as half circles with the main objects
            // (removed separate square drawing since we're using circular representations)

            // Draw screen boundaries
            graphics.lineStyle(3, 0xffffff); // White for screen boundaries
            graphics.strokeRect(0, 0, this.gameWidth, this.gameHeight);

            // Clean up graphics object
            setTimeout(() => {
                graphics.destroy();
            }, 16); // Destroy after one frame
        }
    }

    // Make game take up full screen with proper vertical resizing
    const getGameSize = () => {
        // Take full screen dimensions from the container which handles 100dvh
        const container = document.getElementById('game-container');
        if (container) {
            return {
                width: container.clientWidth,
                height: container.clientHeight
            };
        }

        // Fallback
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
                fps: 120, // Doubled precision for high-speed throws
                fixedStep: true // More consistent simulation
            }
        },
        scene: [BabyBallGame],
        render: {
            pixelArt: false,
            antialias: true,
            roundPixels: false // Set to false to prevent artifacts during dynamic resizing/rotation
        },
        backgroundColor: '#87CEEB', // Match sky color
        transparent: false, // Better performance and rendering on Safari
        resolution: window.devicePixelRatio || 1, // Crucial for Retina displays (Safari/iOS)
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container',
            expandParent: true
        }
    };

    const game = new Phaser.Game(config);

    // Remove the manual styling that overrides Phaser's internal logic
    // Phaser handles the resize and canvas styling correctly through its config

    // Handle window resize with object collision detection
    window.addEventListener('resize', () => {
        // Use a small delay to allow mobile browsers to settle (e.g. address bar hiding)
        setTimeout(() => {
            const newSize = getGameSize();

            // Directly resize the game canvas to fill screen
            if (game.scale) {
                game.scale.resize(newSize.width, newSize.height);
            }

            // Update the game scene's dimensions
            if (game.scene.scenes.length > 0) {
                const scene = game.scene.scenes[0];
                if (scene.gameWidth !== undefined && scene.gameHeight !== undefined) {
                    const oldWidth = scene.gameWidth;
                    const oldHeight = scene.gameHeight;
                    scene.gameWidth = newSize.width;
                    scene.gameHeight = newSize.height;

                    // Update world bounds to full new dimensions
                    if (scene.physics && scene.physics.world) {
                        scene.physics.world.setBounds(0, 0, newSize.width, newSize.height);
                    }

                    // Handle object collisions with resized borders
                    scene.handleResizeCollisions(oldWidth, oldHeight, newSize.width, newSize.height);
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
        // Blur the button to remove focus
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
        // Blur the button to remove focus
        document.getElementById('mute-button').blur();
    });
}