// Main Application Coordinator & Orchestrator

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. STATE VARIABLES & DEFAULTS
    // ----------------------------------------------------
    let isPlaying = false;
    let isPaused = false;
    let simSpeedScale = 1.0;
    
    // Joint actuators: waist (j1), shoulder (j2), elbow (j3)
    // Args: name, startAngle (rad), inertia (kg*m^2), torqueLimit (N-m)
    const waistActuator = new JointActuator('Waist', 0.0, 1.8, 80.0);
    const shoulderActuator = new JointActuator('Shoulder', Math.PI/4, 2.2, 120.0);
    const elbowActuator = new JointActuator('Elbow', -Math.PI/4, 1.2, 70.0);
    
    const actuators = [waistActuator, shoulderActuator, elbowActuator];
    
    // Dynamic parameters
    let maxVelocity = 100.0;     // mm/s
    let maxAcceleration = 150.0; // mm/s^2
    
    // Disturbance values (from UI inputs)
    let gearBacklash = 0.05;
    let jointFriction = 0.10;
    let gravityConstant = 9.81;
    let encoderNoise = 0.02;
    
    // Trajectory tracking
    let idealPos = { x: 0.0, y: 6.5, z: 2.0 }; // Current target Cartesian coord (mm)
    let actualPos = { x: 0.0, y: 6.5, z: 2.0 }; // Actual physical Cartesian coord
    let targetAngles = { theta1: 0, theta2: Math.PI/4, theta3: -Math.PI/4 };
    
    // Sequencer state
    let compiledProgram = [];
    let currentStepIndex = -1;
    let activeProfiler = null;
    let profileStartTime = 0;
    let sequenceTime = 0;
    let waitTimer = 0;
    let activeTool = false; // Laser/Solder tool state
    let gripperState = 'OPEN'; // OPEN, CLOSED
    let gripperVal = 0.0; // 0 = open, 1 = closed (for animation)
    
    // Workpiece elements for tasks
    let virtualBlocks = [];
    let activeHeldBlock = null;
    let showPCB = false;
    let showBins = false;
    
    // Telemetry log arrays for graphs
    const timeHistory = [];
    const targetXHistory = [];
    const actualXHistory = [];
    const targetYHistory = [];
    const actualYHistory = [];
    const targetZHistory = [];
    const actualZHistory = [];
    const errorHistory = [];
    const historyLimit = 200;
    
    // 3D Scene variables
    let scene, camera, renderer, orbitControls;
    let armBase, armShoulder, armElbow, armForearm, armWrist, gripperClawLeft, gripperClawRight;
    let laserBeam;
    let pathIdealGeom, pathActualGeom;
    const pathIdealPoints = [];
    const pathActualPoints = [];
    let showPathTrail = true;
    let showGrid = true;
    let workpieceContainer;
    
    // ----------------------------------------------------
    // 2. INITIALIZE THREE.JS VIEWPORT
    // ----------------------------------------------------
    function init3D() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x070913);
        
        // Add subtle grid fog
        scene.fog = new THREE.FogExp2(0x070913, 0.03);
        
        // Camera
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(10, 10, 12);
        
        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        
        // Orbit Controls
        orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.05;
        orbitControls.maxPolarAngle = Math.PI / 2 - 0.01; // Don't go below floor
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x1a233a, 1.2);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        scene.add(dirLight);
        
        const pointLight = new THREE.PointLight(0x00f2fe, 1, 10);
        pointLight.position.set(0, 5, 0);
        scene.add(pointLight);
        
        // Cyber Grid Floor
        const gridHelper = new THREE.GridHelper(30, 30, 0x27344d, 0x182030);
        gridHelper.position.y = -0.01;
        scene.add(gridHelper);
        
        // Base plate anchor ring
        const baseRingGeom = new THREE.RingGeometry(0.8, 1.0, 32);
        baseRingGeom.rotateX(-Math.PI / 2);
        const baseRingMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
        const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat);
        scene.add(baseRing);
        
        // Create Robotic Arm Meshes
        createRoboticArm();
        
        // Laser beam tool output (hidden by default)
        const laserGeom = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
        laserGeom.translate(0, -0.5, 0);
        laserGeom.rotateX(Math.PI / 2); // align along Z axis
        const laserMat = new THREE.MeshBasicMaterial({ color: 0xff007f, transparent: true, opacity: 0.8 });
        laserBeam = new THREE.Mesh(laserGeom, laserMat);
        laserBeam.visible = false;
        scene.add(laserBeam);
        
        // Traced Paths
        const pathIdealMat = new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.6 });
        pathIdealGeom = new THREE.BufferGeometry();
        const idealLine = new THREE.Line(pathIdealGeom, pathIdealMat);
        scene.add(idealLine);
        
        const pathActualMat = new THREE.LineBasicMaterial({ color: 0xff007f, transparent: true, opacity: 0.8 });
        pathActualGeom = new THREE.BufferGeometry();
        const actualLine = new THREE.Line(pathActualGeom, pathActualMat);
        scene.add(actualLine);
        
        // Workpiece elements container
        workpieceContainer = new THREE.Group();
        scene.add(workpieceContainer);
        
        // Setup initial task objects
        setupTaskWorkpieces();
        
        window.addEventListener('resize', onWindowResize);
    }
    
    function createRoboticArm() {
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d354a,
            roughness: 0.2,
            metalness: 0.8
        });
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f2fe
        });
        const jointMaterial = new THREE.MeshStandardMaterial({
            color: 0x1b2336,
            roughness: 0.4,
            metalness: 0.5
        });
        
        // Base pillar (immobile)
        const baseGeom = new THREE.CylinderGeometry(0.5, 0.6, LINK_BASE_HEIGHT, 16);
        baseGeom.translate(0, LINK_BASE_HEIGHT/2, 0);
        armBase = new THREE.Mesh(baseGeom, metalMaterial);
        scene.add(armBase);
        
        // Decorative glowing strip on base
        const baseStripGeom = new THREE.CylinderGeometry(0.51, 0.51, 0.1, 16);
        baseStripGeom.translate(0, LINK_BASE_HEIGHT - 0.3, 0);
        const baseStrip = new THREE.Mesh(baseStripGeom, glowMaterial);
        armBase.add(baseStrip);
        
        // Joint 2 (Shoulder) sphere
        const shoulderGeom = new THREE.SphereGeometry(0.4, 16, 16);
        armShoulder = new THREE.Mesh(shoulderGeom, jointMaterial);
        scene.add(armShoulder);
        
        // Upper Arm Link (Link 2)
        const upperGeom = new THREE.CylinderGeometry(0.25, 0.2, LINK_SHOULDER, 16);
        upperGeom.translate(0, LINK_SHOULDER/2, 0);
        upperGeom.rotateX(Math.PI/2); // Cylinder starts pointing up Y, align to Z for direct placement
        armForearm = new THREE.Mesh(upperGeom, metalMaterial);
        scene.add(armForearm);
        
        // Joint 3 (Elbow) sphere
        const elbowGeom = new THREE.SphereGeometry(0.3, 16, 16);
        armElbow = new THREE.Mesh(elbowGeom, jointMaterial);
        scene.add(armElbow);
        
        // Forearm Link (Link 3)
        const forearmGeom = new THREE.CylinderGeometry(0.18, 0.14, LINK_ELBOW, 16);
        forearmGeom.translate(0, LINK_ELBOW/2, 0);
        forearmGeom.rotateX(Math.PI/2);
        armWrist = new THREE.Mesh(forearmGeom, metalMaterial);
        scene.add(armWrist);
        
        // End effector / Tool mounting block
        const toolMountGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const toolMount = new THREE.Mesh(toolMountGeom, jointMaterial);
        // We will position this dynamically at TCP
        
        // Claw Base
        const clawBaseGeom = new THREE.BoxGeometry(0.1, 0.4, 0.1);
        const clawBase = new THREE.Mesh(clawBaseGeom, jointMaterial);
        clawBase.position.set(0, 0, 0);
        
        // Claw fingers
        const fingerGeom = new THREE.BoxGeometry(0.15, 0.05, 0.2);
        fingerGeom.translate(0, 0, 0.1);
        
        gripperClawLeft = new THREE.Mesh(fingerGeom, metalMaterial);
        gripperClawLeft.position.set(0, 0.15, 0.1);
        
        gripperClawRight = new THREE.Mesh(fingerGeom, metalMaterial);
        gripperClawRight.position.set(0, -0.15, 0.1);
        
        // Attach toolhead group to base or position directly in render loop
    }
    
    // Direct Joint Point Rendering
    // Places standard cylinders and pivots directly on computed joint coordinates
    function updateArmRendering() {
        const q1 = waistActuator.angle;
        const q2 = shoulderActuator.angle;
        const q3 = elbowActuator.angle;
        
        // Compute 3D locations of joints based on actual simulated angles
        const shoulderPos = new THREE.Vector3(0, LINK_BASE_HEIGHT, 0);
        
        const rc = LINK_SHOULDER * Math.cos(q2);
        const elbowPos = new THREE.Vector3(
            rc * Math.cos(q1),
            LINK_BASE_HEIGHT + LINK_SHOULDER * Math.sin(q2),
            rc * Math.sin(q1)
        );
        
        const rd = rc + LINK_ELBOW * Math.cos(q2 + q3);
        const tcpPos = new THREE.Vector3(
            rd * Math.cos(q1),
            LINK_BASE_HEIGHT + LINK_SHOULDER * Math.sin(q2) + LINK_ELBOW * Math.sin(q2 + q3),
            rd * Math.sin(q1)
        );
        
        actualPos = { x: tcpPos.x, y: tcpPos.y, z: tcpPos.z };
        
        // Position joint pivots
        armShoulder.position.copy(shoulderPos);
        armElbow.position.copy(elbowPos);
        
        // Align and scale Upper Arm Link (Shoulder -> Elbow)
        alignCylinder(armForearm, shoulderPos, elbowPos, LINK_SHOULDER);
        
        // Align and scale Forearm Link (Elbow -> TCP)
        alignCylinder(armWrist, elbowPos, tcpPos, LINK_ELBOW);
        
        // Handle active tools representation
        if (activeTool) {
            laserBeam.visible = true;
            // Laser points straight down from TCP to floor
            laserBeam.position.copy(tcpPos);
            const heightAboveFloor = tcpPos.y;
            laserBeam.scale.set(1, 1, heightAboveFloor);
            laserBeam.position.y = tcpPos.y / 2;
            laserBeam.rotation.set(Math.PI/2, 0, 0); // vertical cylinder
        } else {
            laserBeam.visible = false;
        }
        
        // Block picking interaction logic
        if (gripperState === 'CLOSE') {
            gripperVal = Math.min(1.0, gripperVal + 0.1);
            
            // Physical pick detection: if gripper closes and block is nearby, attach it
            if (!activeHeldBlock) {
                for (const block of virtualBlocks) {
                    const dist = tcpPos.distanceTo(block.mesh.position);
                    if (dist < 0.8 && !block.placed) {
                        activeHeldBlock = block;
                        break;
                    }
                }
            }
        } else {
            gripperVal = Math.max(0.0, gripperVal - 0.1);
            if (activeHeldBlock) {
                // Drop block, check if drop zone is a bin
                const dropPos = activeHeldBlock.mesh.position.clone();
                activeHeldBlock.mesh.position.y = 0.25; // Floor height for blocks
                activeHeldBlock = null;
                
                // If dropped near green bin or red bin, mark placed
                checkBlockSorting(dropPos);
            }
        }
        
        // Update held block position to match TCP
        if (activeHeldBlock) {
            activeHeldBlock.mesh.position.copy(tcpPos);
            activeHeldBlock.mesh.position.y -= 0.3; // hang slightly below toolhead
        }
    }
    
    // Aligns a cylinder mesh between two points
    function alignCylinder(cylinder, p1, p2, defaultLen) {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        cylinder.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
        
        // Scale cylinder length dynamically to fit distance
        cylinder.scale.set(1, 1, len / defaultLen);
        
        // Align axis (default cylinder points up Y, but we pre-rotated it to Z-axis in creation)
        const direction = dir.clone().normalize();
        const alignTarget = new THREE.Vector3(0, 0, 1); // Z-aligned cylinder
        cylinder.quaternion.setFromUnitVectors(alignTarget, direction);
    }
    
    function onWindowResize() {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    // ----------------------------------------------------
    // 3. TASK WORKPIECES SPANNING (PCB, Cubes, Bins)
    // ----------------------------------------------------
    function setupTaskWorkpieces() {
        // Clear old ones
        while (workpieceContainer.children.length > 0) {
            workpieceContainer.remove(workpieceContainer.children[0]);
        }
        virtualBlocks = [];
        activeHeldBlock = null;
        
        if (showPCB) {
            // Draw a green PCB plate
            const pcbGeom = new THREE.BoxGeometry(7.0, 0.1, 4.0);
            const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0c3c26, roughness: 0.5 });
            const pcb = new THREE.Mesh(pcbGeom, pcbMat);
            pcb.position.set(0, 0.05, 5.5);
            workpieceContainer.add(pcb);
            
            // Add tiny golden solder cylinders
            const pinGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8);
            const pinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
            
            const pinLocations = [
                { x: -2.5, z: 6.0 },
                { x: -1.5, z: 6.0 },
                { x: -0.5, z: 5.2 },
                { x: 0.5, z: 5.2 },
                { x: 1.5, z: 5.8 },
                { x: 2.3, z: 5.8 }
            ];
            
            pinLocations.forEach(loc => {
                const pin = new THREE.Mesh(pinGeom, pinMat);
                pin.position.set(loc.x, 0.15, loc.z);
                workpieceContainer.add(pin);
            });
        }
        
        if (showBins) {
            // 1. Conveyor Belt Platform
            const beltGeom = new THREE.BoxGeometry(12.0, 0.1, 1.2);
            const beltMat = new THREE.MeshStandardMaterial({ color: 0x1b2336, roughness: 0.8 });
            const belt = new THREE.Mesh(beltGeom, beltMat);
            belt.position.set(0.0, 0.4, 5.5);
            workpieceContainer.add(belt);
            
            // Conveyor legs
            const legGeom = new THREE.BoxGeometry(0.1, 0.4, 0.1);
            const legLocations = [-5.5, -2.5, 2.5, 5.5];
            legLocations.forEach(lx => {
                const legL = new THREE.Mesh(legGeom, beltMat);
                legL.position.set(lx, 0.2, 5.0);
                workpieceContainer.add(legL);
                const legR = new THREE.Mesh(legGeom, beltMat);
                legR.position.set(lx, 0.2, 6.0);
                workpieceContainer.add(legR);
            });
            
            // 2. Sorting Bins
            // PLASTIC (PET) Bin (Blue)
            const binPGeom = new THREE.BoxGeometry(1.4, 0.5, 1.4);
            const binPMat = new THREE.MeshStandardMaterial({ color: 0x007aff, roughness: 0.6, transparent: true, opacity: 0.8 });
            const binP = new THREE.Mesh(binPGeom, binPMat);
            binP.position.set(2.0, 0.25, 4.0);
            workpieceContainer.add(binP);
            
            // PAPER (Cardboard) Bin (Orange)
            const binCardMat = new THREE.MeshStandardMaterial({ color: 0xff9500, roughness: 0.6, transparent: true, opacity: 0.8 });
            const binCard = new THREE.Mesh(binPGeom, binCardMat);
            binCard.position.set(3.5, 0.25, 4.0);
            workpieceContainer.add(binCard);
            
            // METAL Recovery Bin (Steel grey)
            const binMMat = new THREE.MeshStandardMaterial({ color: 0x8e8e93, metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.8 });
            const binM = new THREE.Mesh(binPGeom, binMMat);
            binM.position.set(-3.8, 0.25, 3.5);
            workpieceContainer.add(binM);
            
            // RESIDUE Bin (Charcoal black)
            const binResMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9, transparent: true, opacity: 0.8 });
            const binRes = new THREE.Mesh(binPGeom, binResMat);
            binRes.position.set(5.5, 0.25, 5.5);
            workpieceContainer.add(binRes);
            
            // 3. AI Optical Scanner Bracket & Laser Sheet
            const archLegGeom = new THREE.BoxGeometry(0.12, 1.2, 0.12);
            const archLegL = new THREE.Mesh(archLegGeom, beltMat);
            archLegL.position.set(-2.5, 1.0, 6.2);
            workpieceContainer.add(archLegL);
            const archLegR = new THREE.Mesh(archLegGeom, beltMat);
            archLegR.position.set(-2.5, 1.0, 4.8);
            workpieceContainer.add(archLegR);
            const archCross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), beltMat);
            archCross.position.set(-2.5, 1.6, 5.5);
            workpieceContainer.add(archCross);
            
            const scannerSheetGeom = new THREE.PlaneGeometry(1.3, 1.1);
            scannerSheetGeom.rotateY(Math.PI/2);
            const scannerSheetMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
            const scannerSheet = new THREE.Mesh(scannerSheetGeom, scannerSheetMat);
            scannerSheet.position.set(-2.5, 0.95, 5.5);
            workpieceContainer.add(scannerSheet);
            
            // 4. Overbelt Cross Magnetic Separator
            const magnetGeom = new THREE.BoxGeometry(0.8, 0.4, 1.6);
            const magnetMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.9, roughness: 0.3 });
            const magnet = new THREE.Mesh(magnetGeom, magnetMat);
            magnet.position.set(-3.8, 1.4, 4.8);
            workpieceContainer.add(magnet);
            
            // 5. Spawn Waste Stream Objects
            const canGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.35, 12);
            const canMat = new THREE.MeshStandardMaterial({ color: 0x8e8e93, metalness: 0.9, roughness: 0.2 });
            
            const bottleGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12);
            const petMat = new THREE.MeshStandardMaterial({ color: 0x007aff, transparent: true, opacity: 0.7, roughness: 0.1 });
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x34c759, transparent: true, opacity: 0.6, roughness: 0.1 });
            
            const boxGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
            const cardMat = new THREE.MeshStandardMaterial({ color: 0xa28557, roughness: 0.9 });
            
            // Spawn items in staggered starting X coordinates
            // Item 1: Steel Can (Metal)
            const block1 = new THREE.Mesh(canGeom, canMat);
            block1.position.set(-5.0, 0.65, 5.5);
            block1.rotation.x = Math.PI / 2;
            workpieceContainer.add(block1);
            virtualBlocks.push({ mesh: block1, color: 'METAL', placed: false, scanned: false, lifting: false });
            
            // Item 2: PET Bottle (Plastic)
            const block2 = new THREE.Mesh(bottleGeom, petMat);
            block2.position.set(-7.5, 0.65, 5.5);
            workpieceContainer.add(block2);
            virtualBlocks.push({ mesh: block2, color: 'PET', placed: false, scanned: false });
            
            // Item 3: Glass Bottle (Contaminant)
            const block3 = new THREE.Mesh(bottleGeom, glassMat);
            block3.position.set(-10.0, 0.65, 5.5);
            workpieceContainer.add(block3);
            virtualBlocks.push({ mesh: block3, color: 'GLASS', placed: false, scanned: false });
            
            // Item 4: Cardboard Box (Paper)
            const block4 = new THREE.Mesh(boxGeom, cardMat);
            block4.position.set(-12.5, 0.65, 5.5);
            workpieceContainer.add(block4);
            virtualBlocks.push({ mesh: block4, color: 'CARDBOARD', placed: false, scanned: false });
            
            // Item 5: PET Bottle 2 (Plastic)
            const block5 = new THREE.Mesh(bottleGeom, petMat);
            block5.position.set(-15.0, 0.65, 5.5);
            workpieceContainer.add(block5);
            virtualBlocks.push({ mesh: block5, color: 'PET', placed: false, scanned: false });
        }
    }
    
    function checkBlockSorting(dropPos) {
        if (!activeHeldBlock) return;
        
        const block = activeHeldBlock;
        if (block.color === 'PET' && dropPos.x > 1.0 && dropPos.x < 3.0 && dropPos.z > 3.0 && dropPos.z < 5.0) {
            block.placed = true;
            block.mesh.position.set(2.0, 0.26, 4.0); // snap inside Plastic Bin
            showToast('PET Plastic Bottle successfully sorted & recycled!');
        } else if (block.color === 'CARDBOARD' && dropPos.x > 2.5 && dropPos.x < 4.5 && dropPos.z > 3.0 && dropPos.z < 5.0) {
            block.placed = true;
            block.mesh.position.set(3.5, 0.26, 4.0); // snap inside Paper Bin
            showToast('Cardboard Box successfully sorted & recycled!');
        }
    }
    
    // ----------------------------------------------------
    // 4. CUSTOM CANVAS SCROLLING PLOTS
    // ----------------------------------------------------
    function initCustomCharts() {
        // Populate historical arrays with zero values to start
        for (let i = 0; i < historyLimit; i++) {
            timeHistory.push(i);
            targetXHistory.push(0);
            actualXHistory.push(0);
            targetYHistory.push(0);
            actualYHistory.push(0);
            targetZHistory.push(0);
            actualZHistory.push(0);
            errorHistory.push(0);
        }
    }
    
    function recordTelemetry(tIdeal, tActual) {
        targetXHistory.shift(); targetXHistory.push(tIdeal.x);
        actualXHistory.shift(); actualXHistory.push(tActual.x);
        targetYHistory.shift(); targetYHistory.push(tIdeal.y);
        actualYHistory.shift(); actualYHistory.push(tActual.y);
        targetZHistory.shift(); targetZHistory.push(tIdeal.z);
        actualZHistory.shift(); actualZHistory.push(tActual.z);
        
        // Calculate Cartesian distance error
        const dx = tIdeal.x - tActual.x;
        const dy = tIdeal.y - tActual.y;
        const dz = tIdeal.z - tActual.z;
        const err = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        errorHistory.shift();
        errorHistory.push(err);
        
        // Update header readout
        document.getElementById('rms-error-display').textContent = `${err.toFixed(4)} units`;
    }
    
    function drawCanvasCharts() {
        drawPositionChart();
        drawErrorChart();
    }
    
    function drawPositionChart() {
        const canvas = document.getElementById('chart-position');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth;
        const h = canvas.height = canvas.parentElement.clientHeight;
        
        ctx.clearRect(0, 0, w, h);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(39, 52, 77, 0.3)';
        ctx.lineWidth = 1;
        
        // Horizontal lines
        const numH = 4;
        for (let i = 1; i < numH; i++) {
            const yLine = (h / numH) * i;
            ctx.beginPath();
            ctx.moveTo(0, yLine);
            ctx.lineTo(w, yLine);
            ctx.stroke();
        }
        
        // Labels
        ctx.font = '10px Fira Code';
        ctx.fillStyle = '#7e8c9f';
        ctx.fillText('Position Tracking (mm)', 10, 15);
        
        // Calculate scaling
        // Data range lies roughly within -6.0 to 10.0
        const minVal = -6.0;
        const maxVal = 10.0;
        const range = maxVal - minVal;
        
        function scaleY(val) {
            return h - ((val - minVal) / range) * h;
        }
        
        // Plot curves
        const step = w / historyLimit;
        
        // Draw actual values
        const signals = [
            { actual: actualXHistory, target: targetXHistory, colorAct: '#00f2fe', colorTar: 'rgba(0, 242, 254, 0.2)', label: 'X' },
            { actual: actualYHistory, target: targetYHistory, colorAct: '#ff9f0a', colorTar: 'rgba(255, 159, 10, 0.2)', label: 'Y' },
            { actual: actualZHistory, target: targetZHistory, colorAct: '#34c759', colorTar: 'rgba(52, 199, 89, 0.2)', label: 'Z' }
        ];
        
        signals.forEach(sig => {
            // Target path (dashed)
            ctx.strokeStyle = sig.colorTar;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(0, scaleY(sig.target[0]));
            for (let i = 1; i < historyLimit; i++) {
                ctx.lineTo(i * step, scaleY(sig.target[i]));
            }
            ctx.stroke();
            
            // Actual path (solid)
            ctx.strokeStyle = sig.colorAct;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(0, scaleY(sig.actual[0]));
            for (let i = 1; i < historyLimit; i++) {
                ctx.lineTo(i * step, scaleY(sig.actual[i]));
            }
            ctx.stroke();
        });
        
        // Draw key labels on right
        ctx.fillStyle = '#00f2fe'; ctx.fillText('X', w - 15, scaleY(actualXHistory[historyLimit-1]));
        ctx.fillStyle = '#ff9f0a'; ctx.fillText('Y', w - 15, scaleY(actualYHistory[historyLimit-1]));
        ctx.fillStyle = '#34c759'; ctx.fillText('Z', w - 15, scaleY(actualZHistory[historyLimit-1]));
    }
    
    function drawErrorChart() {
        const canvas = document.getElementById('chart-error');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth;
        const h = canvas.height = canvas.parentElement.clientHeight;
        
        ctx.clearRect(0, 0, w, h);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(39, 52, 77, 0.3)';
        ctx.lineWidth = 1;
        const numH = 4;
        for (let i = 1; i < numH; i++) {
            const yLine = (h / numH) * i;
            ctx.beginPath();
            ctx.moveTo(0, yLine);
            ctx.lineTo(w, yLine);
            ctx.stroke();
        }
        
        // Labels
        ctx.font = '10px Fira Code';
        ctx.fillStyle = '#7e8c9f';
        ctx.fillText('Absolute Deviation (mm)', 10, 15);
        
        // Scale for error: range 0.0 to 1.5 mm
        const maxErr = 1.0;
        function scaleY(val) {
            return h - (Math.min(maxErr, val) / maxErr) * (h - 20) - 5;
        }
        
        const step = w / historyLimit;
        
        // Draw filled gradient area
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255, 0, 127, 0.3)');
        grad.addColorStop(1, 'rgba(255, 0, 127, 0.0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < historyLimit; i++) {
            ctx.lineTo(i * step, scaleY(errorHistory[i]));
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        
        // Draw outline line
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scaleY(errorHistory[0]));
        for (let i = 1; i < historyLimit; i++) {
            ctx.lineTo(i * step, scaleY(errorHistory[i]));
        }
        ctx.stroke();
        
        // Draw current error text on right
        const currentErr = errorHistory[historyLimit - 1];
        ctx.fillStyle = '#ff007f';
        ctx.fillText(`${currentErr.toFixed(3)} mm`, w - 70, 20);
    }
    
    // ----------------------------------------------------
    // 5. 60HZ SIMULATION PHYSICS & CONTROLLER RUNNER
    // ----------------------------------------------------
    let lastTickTime = performance.now();
    
    function runSimulationStep() {
        const now = performance.now();
        let dt = (now - lastTickTime) / 1000.0;
        lastTickTime = now;
        
        // Clamp dt to avoid huge steps when app tab becomes inactive
        if (dt > 0.1) dt = 0.016;
        
        // Apply playback speed override
        const scaledDt = dt * simSpeedScale;
        
        // 1. Process Sequencer automation steps
        if (isPlaying && !isPaused) {
            updateSequencer(scaledDt);
        }
        
        // 2. Solve inverse kinematics for the ideal target position
        const ik = inverseKinematics(idealPos.x, idealPos.y, idealPos.z);
        if (ik.valid) {
            targetAngles.theta1 = ik.theta1;
            targetAngles.theta2 = ik.theta2;
            targetAngles.theta3 = ik.theta3;
        } else {
            // Out of range visual feedback
            document.getElementById('system-state').textContent = 'LIMIT OUT';
            document.getElementById('system-state').className = 'status-val state-error';
        }
        
        // 3. Compute dynamic gravity loadings for multi-joint arm
        const q2 = shoulderActuator.angle;
        const q3 = elbowActuator.angle;
        
        // Waist (j1): gravity acts parallel to axis of rotation -> 0 torque
        const gravityTorqueWaist = 0;
        
        // Shoulder (j2): lifts upper arm + forearm + payload
        // Torque = -G_constant * (InertialMass1 * cos(q2) + InertialMass2 * cos(q2 + q3))
        const gravityTorqueShoulder = -gravityConstant * (1.2 * Math.cos(q2) + 0.6 * Math.cos(q2 + q3));
        
        // Elbow (j3): lifts forearm + payload
        const gravityTorqueElbow = -gravityConstant * 0.6 * Math.cos(q2 + q3);
        
        // 4. Update individual physical joint motor loops
        // step(targetAngle, dt, friction, gravity, noise, backlash)
        waistActuator.step(targetAngles.theta1, scaledDt, jointFriction, gravityTorqueWaist, encoderNoise, gearBacklash);
        shoulderActuator.step(targetAngles.theta2, scaledDt, jointFriction, gravityTorqueShoulder, encoderNoise, gearBacklash);
        elbowActuator.step(targetAngles.theta3, scaledDt, jointFriction, gravityTorqueElbow, encoderNoise, gearBacklash);
        
        // 5. Compute TCP coordinates from actual physical joint angles
        const actFK = forwardKinematics(waistActuator.angle, shoulderActuator.angle, elbowActuator.angle);
        
        // 6. Record and plot tracking deviations
        recordTelemetry(idealPos, actFK);
        
        // 7. Push points to path visualizer
        if (showPathTrail) {
            // Limit coordinate arrays sizes to prevent RAM bloat
            if (pathIdealPoints.length > 500) pathIdealPoints.shift();
            if (pathActualPoints.length > 500) pathActualPoints.shift();
            
            // Add points if they moved enough
            const lastIdeal = pathIdealPoints[pathIdealPoints.length - 1];
            const lastActual = pathActualPoints[pathActualPoints.length - 1];
            
            const pIdealVec = new THREE.Vector3(idealPos.x, idealPos.y, idealPos.z);
            const pActualVec = new THREE.Vector3(actFK.x, actFK.y, actFK.z);
            
            if (!lastIdeal || pIdealVec.distanceTo(lastIdeal) > 0.05) {
                pathIdealPoints.push(pIdealVec);
                pathIdealGeom.setFromPoints(pathIdealPoints);
            }
            if (!lastActual || pActualVec.distanceTo(lastActual) > 0.05) {
                pathActualPoints.push(pActualVec);
                pathActualGeom.setFromPoints(pathActualPoints);
            }
        }
        
        // 8. Update Footer Telemetry values
        document.getElementById('j1-angle-val').textContent = `${(waistActuator.angle * 180 / Math.PI).toFixed(1)}°`;
        document.getElementById('j1-error-val').textContent = `Err: ${((targetAngles.theta1 - waistActuator.angle) * 180 / Math.PI).toFixed(2)}°`;
        
        document.getElementById('j2-angle-val').textContent = `${(shoulderActuator.angle * 180 / Math.PI).toFixed(1)}°`;
        document.getElementById('j2-error-val').textContent = `Err: ${((targetAngles.theta2 - shoulderActuator.angle) * 180 / Math.PI).toFixed(2)}°`;
        
        document.getElementById('j3-angle-val').textContent = `${(elbowActuator.angle * 180 / Math.PI).toFixed(1)}°`;
        document.getElementById('j3-error-val').textContent = `Err: ${((targetAngles.theta3 - elbowActuator.angle) * 180 / Math.PI).toFixed(2)}°`;
        
        document.getElementById('tcp-coords-display').textContent = `X: ${actFK.x.toFixed(2)}, Y: ${actFK.y.toFixed(2)}, Z: ${actFK.z.toFixed(2)}`;

        // 9. Update Conveyor belt items (if in recycling mode)
        if (showBins && isPlaying && !isPaused) {
            // Speed of conveyor (units per second)
            const beltSpeed = 0.6 * scaledDt; 
            
            virtualBlocks.forEach(block => {
                if (!block.placed && block !== activeHeldBlock) {
                    if (block.color === 'METAL') {
                        // Magnetic Sorter extraction
                        // If it enters the magnetic zone (X around -3.8)
                        if (block.mesh.position.x >= -4.2 && block.mesh.position.x <= -3.0 && !block.lifting) {
                            block.lifting = true;
                            showToast('Magnetic Belt: Extracted Steel Can!');
                        }
                        
                        if (block.lifting) {
                            // Fly the metal block towards the Metal Bin at X = -3.8, Y = 0.8, Z = 3.5
                            const targetBinPos = new THREE.Vector3(-3.8, 0.8, 3.5);
                            block.mesh.position.lerp(targetBinPos, 0.1);
                            if (block.mesh.position.distanceTo(targetBinPos) < 0.2) {
                                block.placed = true;
                                block.mesh.position.set(-3.8, 0.26, 3.5); // rest inside bin
                            }
                        } else {
                            // Move along belt
                            block.mesh.position.x += beltSpeed;
                        }
                    } else {
                        // Move other items along belt
                        block.mesh.position.x += beltSpeed;
                        
                        // Optical Sensor detection
                        if (!block.scanned && block.mesh.position.x >= -2.7 && block.mesh.position.x <= -2.3) {
                            block.scanned = true;
                            showToast(`AI Optical Scanner: Scanned ${block.color === 'PET' ? 'PET Plastic (Recyclable)' : block.color === 'CARDBOARD' ? 'Cardboard Box (Recyclable)' : 'Glass Bottle (Contaminant)'}`);
                        }
                        
                        // Fall off the end (Residue)
                        if (block.mesh.position.x > 5.5) {
                            block.placed = true;
                            // Drop it down into residue bin
                            block.mesh.position.set(5.5, 0.26, 5.5);
                            if (block.color === 'GLASS') {
                                showToast('Glass Bottle sorted to Residue Bin.');
                            } else {
                                showToast(`Missed Recyclable (${block.color}) lost to Residue Bin!`);
                            }
                        }
                    }
                }
            });
        }
    }
    
    // ----------------------------------------------------
    // 6. COMMAND EXECUTION INTERPRETER
    // ----------------------------------------------------
    function updateSequencer(dt) {
        if (currentStepIndex < 0 || currentStepIndex >= compiledProgram.length) {
            // Done with program!
            stopSequence();
            showToast('Movement Program Completed Successfully!');
            return;
        }
        
        const cmd = compiledProgram[currentStepIndex];
        
        // Update footer UI details
        document.getElementById('telemetry-step').textContent = `STEP: ${currentStepIndex + 1}/${compiledProgram.length}`;
        document.getElementById('telemetry-command').textContent = `CMD: ${cmd.type}`;
        
        // Highlight active code line in editor
        highlightEditorLine(cmd.lineIdx);
        
        if (waitTimer > 0) {
            // Wait command timer ticking
            waitTimer -= dt * 1000; // ms
            if (waitTimer <= 0) {
                waitTimer = 0;
                moveToNextStep();
            }
            return;
        }
        
        if (activeProfiler) {
            // Sample motion profiler trajectory
            sequenceTime += dt;
            const sample = activeProfiler.sample(sequenceTime);
            
            idealPos = sample.pos;
            
            // Speed telemetry updates
            document.getElementById('telemetry-velocity').textContent = `${sample.vel.toFixed(1)} mm/s`;
            document.getElementById('telemetry-acceleration').textContent = `Acc: ${sample.acc.toFixed(1)} mm/s²`;
            
            // Check if profile is complete
            if (sequenceTime >= activeProfiler.totalTime) {
                // Check if physical PID loops have settled within error bounds (0.04 rad ~ 2.2 degrees)
                const settled = actuators.every(act => {
                    const idx = actuators.indexOf(act);
                    const tAngle = (idx === 0) ? targetAngles.theta1 : (idx === 1) ? targetAngles.theta2 : targetAngles.theta3;
                    return Math.abs(tAngle - act.angle) < 0.04;
                });
                
                if (settled) {
                    activeProfiler = null;
                    moveToNextStep();
                } else {
                    // Holding/settling phase feedback
                    document.getElementById('system-state').textContent = 'SETTLING';
                    document.getElementById('system-state').className = 'status-val text-amber pulse-icon';
                }
            }
            return;
        }
        
        // Initialize new command execution
        switch (cmd.type) {
            case 'NOP':
                // Simply skip comments/empty lines
                moveToNextStep();
                break;
                
            case 'SPEED':
                maxVelocity = cmd.args.velocity || maxVelocity;
                maxAcceleration = cmd.args.acceleration || maxAcceleration;
                
                // Update UI sliders values
                document.getElementById('limit-vel').value = maxVelocity;
                document.getElementById('val-limit-vel').textContent = `${maxVelocity} mm/s`;
                document.getElementById('limit-acc').value = maxAcceleration;
                document.getElementById('val-limit-acc').textContent = `${maxAcceleration} mm/s²`;
                
                moveToNextStep();
                break;
                
            case 'WAIT':
                waitTimer = cmd.args.duration;
                break;
                
            case 'TOOL':
                activeTool = (cmd.args.state === 'ON');
                moveToNextStep();
                break;
                
            case 'GRIPPER':
                gripperState = cmd.args.state; // OPEN or CLOSE
                // Force a mechanical arm settling delay for physical claws to open/close
                waitTimer = 500;
                break;
                
            case 'HOME':
                // Plan move back to default home coordinate
                initiateLinearMove(HOME_POSITION);
                break;
                
            case 'MOVE':
                // Merge coordinate args into target pos
                const target = {
                    x: cmd.args.x !== undefined ? cmd.args.x : idealPos.x,
                    y: cmd.args.y !== undefined ? cmd.args.y : idealPos.y,
                    z: cmd.args.z !== undefined ? cmd.args.z : idealPos.z
                };
                
                const moveSpeed = cmd.args.f !== undefined ? cmd.args.f : maxVelocity;
                initiateLinearMove(target, moveSpeed);
                break;
                
            case 'ERROR':
                // Stop program execution, flag compiler syntax error
                stopSequence();
                document.getElementById('system-state').textContent = 'SYNTAX ERR';
                document.getElementById('system-state').className = 'status-val state-error';
                alert(`MotionScript Compiler Error on line ${cmd.lineIdx + 1}: ${cmd.errorMsg}`);
                break;
                
            default:
                moveToNextStep();
                break;
        }
    }
    
    function initiateLinearMove(target, speedOverride = maxVelocity) {
        activeProfiler = new TrapezoidalProfiler(idealPos, target, speedOverride, maxAcceleration);
        sequenceTime = 0;
    }
    
    function moveToNextStep() {
        currentStepIndex++;
    }
    
    // ----------------------------------------------------
    // 7. SEQUENCER PLAYBACK OPERATIONS
    // ----------------------------------------------------
    function runSequence() {
        const text = document.getElementById('code-textarea').value;
        compiledProgram = compileSequence(text);
        
        if (compiledProgram.length === 0) return;
        
        isPlaying = true;
        isPaused = false;
        
        if (currentStepIndex === -1) {
            currentStepIndex = 0;
        }
        
        document.getElementById('btn-play').disabled = true;
        document.getElementById('btn-pause').disabled = false;
        document.getElementById('btn-stop').disabled = false;
        document.getElementById('btn-step').disabled = true;
        document.getElementById('task-select').disabled = true;
        
        document.getElementById('system-state').textContent = 'RUNNING';
        document.getElementById('system-state').className = 'status-val state-running';
    }
    
    function pauseSequence() {
        isPaused = true;
        isPlaying = false;
        
        document.getElementById('btn-play').disabled = false;
        document.getElementById('btn-pause').disabled = true;
        document.getElementById('btn-step').disabled = false;
        
        document.getElementById('system-state').textContent = 'PAUSED';
        document.getElementById('system-state').className = 'status-val state-paused';
    }
    
    function stopSequence() {
        isPlaying = false;
        isPaused = false;
        currentStepIndex = -1;
        activeProfiler = null;
        waitTimer = 0;
        activeTool = false;
        
        document.getElementById('btn-play').disabled = false;
        document.getElementById('btn-pause').disabled = true;
        document.getElementById('btn-stop').disabled = true;
        document.getElementById('btn-step').disabled = false;
        document.getElementById('task-select').disabled = false;
        
        document.getElementById('system-state').textContent = 'IDLE';
        document.getElementById('system-state').className = 'status-val state-idle';
        
        document.getElementById('telemetry-velocity').textContent = '0.0 mm/s';
        document.getElementById('telemetry-acceleration').textContent = 'Acc: 0.0 mm/s²';
        
        // Remove code highlight layer
        removeEditorLineHighlight();
        
        // Reset gripper blocks state
        setupTaskWorkpieces();
    }
    
    function runStep() {
        const text = document.getElementById('code-textarea').value;
        compiledProgram = compileSequence(text);
        
        if (compiledProgram.length === 0) return;
        
        if (currentStepIndex === -1) {
            currentStepIndex = 0;
        }
        
        // Run once
        isPlaying = true;
        isPaused = true; // behaves as single step
        
        document.getElementById('btn-stop').disabled = false;
        document.getElementById('system-state').textContent = 'STEPPING';
        document.getElementById('system-state').className = 'status-val state-paused';
        
        // Execute a step
        const prevIdx = currentStepIndex;
        
        // Loop simulation until the active command state advances to next line
        let safetyCounter = 0;
        const tickRate = 1 / 60;
        
        // We step run the interpreter forward. If it was a move, it will initialize
        // and pause immediately. The animation loop will tick it.
        updateSequencer(tickRate);
        
        if (currentStepIndex === prevIdx && !activeProfiler && waitTimer === 0) {
            // Simple command executed instantly, advance once
            currentStepIndex++;
        }
    }
    
    // ----------------------------------------------------
    // 8. TEXTAREA SYNTAX & LINE HIGHLIGHTS
    // ----------------------------------------------------
    function syncLineNumbers() {
        const textarea = document.getElementById('code-textarea');
        const numCol = document.getElementById('line-numbers');
        const linesCount = textarea.value.split('\n').length;
        
        let html = '';
        for (let i = 1; i <= linesCount; i++) {
            html += `<span>${i}</span>`;
        }
        numCol.innerHTML = html;
        
        updateCodeExporters();
    }
    
    function highlightEditorLine(lineIdx) {
        const textarea = document.getElementById('code-textarea');
        const lineNums = document.getElementById('line-numbers').children;
        
        // Clear old highlights
        for (let num of lineNums) {
            num.classList.remove('active-line-num');
        }
        
        // Highlight line number
        if (lineNums[lineIdx]) {
            lineNums[lineIdx].classList.add('active-line-num');
        }
        
        // Place visual line overlay layer
        let overlay = document.getElementById('active-line-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'active-line-overlay';
            overlay.className = 'active-code-line';
            document.querySelector('.code-editor-wrapper').appendChild(overlay);
        }
        
        // Set height vertical position based on line index
        // line-height is 20px, top padding is 10px
        overlay.style.top = `${10 + (lineIdx * 20)}px`;
    }
    
    function removeEditorLineHighlight() {
        const lineNums = document.getElementById('line-numbers').children;
        for (let num of lineNums) {
            num.classList.remove('active-line-num');
        }
        const overlay = document.getElementById('active-line-overlay');
        if (overlay) overlay.remove();
    }
    
    function updateCodeExporters() {
        const text = document.getElementById('code-textarea').value;
        const compiled = compileSequence(text);
        
        const gcode = generateGCode(compiled);
        const arduino = generateArduinoCode(compiled);
        
        document.getElementById('code-gcode-output').textContent = gcode;
        document.getElementById('code-arduino-output').textContent = arduino;
    }
    
    // ----------------------------------------------------
    // 9. EVENT BINDINGS & UI CONFIG
    // ----------------------------------------------------
    function setupUIEvents() {
        // Preset Select Loader
        const select = document.getElementById('task-select');
        select.addEventListener('change', () => {
            const presetVal = select.value;
            const codeText = TASK_PRESETS[presetVal];
            
            // Adjust workpiece visibility for different tasks
            showPCB = (presetVal === 'preset-solder');
            showBins = (presetVal === 'preset-pickplace');
            
            document.getElementById('code-textarea').value = codeText;
            syncLineNumbers();
            
            // Reset arm position
            stopSequence();
            idealPos = { ...HOME_POSITION };
            actuators.forEach(act => {
                const ik = inverseKinematics(HOME_POSITION.x, HOME_POSITION.y, HOME_POSITION.z);
                act.reset(actuators.indexOf(act) === 0 ? ik.theta1 : actuators.indexOf(act) === 1 ? ik.theta2 : ik.theta3);
            });
            
            pathIdealPoints.length = 0;
            pathActualPoints.length = 0;
            pathIdealGeom.setFromPoints([]);
            pathActualGeom.setFromPoints([]);
        });
        
        // Textarea scroll & line number sync
        const textarea = document.getElementById('code-textarea');
        textarea.addEventListener('input', syncLineNumbers);
        textarea.addEventListener('scroll', () => {
            document.getElementById('line-numbers').scrollTop = textarea.scrollTop;
        });
        
        // Playback Action buttons
        document.getElementById('btn-play').addEventListener('click', runSequence);
        document.getElementById('btn-pause').addEventListener('click', pauseSequence);
        document.getElementById('btn-stop').addEventListener('click', stopSequence);
        document.getElementById('btn-step').addEventListener('click', runStep);
        
        // PID Sliders bindings
        bindSlider('gain-kp', 'val-kp', '', val => {
            actuators.forEach(act => act.pid.kp = val);
        });
        bindSlider('gain-ki', 'val-ki', '', val => {
            actuators.forEach(act => act.pid.ki = val);
        });
        bindSlider('gain-kd', 'val-kd', '', val => {
            actuators.forEach(act => act.pid.kd = val);
        });
        
        // Physical disturbances bindings
        bindSlider('dist-backlash', 'val-backlash', ' mm', val => gearBacklash = val);
        bindSlider('dist-friction', 'val-friction', ' N·m', val => jointFriction = val);
        bindSlider('dist-gravity', 'val-gravity', ' m/s²', val => gravityConstant = val);
        bindSlider('dist-noise', 'val-noise', ' mm', val => encoderNoise = val);
        
        // Dynamc limits bindings
        bindSlider('limit-vel', 'val-limit-vel', ' mm/s', val => maxVelocity = val);
        bindSlider('limit-acc', 'val-limit-acc', ' mm/s²', val => maxAcceleration = val);
        bindSlider('sim-speed', 'val-sim-speed', 'x', val => simSpeedScale = val);
        
        // Tabs Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });
        
        // Editor view tabs
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.editor-view').forEach(v => v.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tab.dataset.editor).classList.add('active');
                
                if (tab.dataset.editor !== 'editor-raw') {
                    updateCodeExporters();
                }
            });
        });
        
        // Copy buttons bindings
        document.getElementById('btn-copy-arduino').addEventListener('click', () => {
            copyTextToClipboard(document.getElementById('code-arduino-output').textContent);
            showToast('Arduino code copied to clipboard!');
        });
        
        document.getElementById('btn-copy-gcode').addEventListener('click', () => {
            copyTextToClipboard(document.getElementById('code-gcode-output').textContent);
            showToast('G-Code copied to clipboard!');
        });
        
        // Viewport utility buttons
        document.getElementById('btn-toggle-grid').addEventListener('click', e => {
            showGrid = !showGrid;
            document.getElementById('btn-toggle-grid').classList.toggle('active', showGrid);
            scene.traverse(node => {
                if (node instanceof THREE.GridHelper) {
                    node.visible = showGrid;
                }
            });
        });
        
        document.getElementById('btn-toggle-trail').addEventListener('click', e => {
            showPathTrail = !showPathTrail;
            document.getElementById('btn-toggle-trail').classList.toggle('active', showPathTrail);
            if (!showPathTrail) {
                pathIdealPoints.length = 0;
                pathActualPoints.length = 0;
                pathIdealGeom.setFromPoints([]);
                pathActualGeom.setFromPoints([]);
            }
        });
        
        document.getElementById('btn-clear-trail').addEventListener('click', () => {
            pathIdealPoints.length = 0;
            pathActualPoints.length = 0;
            pathIdealGeom.setFromPoints([]);
            pathActualGeom.setFromPoints([]);
            showToast('Visual path trail cleared.');
        });
        
        document.getElementById('btn-reset-view').addEventListener('click', () => {
            camera.position.set(10, 10, 12);
            orbitControls.target.set(0, 4, 0);
            orbitControls.update();
        });
        
        let wireframeMode = false;
        document.getElementById('btn-toggle-wireframe').addEventListener('click', () => {
            wireframeMode = !wireframeMode;
            document.getElementById('btn-toggle-wireframe').classList.toggle('active', wireframeMode);
            scene.traverse(node => {
                if (node instanceof THREE.Mesh && node !== laserBeam) {
                    node.material.wireframe = wireframeMode;
                }
            });
        });
        
        // Initialize default preset on load
        select.dispatchEvent(new Event('change'));
    }
    
    function bindSlider(sliderId, valueId, suffix, callback) {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(valueId);
        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            label.textContent = val + suffix;
            callback(val);
        });
    }
    
    function copyTextToClipboard(text) {
        navigator.clipboard.writeText(text);
    }
    
    function showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toast-message').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }
    
    // ----------------------------------------------------
    // 10. MAIN ANIMATION & RENDERING LOOP
    // ----------------------------------------------------
    function animate() {
        requestAnimationFrame(animate);
        
        // Run physics integration step
        runSimulationStep();
        
        // Update threejs robotic arm geometry based on actual physical values
        updateArmRendering();
        
        // Redraw canvas telemetry scroll charts
        drawCanvasCharts();
        
        // Update orbit controls damping
        orbitControls.update();
        
        // Render viewport
        renderer.render(scene, camera);
    }
    
    // ----------------------------------------------------
    // 11. BOOTSTRAP STARTUP
    // ----------------------------------------------------
    init3D();
    initCustomCharts();
    setupUIEvents();
    animate();
});
