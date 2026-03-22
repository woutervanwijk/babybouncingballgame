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
        }
        
        preload() {
            // Create three different cloud textures
            this.load.image('cloud', this.createCloudTexture());
            this.load.image('cloud2', this.createCloudTexture2());
            this.load.image('cloud3', this.createCloudTexture3());
            this.load.image('sun', this.createSunTexture());
            this.load.image('ball', this.createBallTexture());
        }
        
        createBallTexture() {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xFF6347); // Tomato red
            graphics.fillCircle(50, 50, 50);
            graphics.generateTexture('ball', 100, 100);
            graphics.destroy();
            return 'ball';
        }
        
        createCloudTexture() {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xFFFFFF);
            
            // Create a more realistic cloud shape with multiple circles
            // Main body
            graphics.fillCircle(75, 50, 40);
            // Left puff
            graphics.fillCircle(40, 40, 35);
            // Right puff
            graphics.fillCircle(100, 35, 30);
            // Top puff
            graphics.fillCircle(60, 20, 25);
            // Bottom puff
            graphics.fillCircle(90, 65, 28);
            
            graphics.generateTexture('cloud', 150, 100);
            graphics.destroy();
            return 'cloud';
        }
        
        createCloudTexture2() {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xFFFFFF);
            
            // Different cloud design - more spread out
            graphics.fillCircle(75, 50, 35);
            graphics.fillCircle(30, 30, 40);
            graphics.fillCircle(110, 40, 30);
            graphics.fillCircle(50, 20, 20);
            graphics.fillCircle(80, 70, 25);
            
            graphics.generateTexture('cloud2', 150, 100);
            graphics.destroy();
            return 'cloud2';
        }
        
        createCloudTexture3() {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xFFFFFF);
            
            // Third cloud design - taller and narrower
            graphics.fillCircle(75, 40, 30);
            graphics.fillCircle(75, 60, 35);
            graphics.fillCircle(45, 35, 25);
            graphics.fillCircle(105, 50, 28);
            graphics.fillCircle(60, 25, 20);
            
            graphics.generateTexture('cloud3', 150, 100);
            graphics.destroy();
            return 'cloud3';
        }
        
        createSunTexture() {
            const graphics = this.make.graphics();
            graphics.fillStyle(0xFFD700); // Gold
            graphics.fillCircle(40, 40, 40);
            
            // Add sun beams - thicker and more visible
            graphics.lineStyle(8, 0xFFD700);
            graphics.beginPath();
            graphics.moveTo(40, 40);
            graphics.lineTo(70, 40); // Right beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(10, 40); // Left beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(40, 70); // Bottom beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(40, 10); // Top beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(55, 25); // Top-right beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(25, 25); // Top-left beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(55, 55); // Bottom-right beam (shorter)
            graphics.moveTo(40, 40);
            graphics.lineTo(25, 55); // Bottom-left beam (shorter)
            graphics.closePath();
            graphics.strokePath();
            
            graphics.generateTexture('sun', 80, 80);
            graphics.destroy();
            return 'sun';
        }
        
        create() {
            // Set up physics - only ball has gravity
            this.physics.world.gravity.y = 300;
            
            // Store game dimensions
            this.gameWidth = this.game.config.width;
            this.gameHeight = this.game.config.height;
            
            // Create grass boundary (adaptive height based on screen size)
            this.grassHeight = Math.min(this.gameHeight * 0.2, 150); // Max 150px grass
            this.grass = this.add.rectangle(0, this.gameHeight - this.grassHeight/2, 
                this.gameWidth, this.grassHeight, 0x7CFC00)
                .setOrigin(0, 0.5);
            
            // Create sky background (fill remaining space)
            this.sky = this.add.rectangle(0, 0, this.gameWidth, this.gameHeight - this.grassHeight, 0x87CEEB)
                .setOrigin(0, 0);
            
            // Create ball (only object with gravity) - position above grass
            this.ball = this.physics.add.sprite(this.gameWidth/2, this.gameHeight - this.grassHeight - 50, 'ball');
            this.ball.setBounce(0.6);
            this.ball.setCollideWorldBounds(true);
            // Create sun (NO GRAVITY - only moves when hit)
            const playAreaHeight = this.gameHeight - this.grassHeight;
            this.sun = this.physics.add.sprite(
                Phaser.Math.Between(50, this.gameWidth - 50),
                Phaser.Math.Between(50, playAreaHeight * 0.2),
                'sun'
            );
            this.sun.setBounce(1.0);
            this.sun.setCollideWorldBounds(true);
            this.sun.setImmovable(true);
            this.sun.setVelocity(0, 0);
            
            // Remove gravity from sun
            this.sun.body.allowGravity = false;
            this.sun.body.setCircle(32); // 80% of real size (40) for soft collision
            
            // Create clouds (NO GRAVITY - only move when hit)
            const cloudTextures = ["cloud", "cloud2", "cloud3"];
            const cloudCount = this.screenMode === "largeScreen" ? 6 : (this.screenMode === "mediumScreen" ? 4 : 3);
            this.clouds = [];
            for (let i = 0; i < cloudCount; i++) {
                const texture = cloudTextures[i % cloudTextures.length];
                const cloud = this.physics.add.sprite(
                    Phaser.Math.Between(50, this.gameWidth - 50),
                    Phaser.Math.Between(50, playAreaHeight * 0.7),
                    texture
                );
                cloud.setBounce(1.0);
                cloud.setCollideWorldBounds(true);
                cloud.setImmovable(true);
                cloud.setVelocity(0, 0);
                cloud.body.allowGravity = false;
                cloud.body.setCircle(50);
                this.clouds.push(cloud);
            }
            
            // Set up collisions
            this.physics.add.collider(this.ball, this.clouds, this.handleBallCloudCollision, null, this);
            this.physics.add.collider(this.ball, this.sun, this.handleBallSunCollision, null, this);
            this.physics.add.collider(this.clouds, this.clouds, this.handleCloudCloudCollision, null, this);
            this.physics.add.collider(this.clouds, this.sun, this.handleCloudSunCollision, null, this);
            
            // Set up input - only spacebar throws the ball
            this.input.keyboard.on('keydown', (event) => {
                if (event.key === ' ' || event.code === 'Space') {
                    this.throwBall();
                }
            }, this);
            this.input.on('pointerdown', this.throwBall, this);
            
            // Add touch support for mobile
            this.input.on('touchstart', this.throwBall, this);
            
            // Game state
            this.isBallMoving = false;
            
            // Initialize counters
            this.updateCounters();
            
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
            
            // Set cloud velocity based on ball velocity and angle - 1.5x speed
            const ballVelocity = ball.body.velocity;
            const speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
            
            // Softer collision with 25% energy loss (-25% speed)
            cloud.setVelocity(
                Math.cos(angle) * speed * 1.2 * 0.75, // 25% reduction
                Math.sin(angle) * speed * 1.2 * 0.75   // 25% reduction
            );
            
            // Also reduce ball's speed by 25% for more realistic physics
            this.ball.setVelocity(
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
            this.sun.setImmovable(false);
            
            // Calculate bounce angle
            const angle = Phaser.Math.Angle.Between(ball.x, ball.y, sun.x, sun.y);
            
            // Set sun velocity based on ball velocity and angle (half speed of clouds)
            const ballVelocity = ball.body.velocity;
            const speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
            
            // Softer collision with 25% energy loss (-25% speed)
            this.sun.setVelocity(
                Math.cos(angle) * speed * 0.6 * 0.75, // 25% reduction
                Math.sin(angle) * speed * 0.6 * 0.75   // 25% reduction
            );
            
            // Also reduce ball's speed by 25% for more realistic physics
            this.ball.setVelocity(
                ballVelocity.x * 0.75,
                ballVelocity.y * 0.75
            );
            
            // Add rotation to sun on bounce
            const rotationSpeed = Phaser.Math.Between(-0.5, 0.5); // Slower rotation for sun
            this.sun.setAngularVelocity(rotationSpeed * 50); // Degrees per second
            
            // Increment bounce counter
            this.incrementBounceCounter();
        }
        
        // Add soft collision handling for cloud-cloud and cloud-sun collisions
        handleCloudCloudCollision(cloud1, cloud2) {
            // Calculate overlap and apply softer bounce
            const angle = Phaser.Math.Angle.Between(cloud1.x, cloud1.y, cloud2.x, cloud2.y);
            
            // Get velocities
            const vel1 = cloud1.body.velocity;
            const vel2 = cloud2.body.velocity;
            
            // Calculate relative velocity
            const relVelX = vel1.x - vel2.x;
            const relVelY = vel1.y - vel2.y;
            
            // Softer collision response with 25% energy loss (-25% speed)
            const speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
            
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
            
            // Get velocities
            const cloudVel = cloud.body.velocity;
            const sunVel = sun.body.velocity;
            
            // Calculate relative velocity
            const relVelX = cloudVel.x - sunVel.x;
            const relVelY = cloudVel.y - sunVel.y;
            
            // Softer collision response with 10% energy loss
            const speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
            
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
                this.grass.y = newHeight - this.grassHeight/2;
            }
            if (this.sky) {
                this.sky.setSize(newWidth, playAreaHeight);
            }
            
            // Check if objects are now outside the new bounds and make them bounce
            const grassBottom = newHeight - this.grassHeight;
            
            // Check ball collision with new grass position
            if (this.ball && this.ball.y + this.ball.height/2 > grassBottom) {
                // Ball is below grass - make it bounce
                this.ball.y = grassBottom - this.ball.height/2;
                if (this.ball.body) {
                    const bounceVelocityY = -Math.abs(this.ball.body.velocity.y || 200) * 0.7;
                    const bounceVelocityX = (this.ball.body.velocity.x || 0) * 0.9;
                    this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
                }
            }
            
            // Check clouds collision with new boundaries
            this.clouds.forEach(cloud => {
                // Check bottom collision with grass
                if (cloud.y + cloud.height/2 > grassBottom) {
                    cloud.y = grassBottom - cloud.height/2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = -Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }
                
                // Check top collision with screen top
                if (cloud.y - cloud.height/2 < 0) {
                    cloud.y = cloud.height/2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityY = Math.abs(cloud.body.velocity.y) * 0.7;
                        const bounceVelocityX = cloud.body.velocity.x * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add some rotation on bounce
                        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                    }
                }
                
                // Check side collisions
                if (cloud.x - cloud.width/2 < 0) {
                    cloud.x = cloud.width/2;
                    if (cloud.body && cloud.body.velocity) {
                        const bounceVelocityX = Math.abs(cloud.body.velocity.x) * 0.7;
                        const bounceVelocityY = cloud.body.velocity.y * 0.9;
                        cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (cloud.x + cloud.width/2 > newWidth) {
                    cloud.x = newWidth - cloud.width/2;
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
                if (this.sun.y + this.sun.height/2 > grassBottom) {
                    this.sun.y = grassBottom - this.sun.height/2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityY = -Math.abs(this.sun.body.velocity.y) * 0.7;
                        const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add gentle rotation on bounce
                        this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                    }
                }
                
                // Check top collision with screen top
                if (this.sun.y - this.sun.height/2 < 0) {
                    this.sun.y = this.sun.height/2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityY = Math.abs(this.sun.body.velocity.y) * 0.7;
                        const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                        // Add gentle rotation on bounce
                        this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                    }
                }
                
                // Check side collisions
                if (this.sun.x - this.sun.width/2 < 0) {
                    this.sun.x = this.sun.width/2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityX = Math.abs(this.sun.body.velocity.x) * 0.7;
                        const bounceVelocityY = this.sun.body.velocity.y * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                } else if (this.sun.x + this.sun.width/2 > newWidth) {
                    this.sun.x = newWidth - this.sun.width/2;
                    if (this.sun.body && this.sun.body.velocity) {
                        const bounceVelocityX = -Math.abs(this.sun.body.velocity.x) * 0.7;
                        const bounceVelocityY = this.sun.body.velocity.y * 0.9;
                        this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    }
                }
            }
        }
        
        update() {
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
                    
                    // Apply minimal damping when clouds are moving slowly
                    if (Math.abs(velX) < 50 && Math.abs(velY) < 50) {
                        cloud.setVelocity(velX * 0.99375, velY * 0.99375); // 0.625% damping (half of 1.25%)
                    } else {
                        cloud.setVelocity(velX * 0.9984375, velY * 0.9984375); // 0.15625% damping (half of 0.3125%)
                    }
                    
                    // Dampen rotation as well
                    if (cloud.body.angularVelocity !== 0) {
                        cloud.setAngularVelocity(cloud.body.angularVelocity * 0.9971875); // 0.28125% rotation damping (half of 0.5625%)
                    }
                }
                
                if (cloud.y > this.gameHeight - this.grassHeight - cloud.height/2 + 20) { // +20 for softer collision
                    cloud.y = this.gameHeight - this.grassHeight - cloud.height/2;
                    if (cloud.body.velocity) {
                        cloud.setVelocity(cloud.body.velocity.x * 0.9, -Math.abs(cloud.body.velocity.y) * 0.7); // Softer bounce
                    }
                }
            });
            
            // Apply tiny damping to sun to make it slow down gradually
            if (this.sun && this.sun.body && this.sun.body.velocity) {
                const velX = this.sun.body.velocity.x;
                const velY = this.sun.body.velocity.y;
                
                // Apply very subtle damping to sun movement
                if (Math.abs(velX) < 50 && Math.abs(velY) < 50) {
                    this.sun.setVelocity(velX * 0.994375, velY * 0.994375); // 0.5625% damping (25% of 0.75%)
                } else {
                    this.sun.setVelocity(velX * 0.9971875, velY * 0.9971875); // 0.28125% damping (25% of 0.375%)
                }
                
                // Dampen sun rotation as well (25% of previous damping)
                if (this.sun.body.angularVelocity !== 0) {
                    this.sun.setAngularVelocity(this.sun.body.angularVelocity * 0.994375); // 0.5625% rotation damping (25% of 0.75%)
                }
            }
            
            if (this.sun.y > this.gameHeight - this.grassHeight - this.sun.height/2 + 20) { // +20 for softer collision
                this.sun.y = this.gameHeight - this.grassHeight - this.sun.height/2;
                if (this.sun.body.velocity) {
                    this.sun.setVelocity(this.sun.body.velocity.x * 0.9, -Math.abs(this.sun.body.velocity.y) * 0.7); // Softer bounce
                }
            }
            
            // Limit ball bounce to half of grass height
            const maxBounceHeight = this.gameHeight - this.grassHeight/2;
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
            this.ball.setPosition(this.gameWidth/2, this.gameHeight - this.grassHeight - 50);
            this.ball.setVelocity(0, 0);
            this.ball.setAngularVelocity(0);
            
            // Reset sun position and velocity
            const playAreaHeight = this.gameHeight - this.grassHeight;
            this.sun.setPosition(
                Phaser.Math.Between(50, this.gameWidth - 50),
                Phaser.Math.Between(50, playAreaHeight * 0.2)
            );
            this.sun.setVelocity(0, 0);
            this.sun.setAngularVelocity(0);
            this.sun.setImmovable(true);
            
            // Reset clouds positions and velocities
            this.clouds.forEach(cloud => {
                cloud.setPosition(
                    Phaser.Math.Between(50, this.gameWidth - 50),
                    Phaser.Math.Between(50, playAreaHeight * 0.7)
                );
                cloud.setVelocity(0, 0);
                cloud.setAngularVelocity(0);
                cloud.setImmovable(true);
            });
            
            // Reset game state
            this.isBallMoving = false;
            
            // Reset session counter
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
        scale: {
            mode: Phaser.Scale.NONE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container',
            expandParent: true
        }
    };
    
    const game = new Phaser.Game(config);
    
    // Set initial canvas styling to stretch to fill screen
    setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'fill';
            canvas.style.display = 'block';
        }
    }, 100);
    
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