// Kinematics and Motion Profiling Module

// Robotic arm physical dimension constants (in mm / units)
const LINK_BASE_HEIGHT = 2.5; // Height of base stand
const LINK_SHOULDER = 4.0;    // Length of first arm link (Link 2)
const LINK_ELBOW = 3.5;       // Length of second arm link (Link 3)

/**
 * Forward Kinematics (FK)
 * Calculates the Tool Center Point (TCP) (X, Y, Z) coordinates from joint angles.
 * @param {number} theta1 - Waist angle (rotation around Y-axis, in radians)
 * @param {number} theta2 - Shoulder angle (pitch, relative to horizontal, in radians)
 * @param {number} theta3 - Elbow angle (pitch, relative to shoulder link, in radians)
 * @returns {Object} {x, y, z} coordinates
 */
function forwardKinematics(theta1, theta2, theta3) {
    // Distance in the XZ plane from base rotation center
    const R = LINK_SHOULDER * Math.cos(theta2) + LINK_ELBOW * Math.cos(theta2 + theta3);
    
    // Vertical height (Y-axis)
    const Y = LINK_BASE_HEIGHT + LINK_SHOULDER * Math.sin(theta2) + LINK_ELBOW * Math.sin(theta2 + theta3);
    
    // X and Z coordinates projection
    const X = R * Math.cos(theta1);
    const Z = R * Math.sin(theta1);
    
    return { x: X, y: Y, z: Z };
}

/**
 * Inverse Kinematics (IK)
 * Calculates the joint angles required to reach a target coordinate (X, Y, Z).
 * Handles workspace limit clamping to prevent mathematical singularities.
 * @param {number} x - Target X
 * @param {number} y - Target Y
 * @param {number} z - Target Z
 * @returns {Object} Joint angles in radians and validation state
 */
function inverseKinematics(x, y, z) {
    // 1. Waist Rotation (Angle around Y axis)
    const theta1 = Math.atan2(z, x);
    
    // 2. Compute planar coordinates
    const R = Math.sqrt(x * x + z * z);
    const yRel = y - LINK_BASE_HEIGHT; // height offset relative to shoulder joint
    
    // 3. Distance from shoulder joint to target point
    let D = Math.sqrt(R * R + yRel * yRel);
    let clamped = false;
    
    // Safety boundary constraints
    const maxReach = LINK_SHOULDER + LINK_ELBOW;
    const minReach = Math.abs(LINK_SHOULDER - LINK_ELBOW);
    
    if (D > maxReach) {
        // Target is out of reach, scale target to max reach boundary
        const scale = (maxReach - 0.001) / D;
        D = maxReach - 0.001;
        clamped = true;
    } else if (D < minReach) {
        // Target is too close to base
        D = minReach + 0.001;
        clamped = true;
    }
    
    // Re-adjust R and yRel if clamped
    let targetR = R;
    let targetYRel = yRel;
    if (clamped) {
        const ratio = D / Math.sqrt(R * R + yRel * yRel);
        targetR = R * ratio;
        targetYRel = yRel * ratio;
    }
    
    // 4. Angle of target relative to shoulder center
    const alpha = Math.atan2(targetYRel, targetR);
    
    // 5. Compute inner angle beta (Law of Cosines)
    // cos(beta) = (L2^2 + D^2 - L3^2) / (2 * L2 * D)
    const cosBeta = (LINK_SHOULDER * LINK_SHOULDER + D * D - LINK_ELBOW * LINK_ELBOW) / (2 * LINK_SHOULDER * D);
    const clampedCosBeta = Math.max(-1.0, Math.min(1.0, cosBeta));
    const beta = Math.acos(clampedCosBeta);
    
    // 6. Shoulder Angle (theta2) - standard elbow-up config
    const theta2 = alpha + beta;
    
    // 7. Compute inner angle gamma at the elbow (Law of Cosines)
    // cos(gamma) = (L2^2 + L3^2 - D^2) / (2 * L2 * L3)
    const cosGamma = (LINK_SHOULDER * LINK_SHOULDER + LINK_ELBOW * LINK_ELBOW - D * D) / (2 * LINK_SHOULDER * LINK_ELBOW);
    const clampedCosGamma = Math.max(-1.0, Math.min(1.0, cosGamma));
    const gamma = Math.acos(clampedCosGamma);
    
    // Elbow angle (theta3) relative to shoulder link axis
    // If aligned (straight arm), theta3 = 0. Fully folded elbow is -180 deg.
    const theta3 = -(Math.PI - gamma);
    
    return {
        theta1: theta1,
        theta2: theta2,
        theta3: theta3,
        valid: !clamped,
        clampedX: targetR * Math.cos(theta1),
        clampedY: targetYRel + LINK_BASE_HEIGHT,
        clampedZ: targetR * Math.sin(theta1)
    };
}

/**
 * Trapezoidal Velocity Motion Profiler
 * Computes smooth transition coordinates between two 3D vectors.
 */
class TrapezoidalProfiler {
    /**
     * @param {Object} startPt - {x, y, z} start coordinate
     * @param {Object} endPt - {x, y, z} target coordinate
     * @param {number} maxVel - Max velocity limit (units/sec)
     * @param {number} maxAcc - Max acceleration limit (units/sec^2)
     */
    constructor(startPt, endPt, maxVel, maxAcc) {
        this.start = { ...startPt };
        this.end = { ...endPt };
        this.maxVel = maxVel;
        this.maxAcc = maxAcc;
        
        // Calculate total linear distance
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;
        const dz = this.end.z - this.start.z;
        this.distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // If distance is near zero, set zero times
        if (this.distance < 0.0001) {
            this.ta = 0;
            this.tc = 0;
            this.td = 0;
            this.totalTime = 0;
            this.vPeak = 0;
            return;
        }
        
        // Time required to accelerate to maxVel
        this.ta = maxVel / maxAcc;
        // Distance covered during acceleration
        const da = 0.5 * maxAcc * this.ta * this.ta;
        
        if (2 * da > this.distance) {
            // Triangular profile (cannot reach full velocity)
            this.vPeak = Math.sqrt(this.distance * maxAcc);
            this.ta = this.vPeak / maxAcc;
            this.tc = 0;
            this.td = this.ta;
        } else {
            // Trapezoidal profile
            this.vPeak = maxVel;
            const dc = this.distance - 2 * da;
            this.tc = dc / maxVel;
            this.td = this.ta;
        }
        
        this.totalTime = this.ta + this.tc + this.td;
    }
    
    /**
     * Samples position, velocity, and acceleration at a specific elapsed time t.
     * @param {number} t - Elapsed time in seconds
     * @returns {Object} {pos: {x,y,z}, vel, acc}
     */
    sample(t) {
        if (this.distance < 0.0001 || t >= this.totalTime) {
            return { pos: { ...this.end }, vel: 0, acc: 0 };
        }
        if (t <= 0) {
            return { pos: { ...this.start }, vel: 0, acc: 0 };
        }
        
        let d = 0;   // Accumulated distance along path
        let vel = 0; // Instantaneous velocity
        let acc = 0; // Instantaneous acceleration
        
        const ta = this.ta;
        const tc = this.tc;
        const td = this.td;
        const maxAcc = this.maxAcc;
        const vPeak = this.vPeak;
        
        if (t < ta) {
            // 1. Acceleration phase
            d = 0.5 * maxAcc * t * t;
            vel = maxAcc * t;
            acc = maxAcc;
        } else if (t < ta + tc) {
            // 2. Constant velocity cruise phase
            const da = 0.5 * maxAcc * ta * ta;
            d = da + vPeak * (t - ta);
            vel = vPeak;
            acc = 0;
        } else {
            // 3. Deceleration phase
            const tDec = t - (ta + tc);
            const da = 0.5 * maxAcc * ta * ta;
            const dc = vPeak * tc;
            d = da + dc + vPeak * tDec - 0.5 * maxAcc * tDec * tDec;
            vel = vPeak - maxAcc * tDec;
            acc = -maxAcc;
        }
        
        // Ensure distance doesn't overshoot
        d = Math.max(0, Math.min(this.distance, d));
        
        // Map 1D distance back to 3D line vector
        const ratio = d / this.distance;
        const x = this.start.x + ratio * (this.end.x - this.start.x);
        const y = this.start.y + ratio * (this.end.y - this.start.y);
        const z = this.start.z + ratio * (this.end.z - this.start.z);
        
        return {
            pos: { x, y, z },
            vel: vel,
            acc: acc
        };
    }
}
