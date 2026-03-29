// Main Game Scene Class
class BabyBallGame extends Phaser.Scene {
    constructor() {
        super({ key: 'BabyBallGame' });
        this.gameWidth = 800;
        this.gameHeight = 600;
        this.grassHeight = 0;
        this.totalPoints = 0;
        this.sessionPoints = 0;
        this.ballBounces = 0;
        this.sunBounces = 0;
        this.cloudBounces = 0;
        this.ballStreak = 0;
        this.sunStreak = 0;
        this.cloudStreak = 0;
        this.isAiming = false;
        this.directionIndicator = null;
        this.aimAngle = 0;
        this.keyDownTime = 0;
        this.rotationSpeed = 0.05;
        this.rotationDirection = 1;
        this.arrowShowTimeout = null;
        this.isDragging = false;
        this.lastDragEndTime = 0;
        this.counterUpdatesEnabled = true;
        this.debugEnabled = false;
        this.debugHitAreas = false;
        this.debugObjectSizes = false;
        this.debugPhysics = false;
        this.debugGrassArea = false;
    }

    preload() {
        this.load.svg('cloud', 'svg/cloud.svg', { width: 250, height: 250 });
        this.load.svg('sun', 'svg/sun.svg', { width: 240, height: 240 });
        this.load.svg('ball', 'svg/ball.svg', { width: 200, height: 200 });
        this.load.audio('throw', 'assets/audio/throw.mp3');
        this.load.audio('ballSound', 'assets/audio/ball.mp3');
        this.load.audio('sunSound', 'assets/audio/sun.mp3');
        this.load.audio('cloudSound', 'assets/audio/cloud.mp3');
    }

    create() {
        this.throwSound = null;
        this.ballSound = null;
        this.sunSound = null;
        this.cloudSound = null;
        this.audioContextUnlocked = false;

        this.throwSound = this.sound.add('throw', { volume: 0.25 });
        this.ballSound = this.sound.add('ballSound', { volume: 0.2 });
        this.sunSound = this.sound.add('sunSound', { volume: 0.25 });
        this.cloudSound = this.sound.add('cloudSound', { volume: 0.25 });

        const initializeSounds = () => {
            if (this.audioContextUnlocked) return;
            this.audioContextUnlocked = true;
            const muteButton = document.getElementById('mute-button');
            const isUIAlreadyUnmuted = muteButton ? !muteButton.classList.contains('muted') : !this.initialMuteState;
            this.sound.mute = !isUIAlreadyUnmuted;

            if (this.isSafari()) {
                try {
                    const unlockSound = new Audio();
                    unlockSound.src = 'assets/audio/throw.mp3';
                    unlockSound.volume = 0.01;
                    unlockSound.play().then(() => {
                        setTimeout(() => unlockSound.pause(), 10);
                    }).catch(() => {});
                } catch (e) {}
            }

            if (this.sound && typeof this.sound.unlock === 'function') {
                this.sound.unlock();
            }
        };

        setTimeout(() => {
            const muteButton = document.getElementById('mute-button');
            if (muteButton) {
                if (this.initialMuteState) {
                    muteButton.classList.add('muted');
                } else {
                    muteButton.classList.remove('muted');
                }
                setTimeout(() => {
                    if (muteButton.classList.contains('muted') !== this.initialMuteState) {
                        if (this.initialMuteState) {
                            muteButton.classList.add('muted');
                        } else {
                            muteButton.classList.remove('muted');
                        }
                    }
                }, 50);
            }
        }, 100);

        const handleFirstInteraction = () => {
            if (this.sound.context && typeof this.sound.context.resume === 'function') {
                this.sound.context.resume();
            }
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

        this.sound.pauseOnBlur = false;
        this.initialMuteState = false;
        try {
            const storedValue = localStorage.getItem('babyBallGameMuted');
            if (storedValue === 'true' || storedValue === 'false') {
                this.initialMuteState = (storedValue === 'true');
            }
        } catch (e) {
            console.warn('LocalStorage access failed, defaulting to unmuted');
            this.initialMuteState = false;
        }

        setTimeout(() => {
            const muteButton = document.getElementById('mute-button');
            if (muteButton) {
                if (this.initialMuteState) {
                    muteButton.classList.add('muted');
                } else {
                    muteButton.classList.remove('muted');
                }
            }
        }, 50);

        this.physics.world.gravity.y = 300;
        this.gameWidth = this.game.config.width;
        this.gameHeight = this.game.config.height;
        this.grassHeight = Math.min(this.gameHeight * 0.2, 150);
        const grassWidth = this.gameWidth + 2000;
        this.grass = this.add.rectangle(-1000, this.gameHeight - this.grassHeight / 2 + 250,
            grassWidth, this.grassHeight + 500, 0x7CFC00)
            .setOrigin(0, 0.5)
            .setDepth(0);

        const overdraw = 1000;
        this.sky = this.add.rectangle(-overdraw, -overdraw, this.gameWidth + overdraw * 2, this.gameHeight + overdraw * 2, 0x87CEEB)
            .setOrigin(0, 0)
            .setDepth(-10);

        this.ball = this.physics.add.sprite(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50, 'ball');
        this.ball.setDisplaySize(72, 72);
        this.ball.setBounce(0.6);
        this.ball.setCollideWorldBounds(true);
        this.ball.body.onWorldBounds = true;
        this.ball.setAngularDrag(150);
        this.ball.setDepth(50);
        this.ball.body.setCircle(this.ball.width / 2);
        this.ball.body.onWorldBounds = true;

        this.physics.world.on('worldbounds', (body) => {
            if (body && body.gameObject) {
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
        const sunRadius = this.sun.width * 0.25;
        this.sun.body.setCircle(sunRadius, this.sun.width * 0.25, this.sun.width * 0.25);
        this.sun.body.allowGravity = false;
        this.sun.body.onWorldBounds = true;
        this.sun.setDepth(10);

        this.counterUpdatesEnabled = false;
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
                for (const existingCloud of this.clouds) {
                    const dist = Phaser.Math.Distance.Between(cloudX, cloudY, existingCloud.x, existingCloud.y);
                    if (dist < 250) {
                        overlaps = true;
                        break;
                    }
                }
                if (this.sun) {
                    const distToSun = Phaser.Math.Distance.Between(cloudX, cloudY, this.sun.x, this.sun.y);
                    if (distToSun < 200) {
                        overlaps = true;
                    }
                }
                attempts++;
            } while (overlaps && attempts < 100);

            const cloud = this.physics.add.sprite(cloudX, cloudY, texture);
            const baseSize = 124;
            const sizeVariation = Phaser.Math.Between(-30, 30);
            const cloudSize = baseSize + Math.round(baseSize * sizeVariation / 100);
            cloud.setDisplaySize(cloudSize, cloudSize);
            cloud.setBounce(1.0);
            cloud.setCollideWorldBounds(true);
            cloud.setImmovable(true);
            cloud.body.allowGravity = false;
            cloud.body.onWorldBounds = true;
            const cloudRadius = cloud.width * 0.25;
            cloud.body.setCircle(cloudRadius, cloud.width * 0.25, cloud.width * 0.25);
            cloud.setFlipX(Math.random() < 0.5);
            cloud.setAngle(Phaser.Math.Between(-5, 5));
            cloud.setDepth(20);
            this.clouds.push(cloud);
        }

        this.physics.add.collider(this.ball, this.clouds, this.handleBallCloudCollision, null, this);
        this.physics.add.collider(this.ball, this.sun, this.handleBallSunCollision, null, this);
        this.physics.add.collider(this.clouds, this.clouds, this.handleCloudCloudCollision, null, this);

        this.input.keyboard.on('keydown', (event) => {
            if (!event.repeat && event.key.length === 1) {
                this.startCentrifugeAiming();
            }
        }, this);

        this.input.keyboard.on('keyup', (event) => {
            if (event.key.length === 1) {
                this.throwBallInDirection(true);
            }
            if (event.key === 'd' || event.key === 'D') {
                const debugState = this.toggleDebug();
                console.log('Debug mode: ' + (debugState ? 'ON' : 'OFF'));
            }
        }, this);

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
            cloud.setInteractive({
                hitArea: new Phaser.Geom.Circle(cloud.width / 2, cloud.height / 2, cloud.width / 4),
                hitAreaCallback: Phaser.Geom.Circle.Contains,
                draggable: true,
                useHandCursor: true
            });
        });

        this.input.on('pointerdown', (pointer, currentlyOver) => {
            const manualHitTest = this.input.hitTestPointer(pointer);
            if (currentlyOver.length > 0 || manualHitTest.length > 0) return;
            if (this.isDragging || Date.now() - this.lastDragEndTime < 250) return;
            const objects = [this.ball, this.sun, ...this.clouds];
            const interactionBuffer = 40;
            const isNearRelevantObject = objects.some(obj => {
                if (!obj || !obj.active) return false;
                return Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, obj.x, obj.y) < interactionBuffer;
            });
            if (isNearRelevantObject) return;
            this.startCentrifugeAiming();
        }, this);

        this.input.on('pointerup', (pointer) => {
            if (this.isAiming && !this.isDragging && Date.now() - this.lastDragEndTime > 200) {
                this.throwBallInDirection(false);
            } else if (this.isAiming) {
                this.isAiming = false;
                this.directionIndicator.visible = false;
                if (this.arrowShowTimeout) {
                    clearTimeout(this.arrowShowTimeout);
                    this.arrowShowTimeout = null;
                }
            }
        }, this);

        this.input.on('dragstart', (pointer, gameObject) => {
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
            gameObject.setDepth(100);
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.dragStartTime = Date.now();
        }, this);

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
            if (gameObject === this.ball) {
                gameObject.body.allowGravity = false;
            }
        }, this);

        this.input.on('dragend', (pointer, gameObject) => {
            console.log('Drag end detected on:', gameObject === this.ball ? 'ball' : gameObject === this.sun ? 'sun' : 'cloud');
            this.isDragging = false;
            this.lastDragEndTime = Date.now();
            if (gameObject === this.ball) {
                gameObject.setDepth(50);
            } else if (gameObject === this.sun) {
                gameObject.setDepth(10);
            } else {
                gameObject.setDepth(20);
            }
            if (gameObject.body) {
                if (gameObject === this.ball) {
                    gameObject.body.allowGravity = true;
                }
                const dragDuration = Date.now() - this.dragStartTime;
                const dragDistance = Math.sqrt(
                    Math.pow(pointer.x - this.dragStartX, 2) +
                    Math.pow(pointer.y - this.dragStartY, 2)
                );
                const releaseSpeed = dragDuration > 0 ? (dragDistance / dragDuration) * 1000 : 0;
                const throwThreshold = 300;
                const isFastFlick = releaseSpeed > throwThreshold;
                if (isFastFlick) {
                    const throwAngle = Math.atan2(
                        pointer.y - this.dragStartY,
                        pointer.x - this.dragStartX
                    );
                    const throwSpeed = Math.min(releaseSpeed * 3, 6000);
                    const finalVelX = Math.cos(throwAngle) * throwSpeed;
                    const finalVelY = Math.sin(throwAngle) * throwSpeed;
                    gameObject.setVelocity(finalVelX, finalVelY);
                    gameObject.setAngularVelocity(finalVelX * 1.5);
                    const throwSound = this.getSound('throwSound');
                    if (throwSound && this.canPlayAudio()) throwSound.play();
                    this.resetStreakCounters();
                    if (gameObject === this.ball) {
                        this.isBallMoving = true;
                    }
                } else {
                    gameObject.setVelocity(0, 0);
                    gameObject.setAngularVelocity(0);
                }
            }
        }, this);

        this.isBallMoving = false;
        this.updateCounters();
        this.directionIndicator = this.add.graphics();
        this.directionIndicator.setDepth(100);
        this.directionIndicator.visible = false;
        this.physics.world.setBounds(0, 0, this.gameWidth, this.gameHeight);
    }

    throwBall() {
        const randomAngle = Phaser.Math.Between(20, 160);
        const angleInRadians = Phaser.Math.DegToRad(randomAngle);
        const speed = Phaser.Math.Between(300, 600);
        const velX = Math.cos(angleInRadians) * speed * 2;
        const velY = -Math.sin(angleInRadians) * speed * 2;
        if (Phaser.Math.FloatBetween(0, 1) > 0.5) {
            this.ball.setVelocity(-velX, velY);
        } else {
            this.ball.setVelocity(velX, velY);
        }
        const throwSound = this.getSound('throwSound');
        if (throwSound && this.canPlayAudio()) throwSound.play();
        this.ball.setAngularVelocity(this.ball.body.velocity.x * 1.5);
        this.isBallMoving = true;
        this.resetStreakCounters();
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
        cloud.setImmovable(false);
        const angle = Phaser.Math.Angle.Between(ball.x, ball.y, cloud.x, cloud.y);
        const nudgeOffset = 12;
        ball.x -= Math.cos(angle) * nudgeOffset;
        ball.y -= Math.sin(angle) * nudgeOffset;
        cloud.x += Math.cos(angle) * nudgeOffset;
        cloud.y += Math.sin(angle) * nudgeOffset;
        const ballVelocity = ball.body.velocity;
        let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
        speed = Math.max(speed, 350);
        cloud.setVelocity(
            Math.cos(angle) * speed * 1.5 * 0.75,
            Math.sin(angle) * speed * 1.5 * 0.75
        );
        ball.setVelocity(
            ballVelocity.x * 0.75,
            ballVelocity.y * 0.75
        );
        ball.setAngularVelocity(ball.body.velocity.x * 1.5);
        const rotationSpeed = Phaser.Math.Between(-1, 1);
        cloud.setAngularVelocity(rotationSpeed * 100);
        const ballSound = this.getSound('ballSound');
        const cloudSound = this.getSound('cloudSound');
        if (ballSound && this.canPlayAudio()) ballSound.play();
        if (cloudSound && this.canPlayAudio()) cloudSound.play();
        if (!this.isDragging) {
            this.incrementBounceCounter('ball', false, true, true);
            this.incrementBounceCounter('cloud', false, false, false);
        }
    }

    handleBallSunCollision(ball, sun) {
        sun.setImmovable(false);
        const angle = Phaser.Math.Angle.Between(ball.x, ball.y, sun.x, sun.y);
        const nudgeOffset = 4;
        ball.x -= Math.cos(angle) * (nudgeOffset * 4);
        ball.y -= Math.sin(angle) * (nudgeOffset * 4);
        sun.x += Math.cos(angle) * nudgeOffset;
        sun.y += Math.sin(angle) * nudgeOffset;
        const ballVelocity = ball.body.velocity;
        let speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
        speed = Math.max(speed, 150);
        sun.setVelocity(
            Math.cos(angle) * speed * 0.15 * 0.75,
            Math.sin(angle) * speed * 0.15 * 0.75
        );
        ball.setVelocity(
            ballVelocity.x * 0.75,
            ballVelocity.y * 0.75
        );
        ball.setAngularVelocity(ball.body.velocity.x * 1.5);
        const rotationSpeed = Phaser.Math.Between(-0.5, 0.5);
        sun.setAngularVelocity(rotationSpeed * 50);
        const ballSound = this.getSound('ballSound');
        const sunSound = this.getSound('sunSound');
        if (ballSound && this.canPlayAudio()) ballSound.play();
        if (sunSound && this.canPlayAudio()) sunSound.play();
        const sunPoints = this.sunStreak === 0 ? 2 : 4;
        if (!this.isDragging) {
            this.incrementBounceCounter('ball', false, true, true, sunPoints);
            this.incrementBounceCounter('sun', false, false, false);
        }
    }

    handleCloudCloudCollision(cloud1, cloud2) {
        const angle = Phaser.Math.Angle.Between(cloud1.x, cloud1.y, cloud2.x, cloud2.y);
        const nudgeOffset = 8;
        cloud1.x -= Math.cos(angle) * nudgeOffset;
        cloud1.y -= Math.sin(angle) * nudgeOffset;
        cloud2.x += Math.cos(angle) * nudgeOffset;
        cloud2.y += Math.sin(angle) * nudgeOffset;
        const vel1 = cloud1.body.velocity;
        const vel2 = cloud2.body.velocity;
        const relVelX = vel1.x - vel2.x;
        const relVelY = vel1.y - vel2.y;
        let speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
        speed = Math.max(speed, 150);
        const bounceX = Math.cos(angle) * speed * 0.9 * 0.75;
        const bounceY = Math.sin(angle) * speed * 0.9 * 0.75;
        cloud1.setVelocity(
            (vel1.x - bounceX) * 0.75,
            (vel1.y - bounceY) * 0.75
        );
        cloud2.setVelocity(
            (vel2.x + bounceX) * 0.75,
            (vel2.y + bounceY) * 0.75
        );
        cloud1.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
        cloud2.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
        const cloudSound = this.getSound('cloudSound');
        if (cloudSound && this.canPlayAudio()) cloudSound.play();
        if (!this.isDragging) {
            this.incrementBounceCounter('cloud', true, true, true);
        }
    }

    handleCloudSunCollision(cloud, sun) {
        const angle = Phaser.Math.Angle.Between(cloud.x, cloud.y, sun.x, sun.y);
        const nudgeOffset = 10;
        cloud.x -= Math.cos(angle) * nudgeOffset;
        cloud.y -= Math.sin(angle) * nudgeOffset;
        sun.x += Math.cos(angle) * nudgeOffset;
        sun.y += Math.sin(angle) * nudgeOffset;
        const cloudVel = cloud.body.velocity;
        const sunVel = sun.body.velocity;
        const relVelX = cloudVel.x - sunVel.x;
        const relVelY = cloudVel.y - sunVel.y;
        let speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
        speed = Math.max(speed, 150);
        const bounceX = Math.cos(angle) * speed * 0.15 * 0.75;
        const bounceY = Math.sin(angle) * speed * 0.15 * 0.75;
        cloud.setVelocity(
            (cloudVel.x - bounceX) * 0.75,
            (cloudVel.y - bounceY) * 0.75
        );
        sun.setVelocity(
            (sunVel.x + bounceX) * 0.75,
            (sunVel.y + bounceY) * 0.75
        );
        cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
        sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 50);
        const sunSound = this.getSound('sunSound');
        const cloudSound = this.getSound('cloudSound');
        if (sunSound && this.canPlayAudio()) sunSound.play();
        if (cloudSound && this.canPlayAudio()) cloudSound.play();
        if (!this.isDragging) {
            this.incrementBounceCounter('sun', true, true, true);
            this.incrementBounceCounter('cloud', true, false, false);
        }
    }

    handleResizeCollisions(oldWidth, oldHeight, newWidth, newHeight) {
        if (!this.ball || !this.clouds || !this.sun) return;
        this.grassHeight = Math.min(newHeight * 0.2, 150);
        const playAreaHeight = newHeight - this.grassHeight;
        if (this.grass) {
            const overdraw = 1000;
            this.grass.width = newWidth + overdraw * 2;
            this.grass.height = this.grassHeight + 500;
            this.grass.x = -overdraw;
            this.grass.y = newHeight - this.grassHeight / 2 + 250;
        }
        if (this.sky) {
            const overdraw = 1000;
            this.sky.width = newWidth + overdraw * 2;
            this.sky.height = newHeight + overdraw * 2;
            this.sky.x = -overdraw;
            this.sky.y = -overdraw;
        }
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.cameras.main.setDirty();
        const grassBottom = newHeight - this.grassHeight;
        if (this.ball && this.ball.y + this.ball.displayHeight / 2 > grassBottom) {
            this.ball.y = grassBottom - this.ball.displayHeight / 2;
            if (this.ball.body) {
                const bounceVelocityY = -Math.abs(this.ball.body.velocity.y || 200) * 0.7;
                const bounceVelocityX = (this.ball.body.velocity.x || 0) * 0.9;
                this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
            }
        }
        this.clouds.forEach(cloud => {
            if (cloud.y + cloud.displayHeight / 2 > grassBottom) {
                cloud.y = grassBottom - cloud.displayHeight / 2;
                if (cloud.body && cloud.body.velocity) {
                    const bounceVelocityY = -Math.abs(cloud.body.velocity.y) * 0.7;
                    const bounceVelocityX = cloud.body.velocity.x * 0.9;
                    cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                }
            }
            if (cloud.y - cloud.displayHeight / 2 < 0) {
                cloud.y = cloud.displayHeight / 2;
                if (cloud.body && cloud.body.velocity) {
                    const bounceVelocityY = Math.abs(cloud.body.velocity.y) * 0.7;
                    const bounceVelocityX = cloud.body.velocity.x * 0.9;
                    cloud.setVelocity(bounceVelocityX, bounceVelocityY);
                    cloud.setAngularVelocity(Phaser.Math.Between(-1, 1) * 50);
                }
            }
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
        if (this.sun) {
            if (this.sun.y + this.sun.displayHeight / 2 > grassBottom) {
                this.sun.y = grassBottom - this.sun.displayHeight / 2;
                if (this.sun.body && this.sun.body.velocity) {
                    const bounceVelocityY = -Math.abs(this.sun.body.velocity.y) * 0.7;
                    const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                    this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                }
            }
            if (this.sun.y - this.sun.displayHeight / 2 < 0) {
                this.sun.y = this.sun.displayHeight / 2;
                if (this.sun.body && this.sun.body.velocity) {
                    const bounceVelocityY = Math.abs(this.sun.body.velocity.y) * 0.7;
                    const bounceVelocityX = this.sun.body.velocity.x * 0.9;
                    this.sun.setVelocity(bounceVelocityX, bounceVelocityY);
                    this.sun.setAngularVelocity(Phaser.Math.Between(-0.5, 0.5) * 30);
                }
            }
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
        if (this.isAiming) {
            this.aimAngle += this.rotationSpeed * this.rotationDirection;
            if (this.aimAngle >= Math.PI * 2) {
                this.aimAngle -= Math.PI * 2;
            } else if (this.aimAngle < 0) {
                this.aimAngle += Math.PI * 2;
            }
            this.updateDirectionIndicator();
        }
        this.drawDebug();
        if (this.isBallMoving &&
            Math.abs(this.ball.body.velocity.x) < 5 &&
            Math.abs(this.ball.body.velocity.y) < 5) {
            this.isBallMoving = false;
            this.ball.setVelocity(0, 0);
            this.ball.setAngularVelocity(0);
            this.ball.body.allowGravity = true;
        }
        this.clouds.forEach(cloud => {
            if (cloud.body && cloud.body.velocity) {
                const velX = cloud.body.velocity.x;
                const velY = cloud.body.velocity.y;
                if (Math.abs(velX) < 100 && Math.abs(velY) < 100) {
                    cloud.setVelocity(velX * 0.96, velY * 0.96);
                } else {
                    cloud.setVelocity(velX * 0.98, velY * 0.98);
                }
                if (Math.abs(velX) < 2 && Math.abs(velY) < 2) {
                    cloud.setVelocity(0, 0);
                    if (Math.abs(cloud.body.angularVelocity) < 1) {
                        cloud.setAngularVelocity(0);
                    }
                }
                if (cloud.body.angularVelocity !== 0) {
                    cloud.setAngularVelocity(cloud.body.angularVelocity * 0.96);
                }
            }
            if (cloud.y - cloud.displayHeight / 2 < 0) {
                cloud.y = cloud.displayHeight / 2;
                if (cloud.body && cloud.body.velocity) {
                    cloud.setVelocity(cloud.body.velocity.x * 0.9, Math.abs(cloud.body.velocity.y) * 0.7);
                }
            }
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
            if (cloud.y > this.gameHeight - this.grassHeight - cloud.displayHeight / 2 + 20) {
                cloud.y = this.gameHeight - this.grassHeight - cloud.displayHeight / 2;
                if (cloud.body && cloud.body.velocity) {
                    cloud.setVelocity(cloud.body.velocity.x * 0.9, -Math.abs(cloud.body.velocity.y) * 0.7);
                }
            }
        });
        if (this.sun && this.sun.body && this.sun.body.velocity) {
            const velX = this.sun.body.velocity.x;
            const velY = this.sun.body.velocity.y;
            if (Math.abs(velX) < 100 && Math.abs(velY) < 100) {
                this.sun.setVelocity(velX * 0.97, velY * 0.97);
            } else {
                this.sun.setVelocity(velX * 0.99, velY * 0.99);
            }
            if (Math.abs(velX) < 2 && Math.abs(velY) < 2) {
                this.sun.setVelocity(0, 0);
                if (Math.abs(this.sun.body.angularVelocity) < 1) {
                    this.sun.setAngularVelocity(0);
                }
            }
            if (this.sun.body.angularVelocity !== 0) {
                this.sun.setAngularVelocity(this.sun.body.angularVelocity * 0.97);
            }
        }
        if (this.sun && this.sun.body && this.sun.body.velocity) {
            const bounceThreshold = 30;
            if (this.sun.y - this.sun.displayHeight / 2 < 0) {
                this.sun.y = this.sun.displayHeight / 2;
                if (Math.abs(this.sun.body.velocity.y) > bounceThreshold) {
                    const sunSound = this.getSound('sunSound');
                    if (sunSound && this.canPlayAudio()) sunSound.play();
                }
                this.sun.setVelocity(this.sun.body.velocity.x * 0.9, Math.abs(this.sun.body.velocity.y) * 0.7);
                this.sun.setAngularVelocity(this.sun.body.angularVelocity + Phaser.Math.Between(-10, 10));
            }
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
            if (this.sun.y > this.gameHeight - this.grassHeight - this.sun.displayHeight / 2 + 20) {
                this.sun.y = this.gameHeight - this.grassHeight - this.sun.displayHeight / 2;
                if (Math.abs(this.sun.body.velocity.y) > bounceThreshold) {
                    const sunSound = this.getSound('sunSound');
                    if (sunSound && this.canPlayAudio()) sunSound.play();
                }
                this.sun.setVelocity(this.sun.body.velocity.x * 0.9, -Math.abs(this.sun.body.velocity.y) * 0.7);
            }
        }
        const maxBounceHeight = this.gameHeight - this.grassHeight / 2 - 10;
        if (this.ball.y > maxBounceHeight) {
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
                    if (Math.abs(this.ball.body.velocity.y) > 30) {
                        const ballSound = this.getSound('ballSound');
                        if (ballSound && this.canPlayAudio()) ballSound.play();
                    }
                    const bounceVelocityY = -Math.abs(this.ball.body.velocity.y) * 0.6;
                    const bounceVelocityX = this.ball.body.velocity.x * 0.9;
                    this.ball.setVelocity(bounceVelocityX, bounceVelocityY);
                    this.ball.setAngularVelocity(bounceVelocityX * 1.5);
                }
            }
        }
        if (this.isBallMoving &&
            Math.abs(this.ball.body.velocity.x) < 1 &&
            Math.abs(this.ball.body.velocity.y) < 1 &&
            (this.ball.body.velocity.x !== 0 || this.ball.body.velocity.y !== 0)) {
            this.ball.setVelocity(
                this.ball.body.velocity.x + Phaser.Math.Between(-5, 5),
                this.ball.body.velocity.y + Phaser.Math.Between(-5, 5)
            );
        }
    }

    startCentrifugeAiming() {
        if (this.isDragging || Date.now() - this.lastDragEndTime < 250) return;
        if (this.ball && this.ball.body) {
            this.ball.body.allowGravity = true;
        }
        this.isAiming = true;
        this.directionIndicator.visible = false;
        this.keyDownTime = Date.now();
        this.aimAngle = Math.PI + Math.random() * Math.PI;
        this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
        this.resetStreakCounters();
        this.arrowShowTimeout = setTimeout(() => {
            if (this.isAiming) {
                this.directionIndicator.visible = true;
            }
        }, 200);
    }

    getRandomSunPosition() {
        const minX = 120;
        const maxX = this.gameWidth - 120;
        const minY = 80;
        const maxY = (this.gameHeight - this.grassHeight) * 0.4;
        return {
            x: Phaser.Math.Between(minX, maxX),
            y: Phaser.Math.Between(minY, maxY)
        };
    }

    updateDirectionIndicator() {
        if (!this.directionIndicator || !this.ball) return;
        const graphics = this.directionIndicator;
        graphics.clear();
        const pressDuration = Date.now() - this.keyDownTime;
        const maxLength = 100;
        const minLength = 40;
        const durationForFullShrink = 7500;
        const normalizedDuration = Math.min(pressDuration, durationForFullShrink) / durationForFullShrink;
        const easeOutDuration = 1 - Math.pow(1 - normalizedDuration, 1.5);
        const arrowLength = maxLength - (maxLength - minLength) * easeOutDuration;
        const startX = this.ball.x;
        const startY = this.ball.y;
        const endX = startX + Math.cos(this.aimAngle) * arrowLength;
        const endY = startY + Math.sin(this.aimAngle) * arrowLength;
        const headLength = arrowLength * 0.1;
        const headWidth = arrowLength * 0.06;
        const angle = this.aimAngle;
        const p1X = endX;
        const p1Y = endY;
        const p2X = endX - headLength * Math.cos(angle) + headWidth * Math.sin(angle);
        const p2Y = endY - headLength * Math.sin(angle) - headWidth * Math.cos(angle);
        const p3X = endX - headLength * Math.cos(angle) - headWidth * Math.sin(angle);
        const p3Y = endY - headLength * Math.sin(angle) + headWidth * Math.cos(angle);
        graphics.lineStyle(3, 0x000000, 1.0);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
        graphics.strokePath();
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
        const pressDuration = Date.now() - this.keyDownTime;
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
        if (this.arrowShowTimeout) {
            clearTimeout(this.arrowShowTimeout);
            this.arrowShowTimeout = null;
        }
        const baseSpeed = Phaser.Math.Between(1600, 2800);
        let speed;
        if (pressDuration < 1800) {
            speed = baseSpeed;
        } else if (pressDuration < 4500) {
            speed = baseSpeed * 0.5;
        } else if (pressDuration < 9000) {
            speed = baseSpeed * 0.25;
        } else {
            speed = baseSpeed * 0.15;
        }
        const finalAngle = this.aimAngle;
        const velX = Math.cos(finalAngle) * speed;
        const velY = Math.sin(finalAngle) * speed;
        this.ball.setVelocity(velX, velY);
        this.resetStreakCounters();
        const throwSound = this.getSound('throwSound');
        if (throwSound && this.canPlayAudio()) throwSound.play();
        this.ball.setAngularVelocity(velX * 1.5);
        this.isBallMoving = true;
    }

    resetStreakCounters() {
        this.sessionPoints = 0;
        this.ballStreak = 0;
        this.sunStreak = 0;
        this.cloudStreak = 0;
        this.updateCounters();
    }

    updateCounters() {
        const counterTable = document.getElementById('counter-table');
        if (counterTable) {
            counterTable.innerHTML = '';
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

    isSafari() {
        const userAgent = window.navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        return isiOS || (userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium'));
    }

    canPlayAudio() {
        return this.audioContextUnlocked && !this.sound.mute;
    }

    getSound(soundName) {
        if (!this.audioContextUnlocked) return null;
        return this[soundName];
    }

    incrementBounceCounter(objectType = 'ball', playSound = true, incrementTotal = true, incrementSession = true, points = 1) {
        if (!this.counterUpdatesEnabled) {
            return;
        }
        if (incrementTotal) {
            this.totalPoints += points;
        }
        if (incrementSession) {
            this.sessionPoints += points;
        }
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
        if (playSound && this.canPlayAudio()) {
            const ballSound = this.getSound('ballSound');
            if (ballSound) ballSound.play();
        }
    }

    resetGame() {
        this.ball.setPosition(this.gameWidth / 2, this.gameHeight - this.grassHeight - 50);
        this.ball.setVelocity(0, 0);
        this.ball.setAngularVelocity(0);
        this.ball.setAngle(0);
        const sunPosition = this.getRandomSunPosition();
        this.sun.setPosition(sunPosition.x, sunPosition.y);
        this.sun.setVelocity(0, 0);
        this.sun.setAngularVelocity(0);
        this.sun.setAngle(Phaser.Math.Between(-5, 5));
        this.sun.setFlipX(Math.random() < 0.5);
        this.sun.setImmovable(true);
        const playAreaHeight = this.gameHeight - this.grassHeight;
        const placedClouds = [];
        this.clouds.forEach(cloud => {
            let cloudX, cloudY, overlaps;
            let attempts = 0;
            do {
                cloudX = Phaser.Math.Between(150, this.gameWidth - 150);
                cloudY = Phaser.Math.Between(100, playAreaHeight * 0.7);
                overlaps = false;
                for (const pc of placedClouds) {
                    const dist = Phaser.Math.Distance.Between(cloudX, cloudY, pc.x, pc.y);
                    if (dist < 250) {
                        overlaps = true;
                        break;
                    }
                }
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
        this.isBallMoving = false;
        this.isAiming = false;
        this.directionIndicator.visible = false;
        if (this.arrowShowTimeout) {
            clearTimeout(this.arrowShowTimeout);
            this.arrowShowTimeout = null;
        }
        this.totalPoints = 0;
        this.sessionPoints = 0;
        this.ballBounces = 0;
        this.sunBounces = 0;
        this.cloudBounces = 0;
        this.ballStreak = 0;
        this.sunStreak = 0;
        this.cloudStreak = 0;
        this.counterUpdatesEnabled = false;
        setTimeout(() => {
            this.counterUpdatesEnabled = true;
        }, 500);
        this.updateCounters();
    }

    toggleMute() {
        if (!this.audioContextUnlocked) {
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
        const newMuteState = !this.sound.mute;
        this.sound.mute = newMuteState;
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            if (newMuteState) {
                muteButton.classList.add('muted');
            } else {
                muteButton.classList.remove('muted');
            }
        }
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('babyBallGameMuted', newMuteState);
            }
        } catch (e) {
            console.warn('Failed to save mute state to localStorage:', e);
        }
        return newMuteState;
    }

    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        if (this.debugEnabled) {
            this.debugHitAreas = true;
            this.debugObjectSizes = true;
            this.debugPhysics = true;
            this.debugGrassArea = true;
        } else {
            this.debugHitAreas = false;
            this.debugObjectSizes = false;
            this.debugPhysics = false;
            this.debugGrassArea = false;
        }
        return this.debugEnabled;
    }

    drawDebug() {
        if (!this.debugEnabled) return;
        const graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 }, fillStyle: { color: 0xff0000 } });
        if (this.debugGrassArea && this.grassHeight > 0) {
            graphics.lineStyle(2, 0xffff00);
            graphics.strokeRect(0, this.gameHeight - this.grassHeight, this.gameWidth, this.grassHeight);
            graphics.lineStyle(3, 0xff0000);
            graphics.beginPath();
            graphics.moveTo(0, this.gameHeight - this.grassHeight);
            graphics.lineTo(this.gameWidth, this.gameHeight - this.grassHeight);
            graphics.strokePath();
        }
        if (this.debugHitAreas || this.debugObjectSizes) {
            if (this.ball && this.ball.body) {
                graphics.lineStyle(2, 0x00ff00);
                const ballRadius = this.ball.body.radius;
                graphics.strokeCircle(this.ball.x, this.ball.y, ballRadius);
                graphics.lineStyle(1, 0x00ff00);
                graphics.beginPath();
                graphics.moveTo(this.ball.x - 10, this.ball.y);
                graphics.lineTo(this.ball.x + 10, this.ball.y);
                graphics.moveTo(this.ball.x, this.ball.y - 10);
                graphics.lineTo(this.ball.x, this.ball.y + 10);
                graphics.strokePath();
            }
            if (this.sun && this.sun.body) {
                graphics.lineStyle(2, 0xffff00);
                const sunRadius = this.sun.body.radius;
                graphics.strokeCircle(this.sun.x, this.sun.y, sunRadius);
                graphics.lineStyle(1, 0xffff00);
                graphics.beginPath();
                graphics.moveTo(this.sun.x - 8, this.sun.y);
                graphics.lineTo(this.sun.x + 8, this.sun.y);
                graphics.moveTo(this.sun.x, this.sun.y - 8);
                graphics.lineTo(this.sun.x, this.sun.y + 8);
                graphics.strokePath();
            }
            this.clouds.forEach(cloud => {
                if (!cloud.active || !cloud.body) return;
                graphics.lineStyle(2, 0x00ffff);
                const cloudRadius = cloud.body.radius;
                graphics.strokeCircle(cloud.x, cloud.y, cloudRadius);
                graphics.lineStyle(1, 0x00ffff);
                graphics.beginPath();
                graphics.moveTo(cloud.x - 8, cloud.y);
                graphics.lineTo(cloud.x + 8, cloud.y);
                graphics.moveTo(cloud.x, cloud.y - 8);
                graphics.lineTo(cloud.x, cloud.y + 8);
                graphics.strokePath();
            });
        }
        graphics.lineStyle(3, 0xffffff);
        graphics.strokeRect(0, 0, this.gameWidth, this.gameHeight);
        setTimeout(() => {
            graphics.destroy();
        }, 16);
    }
}
