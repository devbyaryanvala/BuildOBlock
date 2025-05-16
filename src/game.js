        // --- Constants & Global Settings ---
        let currentWorldSize = 30; // Default world size, can be changed by user
        const CUBE_SIZE = 1;
        var PLAYER_SPEED = 50.0; 
        const VERTICAL_FLY_SPEED = 6.0;
        const JUMP_HEIGHT = 10.0;
        const GRAVITY = 30.0;
        const PLAYER_HEIGHT = 2.8; 
        const LOOK_SENSITIVITY = 0.003; 

        const BLOCK_TYPES = [
            { color: 0x8B4513, name: 'Dirt', texture: null }, 
            { color: 0x808080, name: 'Stone', texture: null }, 
            { color: 0x228B22, name: 'Grass', texture: null }, 
            { color: 0xFFFF00, name: 'Sand', texture: null }, 
            { color: 0xFF0000, name: 'Redstone', texture: null }, 
            { color: 0x0000FF, name: 'Lapis', texture: null }, 
            { color: 0xFFFFFF, name: 'Snow', texture: null }, 
            { color: 0xA0522D, name: 'Wood', texture: null }, 
            { color: 0x90EE90, name: 'Leaves', texture: null} 
        ];

        // --- Global Variables ---
        let scene, camera, renderer, controls;
        let objects = []; // Stores block meshes AND their outlines
        let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
        let moveUp = false, moveDown = false;
        let canJump = false;
        let isFlying = false;
        let velocity = new THREE.Vector3();
        let direction = new THREE.Vector3();
        let playerBoundingBox = new THREE.Box3();
        let currentBlockTypeIndex = 0;
        let prevTime = performance.now();
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let isTouchingToLook = false;
        let lastTouchX = 0, lastTouchY = 0;
        const isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));

        // DOM Elements
        let gameContainer, messageBox, controlsInfoDesktop, mobileStatusInfo, mobileControlsContainer, mobileDPad, mobileActionButtons, desktopButtonContainer, loadingOverlay, worldSizeSelector, restartWorldBtn;

        // Sound Effects (Tone.js)
        let placeSound, removeSound, jumpSound, switchBlockSound;
        let soundsReady = false;

        // --- Function Definitions ---

        function onMouseWheel(event) {
            if (isTouchDevice || !controls.isLocked) return;
            const scrollDelta = Math.sign(event.deltaY); 
            cycleBlockType(scrollDelta);
        }
        
        // --- Initialization ---
        document.addEventListener('DOMContentLoaded', () => {
            gameContainer = document.getElementById('game-container');
            messageBox = document.getElementById('message-box');
            controlsInfoDesktop = document.getElementById('controls-info');
            mobileStatusInfo = document.getElementById('mobile-status-info');
            mobileControlsContainer = document.getElementById('mobile-controls-container');
            mobileDPad = document.getElementById('mobile-d-pad');
            mobileActionButtons = document.getElementById('mobile-action-buttons');
            desktopButtonContainer = document.getElementById('desktop-button-container');
            loadingOverlay = document.getElementById('loading-overlay');
            worldSizeSelector = document.getElementById('world-size-selector');
            restartWorldBtn = document.getElementById('restart-world-btn');

            initThreeJS();
            initGameLogic();
            initAudio(); 
        });


        function initThreeJS() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87CEEB);
            scene.fog = new THREE.Fog(0x87CEEB, 0, 150); 

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(currentWorldSize / 2, PLAYER_HEIGHT + 5, currentWorldSize / 2 + 5); // Use currentWorldSize

            renderer = new THREE.WebGLRenderer({ antialias: true }); 
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio); 
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
            gameContainer.appendChild(renderer.domElement);

            controls = new THREE.PointerLockControls(camera, renderer.domElement);
            scene.add(controls.getObject());

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); 
            directionalLight.position.set(70, 100, 80); 
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 1024;  
            directionalLight.shadow.mapSize.height = 1024; 
            directionalLight.shadow.camera.near = 0.5;      
            directionalLight.shadow.camera.far = 300;    
            directionalLight.shadow.camera.left = -100;   
            directionalLight.shadow.camera.right = 100;
            directionalLight.shadow.camera.top = 100;
            directionalLight.shadow.camera.bottom = -100;
            scene.add(directionalLight);
        }

        function initGameLogic() {
            messageBox.style.display = 'block';
            if (isTouchDevice) {
                messageBox.textContent = 'Tap screen to start & look. Use buttons to move/act.';
                if(controlsInfoDesktop) controlsInfoDesktop.style.display = 'none';
                if(desktopButtonContainer) desktopButtonContainer.style.display = 'none';
                if(mobileStatusInfo) mobileStatusInfo.style.display = 'block';
                if(mobileControlsContainer) mobileControlsContainer.style.display = 'block';
                if(mobileDPad) mobileDPad.style.display = 'grid';
                if(mobileActionButtons) mobileActionButtons.style.display = 'grid';
            } else {
                messageBox.textContent = 'Welcome! Click to start.';
                if(mobileControlsContainer) mobileControlsContainer.style.display = 'none';
                if(mobileStatusInfo) mobileStatusInfo.style.display = 'none';
                if(mobileDPad) mobileDPad.style.display = 'none';
                if(mobileActionButtons) mobileActionButtons.style.display = 'none';
            }

            setupInteractionListeners();
            createInitialWorld(); 

            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            window.addEventListener('mousedown', onGeneralMouseDown);
            window.addEventListener('wheel', onMouseWheel); 
            window.addEventListener('resize', onWindowResize);
            setupMobileButtonListeners();
            setupWorldSizeControls(); // Setup listeners for world size toggler

            updateCurrentBlockIndicator();
            updateFlyIndicator();

            if(loadingOverlay) loadingOverlay.style.display = 'none';
            prevTime = performance.now(); 
            animate();
        }
        
        function setupWorldSizeControls() {
            if (restartWorldBtn && worldSizeSelector) {
                restartWorldBtn.addEventListener('click', () => {
                    const newSize = parseInt(worldSizeSelector.value);
                    if (newSize && newSize !== currentWorldSize) {
                        currentWorldSize = newSize;
                        if(loadingOverlay) loadingOverlay.style.display = 'flex'; // Show loading
                        // Delay restart slightly to allow loading overlay to show
                        setTimeout(restartGameWithNewSize, 50);
                    } else if (newSize === currentWorldSize) {
                        // Optional: provide feedback if size is the same
                        console.log("World size is already set to " + newSize);
                         if(loadingOverlay) loadingOverlay.style.display = 'flex';
                         setTimeout(restartGameWithNewSize, 50); // Still allow restart if desired
                    }
                });
            }
        }

        function restartGameWithNewSize() {
            clearWorld();
            createInitialWorld();
            // Reset player position and velocity
            controls.getObject().position.set(currentWorldSize / 2, PLAYER_HEIGHT + 5, currentWorldSize / 2 + 5);
            velocity.set(0, 0, 0);
            canJump = false; // Reset jump state
            if(loadingOverlay) loadingOverlay.style.display = 'none'; // Hide loading
        }

        function clearWorld() {
            // Remove all objects (blocks and their outlines) from the scene
            for (let i = objects.length - 1; i >= 0; i--) {
                const object = objects[i];
                if (object.userData.outline) { // If it's a block mesh with an outline
                    scene.remove(object.userData.outline);
                    if (object.userData.outline.geometry) object.userData.outline.geometry.dispose();
                    if (object.userData.outline.material) object.userData.outline.material.dispose();
                }
                scene.remove(object); // Remove the block mesh itself
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                     if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                     else object.material.dispose();
                }
            }
            objects = []; // Clear the array
        }


        function initAudio() {
            const startAudio = async () => {
                if (soundsReady || typeof Tone === 'undefined') return;
                try {
                    await Tone.start(); 

                    placeSound = new Tone.Synth({
                        oscillator: { type: 'sine' },
                        envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.1 }
                    }).toDestination();
                    placeSound.volume.value = -10; 

                    removeSound = new Tone.Synth({
                        oscillator: { type: 'triangle' },
                        envelope: { attack: 0.01, decay: 0.15, sustain: 0.02, release: 0.2 }
                    }).toDestination();
                    removeSound.volume.value = -12; 

                    jumpSound = new Tone.Synth({
                        oscillator: { type: 'square' },
                        envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
                    }).toDestination();
                    jumpSound.volume.value = -15; 

                    switchBlockSound = new Tone.MembraneSynth({
                        pitchDecay: 0.01,
                        octaves: 2,
                        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
                    }).toDestination();
                    switchBlockSound.volume.value = -18; 
                    
                    soundsReady = true;
                    console.log("Audio initialized.");
                } catch (e) {
                    console.error("Error starting Tone.js audio context:", e);
                }
                document.removeEventListener('click', startAudio);
                document.removeEventListener('touchstart', startAudio);
            };
            document.addEventListener('click', startAudio, { once: true });
            document.addEventListener('touchstart', startAudio, { once: true });
        }


        function createInitialWorld() {
            // Create multi-layered ground based on currentWorldSize
            for (let x = 0; x < currentWorldSize; x++) {
                for (let z = 0; z < currentWorldSize; z++) {
                    const currentX = x * CUBE_SIZE;
                    const currentZ = z * CUBE_SIZE;
                    // Place Grass
                    addBlock({ x: currentX, y: -1 * CUBE_SIZE, z: currentZ }, 2, false); 
                    // Place Dirt
                    // for (let d = 1; d <= 4; d++) { 
                    //     addBlock({ x: currentX, y: (-1 - d) * CUBE_SIZE, z: currentZ }, 0, false); 
                    // }
                    // // Place Stone
                    // for (let s = 1; s <= 10; s++) { 
                    //     addBlock({ x: currentX, y: (-1 - 4 - s) * CUBE_SIZE, z: currentZ }, 1, false); 
                    // }
                }
            }

            // Random terrain features on top of the grass layer (y=0 and above)
            // User's code had 70 iterations for random terrain.
            const numTerrainFeatures = Math.floor(70 * (currentWorldSize / 30)); // Scale features with world size
            for (let i = 0; i < numTerrainFeatures; i++) { 
                const type = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? 1 : 7); 
                const height = Math.floor(Math.random() * 3); 
                for(let h = 0; h <= height; h++){ 
                    addBlock({
                        x: Math.floor(Math.random() * currentWorldSize) * CUBE_SIZE,
                        y: h * CUBE_SIZE, 
                        z: Math.floor(Math.random() * currentWorldSize) * CUBE_SIZE
                    }, type, false); 
                }
            }
            // Add trees (User's code had 5 trees)
            const numTrees = Math.floor(5 * (currentWorldSize / 30)); // Scale trees
            for (let i = 0; i < numTrees; i++) { 
                const treeX = Math.floor(Math.random() * (currentWorldSize - 4) + 2) * CUBE_SIZE;
                const treeZ = Math.floor(Math.random() * (currentWorldSize - 4) + 2) * CUBE_SIZE;
                for (let h = 0; h < 4; h++) { 
                    addBlock({ x: treeX, y: h * CUBE_SIZE, z: treeZ }, 7, false); 
                }
                for (let lx = -1; lx <= 1; lx++) {
                    for (let ly = 0; ly <= 1; ly++) { 
                        for (let lz = -1; lz <= 1; lz++) {
                            if (lx === 0 && lz === 0 && ly === 0) continue; 
                             addBlock({ x: treeX + lx * CUBE_SIZE, y: (4 + ly) * CUBE_SIZE, z: treeZ + lz * CUBE_SIZE }, 8, false); 
                        }
                    }
                }
            }
        }

        function setupInteractionListeners() {
            if (isTouchDevice) {
                renderer.domElement.addEventListener('touchstart', (event) => {
                    if (event.target.closest('.mobile-control-button, .game-button, #world-size-controls *')) return; // Ignore touches on controls
                    if (event.touches.length === 1) {
                        isTouchingToLook = true;
                        lastTouchX = event.touches[0].clientX;
                        lastTouchY = event.touches[0].clientY;
                    }
                    if (messageBox.style.display !== 'none') messageBox.style.display = 'none';
                    event.preventDefault();
                }, { passive: false });

                renderer.domElement.addEventListener('touchmove', (event) => {
                    if (isTouchingToLook && event.touches.length === 1) {
                        const touchX = event.touches[0].clientX;
                        const touchY = event.touches[0].clientY;
                        const deltaX = touchX - lastTouchX;
                        const deltaY = touchY - lastTouchY;
                        lastTouchX = touchX;
                        lastTouchY = touchY;

                        const camObject = controls.getObject();
                        camObject.rotation.y -= deltaX * LOOK_SENSITIVITY;
                        camera.rotation.x += deltaY * LOOK_SENSITIVITY; 
                        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
                    }
                    event.preventDefault();
                }, { passive: false });

                renderer.domElement.addEventListener('touchend', (event) => {
                    if (event.touches.length === 0) isTouchingToLook = false;
                });

            } else {
                gameContainer.addEventListener('click', () => { 
                    if (document.activeElement === worldSizeSelector || document.activeElement === restartWorldBtn) return; // Don't lock if interacting with UI
                    if (!controls.isLocked) controls.lock(); 
                });
                controls.addEventListener('lock', () => {
                    messageBox.style.display = 'none';
                    if(controlsInfoDesktop) controlsInfoDesktop.style.display = 'block';
                });
                controls.addEventListener('unlock', () => {
                    messageBox.textContent = 'Paused. Click to resume.';
                    messageBox.style.display = 'block';
                    if(controlsInfoDesktop) controlsInfoDesktop.style.display = 'none';
                });
            }
        }

        function setupMobileButtonListeners() {
            const dpadButtons = [
                { id: 'move-forward-btn', action: () => moveForward = true, stopAction: () => moveForward = false },
                { id: 'move-backward-btn', action: () => moveBackward = true, stopAction: () => moveBackward = false },
                { id: 'move-left-btn', action: () => moveLeft = true, stopAction: () => moveLeft = false },
                { id: 'move-right-btn', action: () => moveRight = true, stopAction: () => moveRight = false },
            ];
            dpadButtons.forEach(btnConfig => {
                const btnElement = document.getElementById(btnConfig.id);
                if (btnElement) {
                    btnElement.addEventListener('touchstart', (e) => { e.preventDefault(); btnConfig.action(); }, { passive: false });
                    btnElement.addEventListener('touchend', (e) => { e.preventDefault(); btnConfig.stopAction(); }, { passive: false });
                    btnElement.addEventListener('touchcancel', (e) => { e.preventDefault(); btnConfig.stopAction(); }, { passive: false });
                }
            });

            const verticalMovementButtons = [
                { id: 'jump-fly-up-btn', pressAction: handleJumpFlyUpPress, releaseAction: handleJumpFlyUpRelease },
                { id: 'crouch-fly-down-btn', pressAction: handleCrouchFlyDownPress, releaseAction: handleCrouchFlyDownRelease }
            ];
            verticalMovementButtons.forEach(config => {
                const btnElement = document.getElementById(config.id);
                if (btnElement) {
                    btnElement.addEventListener('touchstart', (e) => { e.preventDefault(); config.pressAction(); }, { passive: false });
                    btnElement.addEventListener('touchend', (e) => { e.preventDefault(); config.releaseAction(); }, { passive: false });
                    btnElement.addEventListener('touchcancel', (e) => { e.preventDefault(); config.releaseAction(); }, { passive: false });
                }
            });

            const singleTapActionButtons = [
                { id: 'toggle-fly-btn', action: toggleFlyMode },
                { id: 'place-block-btn-mobile', action: attemptPlaceBlock },
                { id: 'remove-block-btn-mobile', action: attemptRemoveBlock },
                { id: 'next-block-btn-mobile', action: () => cycleBlockType(1) },
                { id: 'prev-block-btn-mobile', action: () => cycleBlockType(-1) }
            ];
            singleTapActionButtons.forEach(config => {
                const btnElement = document.getElementById(config.id);
                if (btnElement) {
                    btnElement.addEventListener('touchstart', (e) => { e.preventDefault(); config.action(); }, { passive: false });
                }
            });

            document.getElementById('addBlockBtnDesktop')?.addEventListener('click', (e) => { e.preventDefault(); if (controls.isLocked) attemptPlaceBlock(); });
            document.getElementById('removeBlockBtnDesktop')?.addEventListener('click', (e) => { e.preventDefault(); if (controls.isLocked) attemptRemoveBlock(); });
        }

        function handleJumpFlyUpPress() {
            if (isFlying) moveUp = true;
            else if (canJump) {
                velocity.y += JUMP_HEIGHT;
                canJump = false;
                if (soundsReady && jumpSound) jumpSound.triggerAttackRelease("C4", "8n", Tone.now());
            }
        }
        function handleJumpFlyUpRelease() { if (isFlying) moveUp = false; }
        function handleCrouchFlyDownPress() { moveDown = true; }
        function handleCrouchFlyDownRelease() { moveDown = false; }

        function toggleFlyMode() {
            isFlying = !isFlying;
            if (isFlying) { velocity.y = 0; canJump = false; }
            updateFlyIndicator();
        }

        function cycleBlockType(direction) {
            currentBlockTypeIndex = (currentBlockTypeIndex + direction + BLOCK_TYPES.length) % BLOCK_TYPES.length;
            updateCurrentBlockIndicator();
            if (soundsReady && switchBlockSound) switchBlockSound.triggerAttackRelease("C2", "16n", Tone.now() + 0.01);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function onKeyDown(event) {
            if (!isTouchDevice && !controls.isLocked) return;
            switch (event.code) {
                case 'KeyW': moveForward = true; break;
                case 'KeyA': moveLeft = true; break;
                case 'KeyS': moveBackward = true; break;
                case 'KeyD': moveRight = true; break;
                case 'Space': handleJumpFlyUpPress(); break;
                case 'ShiftLeft': case 'ShiftRight': handleCrouchFlyDownPress(); break;
                case 'KeyF': toggleFlyMode(); break;
            }
        }

        function onKeyUp(event) {
            if (!isTouchDevice && !controls.isLocked) return;
            switch (event.code) {
                case 'KeyW': moveForward = false; break;
                case 'KeyA': moveLeft = false; break;
                case 'KeyS': moveBackward = false; break;
                case 'KeyD': moveRight = false; break;
                case 'Space': handleJumpFlyUpRelease(); break;
                case 'ShiftLeft': case 'ShiftRight': handleCrouchFlyDownRelease(); break;
            }
        }

        function updateFlyIndicator() {
            const flyStatusDesktop = document.getElementById('fly-toggle-text');
            const verticalMovementDesktop = document.getElementById('vertical-movement-text');
            const mobileFlyStatus = document.getElementById('mobile-fly-status');
            const jumpBtn = document.getElementById('jump-fly-up-btn');
            const crouchBtn = document.getElementById('crouch-fly-down-btn');

            let flyText = `Fly: ${isFlying ? 'ON' : 'OFF'}`;
            if (mobileFlyStatus) mobileFlyStatus.textContent = flyText;
            if (flyStatusDesktop) flyStatusDesktop.textContent = `F: Toggle Fly Mode (${isFlying ? 'ON' : 'OFF'})`;

            if (isFlying) {
                if (verticalMovementDesktop) verticalMovementDesktop.textContent = "Space: Ascend / Shift: Descend";
                if (jumpBtn) jumpBtn.textContent = "ASCEND";
                if (crouchBtn) crouchBtn.textContent = "DESCEND";
            } else {
                if (verticalMovementDesktop) verticalMovementDesktop.textContent = "Space: Jump / Shift: (Slow)";
                if (jumpBtn) jumpBtn.textContent = "JUMP";
                if (crouchBtn) crouchBtn.textContent = "CROUCH";
            }
        }

        function onGeneralMouseDown(event) {
            if (isTouchDevice || !controls.isLocked) return;
            pointer.x = 0; pointer.y = 0;
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(objects.filter(obj => obj.type === "Mesh"), false); 
            if (intersects.length > 0) {
                const intersect = intersects[0];
                if (event.button === 0 && (event.ctrlKey || event.metaKey)) { attemptRemoveBlock(intersect); }
                else if (event.button === 0) { attemptPlaceBlock(intersect); }
                else if (event.button === 2) { attemptRemoveBlock(intersect); }
            }
        }

        function attemptPlaceBlock(intersect) {
            if (!isTouchDevice && !controls.isLocked && intersect === undefined) return; 
            
            if (intersect === undefined) { 
                pointer.x = 0; pointer.y = 0;
                raycaster.setFromCamera(pointer, camera);
                const mobileIntersects = raycaster.intersectObjects(objects.filter(obj => obj.type === "Mesh"), false);
                if (mobileIntersects.length === 0) return;
                intersect = mobileIntersects[0];
            }
             if (intersect.object.type !== "Mesh") return; 

            const normal = intersect.face.normal.clone();
            const position = intersect.object.position.clone().add(normal.multiplyScalar(CUBE_SIZE));
            position.x = Math.round(position.x / CUBE_SIZE) * CUBE_SIZE;
            position.y = Math.round(position.y / CUBE_SIZE) * CUBE_SIZE;
            position.z = Math.round(position.z / CUBE_SIZE) * CUBE_SIZE;

            const blockExists = objects.some(obj => obj.type === "Mesh" && obj.position.distanceTo(position) < 0.1);
            if (blockExists) return;

            const playerPos = controls.getObject().position;
            const tempPlayerBox = new THREE.Box3().setFromCenterAndSize(playerPos, new THREE.Vector3(CUBE_SIZE * 0.8, PLAYER_HEIGHT, CUBE_SIZE * 0.8));
            const newBlockBox = new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE));
            if (tempPlayerBox.intersectsBox(newBlockBox)) return;

            addBlock(position, currentBlockTypeIndex, true); 
        }

        function attemptRemoveBlock(intersect) {
            if (!isTouchDevice && !controls.isLocked && intersect === undefined) return;

            if (intersect === undefined) { 
                pointer.x = 0; pointer.y = 0;
                raycaster.setFromCamera(pointer, camera);
                const mobileIntersects = raycaster.intersectObjects(objects.filter(obj => obj.type === "Mesh"), false);
                if (mobileIntersects.length === 0) return;
                intersect = mobileIntersects[0];
            }
            if (intersect.object.type !== "Mesh") return; 
            
            if (intersect.object.position.y === -CUBE_SIZE && objects.filter(obj => obj.type === "Mesh" && obj.position.y === -CUBE_SIZE).length <= 20) return; 
            if (intersect.object.position.y < -CUBE_SIZE) return; 

            if (soundsReady && removeSound) removeSound.triggerAttackRelease("A2", "8n", Tone.now());
            
            const blockToRemove = intersect.object;
            
            if (blockToRemove.userData.outline) {
                scene.remove(blockToRemove.userData.outline);
                if (blockToRemove.userData.outline.geometry) blockToRemove.userData.outline.geometry.dispose();
                if (blockToRemove.userData.outline.material) blockToRemove.userData.outline.material.dispose();
            }
            
            let scale = 1; // Keep shrink animation from user's code
            const shrinkInterval = setInterval(() => {
                scale -= 0.1;
                if (scale <= 0) {
                    clearInterval(shrinkInterval);
                    scene.remove(blockToRemove);
                    const objIndex = objects.findIndex(obj => obj === blockToRemove); // Find and remove the block
                    if (objIndex > -1) objects.splice(objIndex, 1);
                    
                    if (blockToRemove.geometry) blockToRemove.geometry.dispose();
                    if (blockToRemove.material) {
                        if (Array.isArray(blockToRemove.material)) blockToRemove.material.forEach(m => m.dispose());
                        else blockToRemove.material.dispose();
                    }
                } else {
                    blockToRemove.scale.set(scale, scale, scale);
                }
            }, 20); 
        }


        function addBlock(position, typeIndex, animatePlacement = false) { 
            const blockMaterial = new THREE.MeshLambertMaterial({ color: BLOCK_TYPES[typeIndex].color });
            const blockGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
            const newCube = new THREE.Mesh(blockGeometry, blockMaterial);
            newCube.position.copy(position);
            newCube.castShadow = true;
            newCube.receiveShadow = true;
            
            const edges = new THREE.EdgesGeometry(blockGeometry);
            const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }); 
            const outline = new THREE.LineSegments(edges, outlineMaterial);
            outline.position.copy(position);
            scene.add(outline);
            newCube.userData.outline = outline; 

            scene.add(newCube);
            objects.push(newCube); // Add the block mesh to objects array (outlines are not added here)

            if (animatePlacement) { // Keep grow animation from user's code
                if (soundsReady && placeSound) placeSound.triggerAttackRelease("C5", "16n", Tone.now());
                newCube.scale.set(0.1, 0.1, 0.1);
                let scale = 0.1;
                const growInterval = setInterval(() => {
                    scale += 0.15; 
                    if (scale >= 1) {
                        clearInterval(growInterval);
                        newCube.scale.set(1, 1, 1);
                    } else {
                        newCube.scale.set(scale, scale, scale);
                    }
                }, 16); 
            }
        }


        function updateCurrentBlockIndicator() {
            const blockTypeName = BLOCK_TYPES[currentBlockTypeIndex].name;
            const blockTypeColorHex = `#${BLOCK_TYPES[currentBlockTypeIndex].color.toString(16).padStart(6, '0')}`;
            const desktopInfo = document.getElementById('controls-info');
            if (desktopInfo) {
                let existingPDesktop = desktopInfo.querySelector('#current-block-text-desktop');
                if (existingPDesktop) existingPDesktop.remove();
                const pDesktop = document.createElement('p');
                pDesktop.id = 'current-block-text-desktop';
                pDesktop.textContent = `Selected: ${blockTypeName}`;
                pDesktop.style.color = blockTypeColorHex;
                desktopInfo.appendChild(pDesktop);
            }
            if (mobileStatusInfo) {
                const mobileBlockStatus = mobileStatusInfo.querySelector('#mobile-block-status');
                if (mobileBlockStatus) {
                    mobileBlockStatus.textContent = `Block: ${blockTypeName}`;
                    mobileBlockStatus.style.color = blockTypeColorHex;
                }
            }
        }

        function updatePlayer(delta) {
            if (!isTouchDevice && !controls.isLocked) return;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            if (isFlying) {
                velocity.y = 0;
                if (moveUp) controls.getObject().position.y += VERTICAL_FLY_SPEED * delta;
                if (moveDown) controls.getObject().position.y -= VERTICAL_FLY_SPEED * delta;
                canJump = false;
            } else {
                velocity.y -= GRAVITY * delta;
                controls.getObject().position.y += (velocity.y * delta);
            }

            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveLeft) - Number(moveRight);
            direction.normalize();

            const currentSpeed = (moveDown && !isFlying) ? PLAYER_SPEED * 0.5 : PLAYER_SPEED;
            
            if (moveForward || moveBackward) velocity.z += direction.z * currentSpeed * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta; 

            controls.moveRight(velocity.x * delta);
            controls.moveForward(velocity.z * delta);

            const playerPosition = controls.getObject().position;
            playerBoundingBox.setFromCenterAndSize(playerPosition, new THREE.Vector3(CUBE_SIZE * 0.7, PLAYER_HEIGHT, CUBE_SIZE * 0.7));
            let onObject = false;

            for (let i = 0; i < objects.length; i++) {
                // IMPORTANT: Skip outlines in collision detection
                if (objects[i].type === "LineSegments") continue; 

                const objectBox = new THREE.Box3().setFromObject(objects[i]);
                if (playerBoundingBox.intersectsBox(objectBox)) {
                    const intersection = new THREE.Box3().copy(playerBoundingBox).intersect(objectBox);
                    const overlapX = intersection.max.x - intersection.min.x;
                    const overlapY = intersection.max.y - intersection.min.y;
                    const overlapZ = intersection.max.z - intersection.min.z;

                    if (overlapY < overlapX && overlapY < overlapZ) {
                        if (isFlying) {
                            if (playerPosition.y > objectBox.getCenter(new THREE.Vector3()).y) playerPosition.y = objectBox.max.y + PLAYER_HEIGHT / 2 + 0.01;
                            else playerPosition.y = objectBox.min.y - PLAYER_HEIGHT / 2 - 0.01;
                        } else {
                            if (playerPosition.y > objectBox.max.y - PLAYER_HEIGHT / 2 + 0.05 && velocity.y <= 0) {
                                playerPosition.y = objectBox.max.y + PLAYER_HEIGHT / 2;
                                velocity.y = 0; canJump = true; onObject = true;
                            } else if (playerPosition.y < objectBox.min.y + PLAYER_HEIGHT / 2 - 0.05 && velocity.y >= 0) {
                                playerPosition.y = objectBox.min.y - PLAYER_HEIGHT / 2;
                                velocity.y = 0;
                            }
                        }
                    } else if (overlapX < overlapZ) {
                        if (playerPosition.x < objectBox.getCenter(new THREE.Vector3()).x) playerPosition.x -= overlapX;
                        else playerPosition.x += overlapX;
                        velocity.x = 0;
                    } else {
                        if (playerPosition.z < objectBox.getCenter(new THREE.Vector3()).z) playerPosition.z -= overlapZ;
                        else playerPosition.z += overlapZ;
                        velocity.z = 0;
                    }
                    playerBoundingBox.setFromCenterAndSize(playerPosition, new THREE.Vector3(CUBE_SIZE * 0.7, PLAYER_HEIGHT, CUBE_SIZE * 0.7));
                }
            }

            if (!isFlying) {
                if (!onObject && velocity.y < 0) canJump = false;
                if (playerPosition.y < -50) { 
                    playerPosition.set(currentWorldSize / 2, PLAYER_HEIGHT + 10, currentWorldSize / 2); // Use currentWorldSize
                    velocity.y = 0; canJump = true;
                }
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            const time = performance.now();
            const delta = (time - prevTime) / 1000;
            if (isTouchDevice || controls.isLocked) {
                updatePlayer(delta);
            }
            renderer.render(scene, camera);
            prevTime = time;
        }
