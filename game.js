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
        }

        preload() {
            // Load SVG assets from the svg directory
            // Load SVG assets with higher resolution for Retina displays
            // We load them at 2x the display size to ensure they're sharp
            this.load.svg('cloud', 'svg/cloud.svg', { width: 450, height: 450 });
            this.load.svg('sun', 'svg/sun.svg', { width: 240, height: 240 });
            this.load.svg('ball', 'svg/ball.svg', { width: 200, height: 200 });
        }


        create() {
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
            this.ball.setDisplaySize(100, 100);
            this.ball.setBounce(0.6);
            this.ball.setCollideWorldBounds(true);
            this.ball.body.setCircle(this.ball.width / 2);
            // Create sun (NO GRAVITY - only moves when hit)
            const playAreaHeight = this.gameHeight - this.grassHeight;
            this.sun = this.physics.add.sprite(60, 60, 'sun');
            this.sun.setDisplaySize(120, 120);
            this.sun.setBounce(1.0);
            this.sun.setCollideWorldBounds(true);
            this.sun.setImmovable(true);
            this.sun.setVelocity(0, 0);

            // Remove gravity from sun
            this.sun.body.allowGravity = false;
            this.sun.body.setCircle(this.sun.width * 0.25); // Smaller hitbox

            // Determine screen mode based on width
            if (this.gameWidth >= 1200) {
                this.screenMode = "largeScreen";
            } else if (this.gameWidth >= 800) {
                this.screenMode = "mediumScreen";
            } else {
                this.screenMode = "smallScreen";
            }

            // Create clouds (NO GRAVITY - only move when hit)
            const cloudTextures = ["cloud"];
            const cloudCount = this.screenMode === "largeScreen" ? 6 : (this.screenMode === "mediumScreen" ? 4 : 3);
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
                cloud.setVelocity(0, 0);
                cloud.body.allowGravity = false;
                cloud.body.setCircle(cloud.width * 0.2); // Balanced middle ground size
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
                    this.throwBallInDirection();
                }
            }, this);

            // Pointer/touch input for centrifuge aiming
            this.input.on('pointerdown', (pointer) => {
                this.startCentrifugeAiming();
            }, this);

            this.input.on('pointerup', (pointer) => {
                if (this.isAiming) {
                    this.throwBallInDirection();
                }
            }, this);

            // Game state
            this.isBallMoving = false;

            // Initialize counters
            this.updateCounters();

            // Create direction indicator (hidden initially)
            this.directionIndicator = this.add.graphics();
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

            // Randomly choose left or right direction
            if (Phaser.Math.FloatBetween(0, 1) > 0.5) {
                this.ball.setVelocity(-velX, velY);
            } else {
                this.ball.setVelocity(velX, velY);
            }

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
            const nudgeOffset = 15;
            ball.x -= Math.cos(angle) * nudgeOffset;
            ball.y -= Math.sin(angle) * nudgeOffset;
            cloud.x += Math.cos(angle) * nudgeOffset;
            cloud.y += Math.sin(angle) * nudgeOffset;

            // Set cloud velocity based on ball velocity and angle - 1.5x speed
            const ballVelocity = ball.body.velocity;
            let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 300);

            // Softer collision with 25% energy loss (-25% speed)
            cloud.setVelocity(
                Math.cos(angle) * speed * 1.2 * 0.75, // 25% reduction
                Math.sin(angle) * speed * 1.2 * 0.75   // 25% reduction
            );

            // Also reduce ball's speed by 25% for more realistic physics
            ball.setVelocity(
                ballVelocity.x * 0.75,
                ballVelocity.y * 0.75
            );

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
            const nudgeOffset = 15;
            ball.x -= Math.cos(angle) * nudgeOffset;
            ball.y -= Math.sin(angle) * nudgeOffset;
            sun.x += Math.cos(angle) * nudgeOffset;
            sun.y += Math.sin(angle) * nudgeOffset;

            // Set sun velocity based on ball velocity and angle (half speed of clouds)
            const ballVelocity = ball.body.velocity;
            let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);

            // Ensure a minimum "profound" bounce speed
            speed = Math.max(speed, 250);

            // Softer collision with 25% energy loss (-25% speed)
            sun.setVelocity(
                Math.cos(angle) * speed * 0.6 * 0.75, // 25% reduction
                Math.sin(angle) * speed * 0.6 * 0.75   // 25% reduction
            );

            // Also reduce ball's speed by 25% for more realistic physics
            ball.setVelocity(
                ballVelocity.x * 0.75,
                ballVelocity.y * 0.75
            );

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
            const nudgeOffset = 10;
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
            const bounceX = Math.cos(angle) * speed * 0.6 * 0.75; // 25% reduction
            const bounceY = Math.sin(angle) * speed * 0.6 * 0.75; // 25% reduction

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
            const bounceX = Math.cos(angle) * speed * 0.5 * 0.75; // 25% reduction
            const bounceY = Math.sin(angle) * speed * 0.5 * 0.75; // 25% reduction

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
                if (this.sun.y - this.sun.height / 2 < 0) {
                    this.sun.y = this.sun.height / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityY = Math.abs(this.sun.body.velocity.y) * 0.7;
                        const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add gentle rotation on bounce
                        this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                    }
                }

                // Check side collisions
                if (this.sun.x - this.sun.width / 2 < 0) {
                    this.sun.x = this.sun.width / 2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityX = Math.abs(this.sun.body.velocity.x) * 0.7;
                        const bounceVelocityY = this.sun.body.velocity.y * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (this.sun.x + this.sun.width / 2 > newWidth) {
                    this.sun.x = newWidth - this.sun.width / 2;
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

                if (cloud.y > this.gameHeight - this.grassHeight - cloud.height / 2 + 20) { // +20 for softer collision
                    cloud.y = this.gameHeight - this.grassHeight - cloud.height / 2;
                    if (cloud.body.velocity) {
                        cloud.setVelocity(cloud.body.velocity.x * 0.9, -Math.abs(cloud.body.velocity.y) * 0.7); // Softer bounce
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

            if (this.sun.y > this.gameHeight - this.grassHeight - this.sun.height / 2 + 20) { // +20 for softer collision
                this.sun.y = this.gameHeight - this.grassHeight - this.sun.height / 2;
                if (this.sun.body.velocity) {
                    this.sun.setVelocity(this.sun.body.velocity.x * 0.9, -Math.abs(this.sun.body.velocity.y) * 0.7); // Softer bounce
                }
            }

            // Limit ball bounce to half of grass height
            const maxBounceHeight = this.gameHeight - this.grassHeight / 2;
            if (this.ball.y > maxBounceHeight) {
                this.ball.y = maxBounceHeight;
                if (this.ball.body.velocity) {
                    // Bounce the ball with reduced velocity
                    const bounceVelocityY = -Math.abs(this.ball.body.velocity.y) * 0.6;
                    const bounceVelocityX = this.ball.body.velocity.x * 0.9;
                    this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
                }
            }
            // Remove manual border collision handling - let Phaser handle it naturally
            // The ball's collideWorldBounds property will handle border collisions properly

            // Check if ball is stuck (very slow movement) and give it a nudge
            if (this.isBallMoving &&
                Math.abs(this.ball.body.velocity.x) < 1 &&
                Math.abs(this.ball.body.velocity.y) < 1 &&
                this.ball.body.velocity.x !== 0 &&
                this.ball.body.velocity.y !== 0) {
                // Ball is moving very slowly - give it a small random nudge
                this.ball.setVelocity(
                    this.ball.body.velocity.x + Phaser.Math.Between(-5, 5),
                    this.ball.body.velocity.y + Phaser.Math.Between(-5, 5)
                );
            }
        }

        startCentrifugeAiming() {
            this.isAiming = true;
            this.directionIndicator.visible = false; // Start hidden
            this.keyDownTime = Date.now();
            // Start with a random angle (different each time)
            this.aimAngle = Math.random() * Math.PI * 2; // 0 to 2π radians
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

            this.directionIndicator.clear();

            // Calculate arrow length based on how long the button has been pressed (smooth transition)
            const pressDuration = Date.now() - this.keyDownTime;

            // Smooth arrow length calculation: starts at 100, decreases to 40 over 7.5 seconds (3x slower)
            // Minimum length is 40 to ensure the ball still throws a bit
            const maxLength = 100;
            const minLength = 40;
            const durationForFullShrink = 7500; // 7.5 seconds to reach minimum length (3x slower)

            // Calculate normalized duration (0 to 1)
            const normalizedDuration = Math.min(pressDuration, durationForFullShrink) / durationForFullShrink;

            // Smooth interpolation using ease-out for more natural feel
            const easeOutDuration = 1 - Math.pow(1 - normalizedDuration, 1.5); // Gentler easing

            // Calculate arrow length
            const arrowLength = maxLength - (maxLength - minLength) * easeOutDuration;

            // Draw arrow indicator
            this.directionIndicator.lineStyle(4, 0xFFFFFF, 1.0);
            this.directionIndicator.beginPath();

            // Arrow line from ball center to end
            const endX = this.ball.x + Math.cos(this.aimAngle) * arrowLength;
            const endY = this.ball.y + Math.sin(this.aimAngle) * arrowLength;

            this.directionIndicator.moveTo(this.ball.x, this.ball.y);
            this.directionIndicator.lineTo(endX, endY);

            // Arrowhead (size proportional to arrow length)
            const arrowHeadSize = arrowLength * 0.15;
            const arrowHeadAngle = Math.PI / 6; // 30 degrees

            this.directionIndicator.lineTo(
                endX - Math.cos(this.aimAngle - arrowHeadAngle) * arrowHeadSize,
                endY - Math.sin(this.aimAngle - arrowHeadAngle) * arrowHeadSize
            );

            this.directionIndicator.moveTo(endX, endY);
            this.directionIndicator.lineTo(
                endX - Math.cos(this.aimAngle + arrowHeadAngle) * arrowHeadSize,
                endY - Math.sin(this.aimAngle + arrowHeadAngle) * arrowHeadSize
            );

            this.directionIndicator.strokePath();
            this.directionIndicator.closePath();
        }

        throwBallInDirection() {
            if (!this.isAiming) return;

            this.isAiming = false;

            // Clear the arrow show timeout if it exists
            if (this.arrowShowTimeout) {
                clearTimeout(this.arrowShowTimeout);
                this.arrowShowTimeout = null;
            }

            this.directionIndicator.visible = false;

            // Calculate press duration
            const pressDuration = Date.now() - this.keyDownTime;

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
            this.isBallMoving = true;

            // Update counters (session counter was already reset when arrow appeared)
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
        }

        resetGame() {
            // Reset ball position and velocity
            this.ball.setPosition(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50);
            this.ball.setVelocity(0, 0);
            this.ball.setAngularVelocity(0);
            this.ball.setAngle(0);

            // Reset sun position and velocity (always top-left corner)
            this.sun.setPosition(60, 60);
            this.sun.setVelocity(0, 0);
            this.sun.setAngularVelocity(0);
            this.sun.setAngle(0);
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
                cloud.setAngle(0);
                cloud.setImmovable(true);
                placedClouds.push({ x: cloudX, y: cloudY });
            });

            // Reset game state
            this.isBallMoving = false;

            // Reset both counters
            this.totalBounces = 0;
            this.sessionBounces = 0;
            this.updateCounters();
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
                debug: false
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
}