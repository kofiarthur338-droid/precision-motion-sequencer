// Closed-Loop Control and Actuator Physics Simulation

/**
 * PID Controller Class
 */
class PIDController {
    /**
     * @param {number} kp - Proportional Gain
     * @param {number} ki - Integral Gain
     * @param {number} kd - Derivative Gain
     */
    constructor(kp, ki, kd) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        
        this.prevError = 0;
        this.integral = 0;
        this.integralLimit = 5.0; // Prevent windup (clamped in Newton-meters equivalent)
    }
    
    /**
     * Updates PID and returns control force/torque output
     * @param {number} target - Desired state
     * @param {number} actual - Current state
     * @param {number} dt - Time step (seconds)
     * @returns {number} Torque output
     */
    update(target, actual, dt) {
        const error = target - actual;
        
        // Integral term with accumulation clamping (anti-windup)
        this.integral += error * dt;
        this.integral = Math.max(-this.integralLimit, Math.min(this.integralLimit, this.integral));
        
        // Derivative term (rate of change of error)
        const derivative = (error - this.prevError) / dt;
        this.prevError = error;
        
        // Output control signal
        return (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);
    }
    
    reset() {
        this.prevError = 0;
        this.integral = 0;
    }
}

/**
 * JointActuator Class
 * Simulates a single motor-driven joint with physical properties
 */
class JointActuator {
    /**
     * @param {string} name - Joint name
     * @param {number} startAngle - Initial angle in radians
     * @param {number} inertia - Moment of inertia (kg*m^2)
     * @param {number} torqueLimit - Max torque the motor can generate (N-m)
     */
    constructor(name, startAngle, inertia, torqueLimit) {
        this.name = name;
        this.angle = startAngle;        // Physical joint angle (output side)
        this.motorAngle = startAngle;   // Motor rotor angle (input side, before backlash)
        this.velocity = 0;              // Angular velocity (rad/s)
        this.inertia = inertia;
        this.torqueLimit = torqueLimit;
        
        this.pid = new PIDController(15.0, 2.0, 6.0); // Default gains
    }
    
    /**
     * Executes a physics simulation step
     * @param {number} targetAngle - Target setpoint angle (radians)
     * @param {number} dt - Step duration (seconds)
     * @param {number} frictionCoeff - Viscous friction parameter
     * @param {number} gravityTorque - Static load pulling on joint (N-m)
     * @param {number} noiseLevel - Sensor/encoder feedback noise standard deviation
     * @param {number} backlashLevel - Mechanical slack/play in gears (radians)
     */
    step(targetAngle, dt, frictionCoeff, gravityTorque, noiseLevel, backlashLevel) {
        // 1. Simulate closed-loop sensor feedback with electrical noise
        const noise = (Math.random() - 0.5) * noiseLevel;
        const measuredAngle = this.angle + noise;
        
        // 2. Run PID calculation based on measured angle (closed-loop)
        let motorTorque = this.pid.update(targetAngle, measuredAngle, dt);
        
        // 3. Torque saturation (physical motor limits)
        motorTorque = Math.max(-this.torqueLimit, Math.min(this.torqueLimit, motorTorque));
        
        // 4. Resistance forces: Viscous friction + Coulomb stick-slip estimation
        const frictionTorque = -(frictionCoeff * this.velocity) - (0.02 * Math.sign(this.velocity || 0.001));
        
        // 5. Total physical forces acting on motor rotor
        const netTorque = motorTorque + gravityTorque + frictionTorque;
        
        // 6. Integrate acceleration -> motor velocity -> motor position (Euler integration)
        const acceleration = netTorque / this.inertia;
        this.velocity += acceleration * dt;
        
        // Clamp velocity to avoid runaway states during wild PID configurations
        const maxVelocityLimit = 15.0; // rad/s
        this.velocity = Math.max(-maxVelocityLimit, Math.min(maxVelocityLimit, this.velocity));
        
        this.motorAngle += this.velocity * dt;
        
        // 7. Apply Gear Backlash model (deadband coupling between motor rotor and arm link)
        // Joint angle follows motor angle, lagging by backlash width
        const B = backlashLevel * 0.02; // Convert millimeter backlash parameter to radians
        if (this.angle < this.motorAngle - B) {
            this.angle = this.motorAngle - B;
        } else if (this.angle > this.motorAngle + B) {
            this.angle = this.motorAngle + B;
        }
        // If motor angle is within backlash zone, joint angle does not change (free play)
    }
    
    reset(startAngle) {
        this.angle = startAngle;
        this.motorAngle = startAngle;
        this.velocity = 0;
        this.pid.reset();
    }
}
