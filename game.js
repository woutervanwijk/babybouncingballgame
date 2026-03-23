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
            this.totalBounces = 0;
            this.sessionBounces = 0;
            this.isAiming = false;
            this.directionIndicator = null;
            this.aimAngle = 0;
            this.keyDownTime = 0;
            this.rotationSpeed = 0.05; // Radians per frame (slower for smoother rotation)
            this.rotationDirection = 1; // 1 for clockwise, -1 for counter-clockwise
            this.arrowShowTimeout = null; // Timeout for showing arrow
            this.isDragging = false; // Track if an object is being dragged
            this.lastDragEndTime = 0; // Timestamp of last drag end
        }

        preload() {
            // Load SVG assets from the svg directory
            // Load SVG assets with higher resolution for Retina displays
            // We load them at 2x the display size to ensure they're sharp
            this.load.svg('cloud', 'svg/cloud.svg', { width: 450, height: 450 });
            this.load.svg('sun', 'svg/sun.svg', { width: 240, height: 240 });
            this.load.svg('ball', 'svg/ball.svg', { width: 200, height: 200 });

            // Load sound effects
            this.load.audio('bounce', 'assets/audio/bounce.mp3');
            this.load.audio('throw', 'assets/audio/throw.mp3');
        }


        create() {
            // Initialize sound effects
            this.bounceSound = this.sound.add('bounce', { volume: 0.45 });
            this.throwSound = this.sound.add('throw', { volume: 0.225 }); // Lowered for longer sound

            // Set up physics - only ball has gravity
            this.physics.world.gravity.y = 300;

            // Store game dimensions
            this.gameWidth = this.game.config.width;
            this.gameHeight = this.game.config.height;

            // Create grass boundary (adaptive height based on screen size)
            this.grassHeight = Math.min(this.gameHeight * 0.2, 150); // Max 150px grass
            this.grass = this.add.rectangle(0, this.gameHeight - this.grassHeight / 2,
                this.gameWidth, this.grassHeight, 0x7CFC00)
                .setOrigin(0, 0.5);

            // Create sky background (fill remaining space)
            this.sky = this.add.rectangle(0, 0, this.gameWidth, this.gameHeight - this.grassHeight, 0x87CEEB)
                .setOrigin(0, 0);

            // Create ball (only object with gravity) - position above grass
            this.ball = this.physics.add.sprite(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50, 'ball');
            this.ball.setDisplaySize(90, 90);
            this.ball.setBounce(0.6);
            this.ball.setCollideWorldBounds(true);
            this.ball.body.onWorldBounds = true;
            this.ball.setAngularDrag(150); // Natural rotation damping
            this.ball.setDepth(50); // Bring ball to front
            this.ball.body.setCircle(this.ball.width / 2);

            // Play bounce sound when ball hits world bounds
            this.physics.world.on('worldbounds', (body) => {
                if (body && body.gameObject === this.ball) {
                    // Only play if it hits with some force
                    if (Math.abs(body.velocity.x) > 30 || Math.abs(body.velocity.y) > 30) {
                        if (this.bounceSound) this.bounceSound.play();
                    }
                }
            });
            // Create sun (NO GRAVITY - only moves when hit)
            const playAreaHeight = this.gameHeight - this.grassHeight;
            this.sun = this.physics.add.sprite(120, 120, 'sun');
            this.sun.setDisplaySize(120, 120);
            this.sun.setFlipX(Math.random() < 0.5);
            this.sun.setAngle(Phaser.Math.Between(-5, 5));
            this.sun.setBounce(1.0);
            this.sun.setCollideWorldBounds(true);
            this.sun.setImmovable(true);
            this.sun.setVelocity(0, 0);

            // Remove gravity from sun
            const sunRadius = this.sun.width * 0.2025; // 10% smaller from 0.225
            this.sun.body.setCircle(sunRadius, this.sun.width * 0.2975, this.sun.width * 0.2975); // Centered hitbox
            this.sun.body.allowGravity = false;
            this.sun.setDepth(10); // Sun stays in back

            // Determine screen mode based on width
            if (this.gameWidth >= 1200 || this.gameHeight >= 1200) {
                this.screenMode = "largeScreen";
            } else if (this.gameWidth >= 800 || this.gameHeight >= 800) {
                this.screenMode = "mediumScreen";
            } else {
                this.screenMode = "smallScreen";
            }

            // Create clouds (NO GRAVITY - only move when hit)
            const cloudTextures = ["cloud"];
            const cloudCount = this.screenMode === "largeScreen" ? 8 : (this.screenMode === "mediumScreen" ? 6 : 4);
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
                cloud.setDisplaySize(225, 225);
                cloud.setBounce(1.0);
                cloud.setCollideWorldBounds(true);
                cloud.setImmovable(true);
                cloud.body.allowGravity = false;
                const cloudRadius = cloud.width * 0.162; // 10% smaller from 0.18
                cloud.body.setCircle(cloudRadius, cloud.width * 0.338, cloud.width * 0.338); // Centered hitbox
                cloud.setFlipX(Math.random() < 0.5);
                cloud.setAngle(Phaser.Math.Between(-5, 5));
                cloud.setDepth(20); // Clouds stay in front of sun
                this.clouds.push(cloud);
            }

            // Set up collisions
            this.physics.add.collider(this.ball, this.clouds, this.handleBallCloudCollision, null, this);
            this.physics.add.collider(this.ball, this.sun, this.handleBallSunCollision, null, this);
            this.physics.add.collider(this.clouds, this.clouds, this.handleCloudCloudCollision, null, this);
            this.physics.add.collider(this.clouds, this.sun, this.handleCloudSunCollision, null, this);

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
            }, this);

            // Make objects interactive and draggable
            this.ball.setInteractive({ draggable: true, useHandCursor: true });
            this.sun.setInteractive({ draggable: true, useHandCursor: true });
            this.clouds.forEach(cloud => {
                cloud.setInteractive({ draggable: true, useHandCursor: true });
            });

            // Pointer/touch input for centrifuge aiming
            this.input.on('pointerdown', (pointer, currentlyOver) => {
                // 1. Only start if we didn't click directly on an interactive object
                // We check both the provided currentlyOver AND a manual hit test for safety
                const manualHitTest = this.input.hitTestPointer(pointer);
                if (currentlyOver.length > 0 || manualHitTest.length > 0) return;

                // 2. Cooldown check: don't start if we just finished dragging (prevents double-tap issues)
                if (this.isDragging || Date.now() - this.lastDragEndTime < 500) return;

                // 3. Safety zone check: don't start if we clicked very near the ball or other objects
                // This prevents "near misses" from turning into accidental centrifuge throws
                const objects = [this.ball, this.sun, ...this.clouds];
                const interactionBuffer = 120; // Radius around object centers to ignore centrifuge starts

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
                gameObject.setDepth(1000); // Bring to front while dragging
            }, this);

            this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
                // Smoothly move object to pointer while maintaining physics velocity for collisions
                if (gameObject.body) {
                    // Update velocity so it can "push" other objects it hits
                    // Cap the delta to prevent velocity spikes when frames are dropped
                    const safeDelta = Math.max(this.game.loop.delta, 8);
                    const velX = (dragX - gameObject.x) * (1000 / safeDelta);
                    const velY = (dragY - gameObject.y) * (1000 / safeDelta);
                    gameObject.setVelocity(velX, velY);
                }

                gameObject.x = dragX;
                gameObject.y = dragY;

                // If it's the ball, ensure gravity is disabled while dragging
                if (gameObject === this.ball) {
                    gameObject.body.allowGravity = false;
                }
            }, this);

            this.input.on('dragend', (pointer, gameObject) => {
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

                    // Keep a bit of the drag velocity for a "flick" effect
                    const maxFlick = 800;
                    const finalVelX = Phaser.Math.Clamp(gameObject.body.velocity.x, -maxFlick, maxFlick);
                    const finalVelY = Phaser.Math.Clamp(gameObject.body.velocity.y, -maxFlick, maxFlick);
                    gameObject.setVelocity(finalVelX, finalVelY);

                    // Add rotation based on flick
                    gameObject.setAngularVelocity(finalVelX * 0.75);

                    // Play throw sound if it was a significant flick
                    if (Math.abs(finalVelX) > 200 || Math.abs(finalVelY) > 200) {
                        if (this.throwSound) this.throwSound.play();
                    }
                }

                // If ball was thrown/flicked, reset session counter
                if (gameObject === this.ball && (Math.abs(gameObject.body.velocity.x) > 100 || Math.abs(gameObject.body.velocity.y) > 100)) {
                    this.isBallMoving = true;
                    this.sessionBounces = 0;
                    this.updateCounters();
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
            if (this.throwSound) this.throwSound.play();

            // Set natural rotation based on horizontal velocity
            this.ball.setAngularVelocity(this.ball.body.velocity.x * 0.75);

            this.isBallMoving = true;

            // Reset session counter when ball is thrown
            this.sessionBounces = 0;
            this.updateCounters();

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

            // Add natural rotation based on horizontal velocity after bounce
            ball.setAngularVelocity(ball.body.velocity.x * 0.75);

            // Add rotation to cloud on bounce
            const rotationSpeed = Phaser.Math.Between(-1, 1); // Random rotation speed
            cloud.setAngularVelocity(rotationSpeed * 100); // Degrees per second

            // Increment bounce counter
            this.incrementBounceCounter();
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

            // Add natural rotation based on horizontal velocity after bounce
            ball.setAngularVelocity(ball.body.velocity.x * 0.75);

            // Add rotation to sun on bounce
            const rotationSpeed = Phaser.Math.Between(-0.5, 0.5); // Slower rotation for sun
            sun.setAngularVelocity(rotationSpeed * 50); // Degrees per second

            // Increment bounce counter
            this.incrementBounceCounter();
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

            // Increment bounce counter for cloud-cloud collisions
            this.incrementBounceCounter();
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

            // Increment bounce counter for cloud-sun collisions
            this.incrementBounceCounter();
        }

        handleResizeCollisions(oldWidth, oldHeight, newWidth, newHeight) {
            // Update grass height for new screen size
            this.grassHeight = Math.min(newHeight * 0.2, 150);
            const playAreaHeight = newHeight - this.grassHeight;

            // Update grass and sky to new dimensions
            if (this.grass) {
                this.grass.setSize(newWidth, this.grassHeight);
                this.grass.y = newHeight - this.grassHeight / 2;
            }
            if (this.sky) {
                this.sky.setSize(newWidth, playAreaHeight);
            }

            // Check if objects are now outside the new bounds and make them bounce
            const grassBottom = newHeight - this.grassHeight;

            // Check ball collision with new grass position
            if (this.ball && this.ball.y + this.ball.height / 2 > grassBottom) {
                // Ball is below grass - make it bounce
                this.ball.y = grassBottom - this.ball.height / 2;
                if (this.ball.body) {
                    const bounceVelocityY = -Math.abs(this.ball.body.velocity.y || 200) * 0.7;
                    const bounceVelocityX = (this.ball.body.velocity.x || 0) * 0.9;
                    this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
                }
            }

            // Check clouds collision with new boundaries
            this.clouds.forEach(cloud => {
                // Check bottom collision with grass
                if (cloud.y + cloud.height / 2 > grassBottom) {
                    cloud.y = grassBottom - cloud.height / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = -Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }

                // Check top collision with screen top
                if (cloud.y - cloud.height / 2 < 0) {
                    cloud.y = cloud.height / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }

                // Check side collisions
                if (cloud.x - cloud.width / 2 < 0) {
                    cloud.x = cloud.width / 2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityX = Math.abs(cloud.body.velocity.x) * 0.7;
                        const bounceVelocityY = cloud.body.velocity.y * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (cloud.x + cloud.width / 2 > newWidth) {
                    cloud.x = newWidth - cloud.width / 2;
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
                if (this.sun.y + this.sun.height / 2 > grassBottom) {
                    this.sun.y = grassBottom - this.sun.height / 2;
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

            // Check if ball has stopped moving
            if (this.isBallMoving &&
                Math.abs(this.ball.body.velocity.x) < 5 &&
                Math.abs(this.ball.body.velocity.y) < 5) {
                this.isBallMoving = false;
                this.ball.setVelocity(0, 0);
                this.ball.setAngularVelocity(0);
                this.ball.body.allowGravity = false; // Temporarily disable gravity to prevent floor jitter
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

            if (this.sun.y > this.gameHeight - this.grassHeight - this.sun.displayHeight / 2 + 20) { // +20 for softer collision
                this.sun.y = this.gameHeight - this.grassHeight - this.sun.displayHeight / 2;
                if (this.sun.body.velocity) {
                    this.sun.setVelocity(this.sun.body.velocity.x * 0.9, -Math.abs(this.sun.body.velocity.y) * 0.7); // Softer bounce
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
                            if (this.bounceSound) this.bounceSound.play();
                        }
                        
                        // Bounce the ball with reduced velocity
                        const bounceVelocityY = -Math.abs(this.ball.body.velocity.y) * 0.6;
                        const bounceVelocityX = this.ball.body.velocity.x * 0.9;
                        this.ball.setVelocity(bounceVelocityX, bounceVelocityY);

                        // Add natural rotation from grass bounce
                        this.ball.setAngularVelocity(bounceVelocityX * 0.75);
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
            if (this.isDragging || Date.now() - this.lastDragEndTime < 500) return;
            
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
            this.sessionBounces = 0;
            this.updateCounters();
            // Set timeout to show arrow after 200ms
            this.arrowShowTimeout = setTimeout(() => {
                if (this.isAiming) {
                    this.directionIndicator.visible = true;
                }
            }, 200);
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

            // Play throw sound
            if (this.throwSound) this.throwSound.play();

            // Set natural rotation based on horizontal velocity
            this.ball.setAngularVelocity(velX * 0.75);

            this.isBallMoving = true;

            // Update counters (session counter was already reset when arrow appeared)
            this.updateCounters();

            // Removed the code that set objects to 'immovable' here.
            // Objects now slow down naturally via damping, which prevents accidental 'freezing'.
        }

        updateCounters() {
            // Update the counter displays if elements exist
            const totalElement = document.getElementById('total-count');
            const sessionElement = document.getElementById('session-count');

            if (totalElement) {
                totalElement.textContent = this.totalBounces;
            }
            if (sessionElement) {
                sessionElement.textContent = this.sessionBounces;
            }
        }

        incrementBounceCounter() {
            this.totalBounces++;
            this.sessionBounces++;
            this.updateCounters();

            // Play bounce sound
            if (this.bounceSound) {
                this.bounceSound.play();
            }
        }

        resetGame() {
            // Reset ball position and velocity
            this.ball.setPosition(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50);
            this.ball.setVelocity(0, 0);
            this.ball.setAngularVelocity(0);
            this.ball.setAngle(0);

            // Reset sun position and velocity (always top-left corner)
            this.sun.setPosition(120, 120);
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

            // Reset both counters
            this.totalBounces = 0;
            this.sessionBounces = 0;
            this.updateCounters();
        }

        toggleMute() {
            // Toggle the master mute setting in Phaser
            this.sound.mute = !this.sound.mute;

            // Toggle the 'muted' class on the button itself
            const muteButton = document.getElementById('mute-button');
            if (muteButton) {
                muteButton.classList.toggle('muted', this.sound.mute);
            }
            return this.sound.mute;
        }
    }

    // Make game take up full screen with proper vertical resizing
    const getGameSize = () => {
        // Take full screen dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Use full screen without aspect ratio constraints
        return { width: width, height: height };
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
            roundPixels: true
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
        const newSize = getGameSize();

        // Directly resize the game canvas to fill screen
        if (game.scale) {
            game.scale.resize(newSize.width, newSize.height);
        }

        // Force canvas to stretch to fill container
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'fill';
        }

        // Update the game scene's dimensions
        if (game.scene.scenes.length > 0) {
            const scene = game.scene.scenes[0];
            if (scene.gameWidth && scene.gameHeight) {
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