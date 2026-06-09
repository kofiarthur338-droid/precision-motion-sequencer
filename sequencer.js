// Motion Sequencer, Preset Programs, and Code Exporter Module

// Default home position in Cartesian coordinates
const HOME_POSITION = { x: 0.0, y: 6.5, z: 2.0 };

// Task presets definition
const TASK_PRESETS = {
    'preset-engrave': 
`; LASER ENGRAVING PROFILE
; Traces a complex Lissajous geometric pattern
; High acceleration, low tool offsets

SPEED 180 300
HOME
WAIT 500

; Position to engrave start
MOVE X -2.5 Y 5.5 Z 1.0
TOOL ON
WAIT 200

; Lissajous Trajectory tracing
MOVE X -2.2 Y 5.9 Z 1.0
MOVE X -1.5 Y 6.2 Z 1.0
MOVE X -0.5 Y 6.1 Z 1.0
MOVE X 0.5 Y 5.7 Z 1.0
MOVE X 1.5 Y 5.3 Z 1.0
MOVE X 2.2 Y 5.1 Z 1.0
MOVE X 2.5 Y 5.5 Z 1.0
MOVE X 2.2 Y 6.1 Z 1.0
MOVE X 1.5 Y 6.5 Z 1.0
MOVE X 0.5 Y 6.6 Z 1.0
MOVE X -0.5 Y 6.3 Z 1.0
MOVE X -1.5 Y 5.7 Z 1.0
MOVE X -2.2 Y 5.1 Z 1.0
MOVE X -2.5 Y 5.5 Z 1.0
MOVE X -1.8 Y 6.2 Z 1.0
MOVE X -0.8 Y 6.5 Z 1.0
MOVE X 0.2 Y 6.4 Z 1.0
MOVE X 1.2 Y 5.9 Z 1.0
MOVE X 1.8 Y 5.2 Z 1.0
MOVE X 2.0 Y 4.8 Z 1.0
MOVE X 1.2 Y 4.5 Z 1.0
MOVE X 0.0 Y 4.8 Z 1.0
MOVE X -1.2 Y 5.2 Z 1.0
MOVE X -2.0 Y 5.0 Z 1.0
MOVE X -1.8 Y 4.5 Z 1.0
MOVE X -0.8 Y 4.2 Z 1.0
MOVE X 0.8 Y 4.2 Z 1.0
MOVE X 1.8 Y 4.5 Z 1.0
MOVE X 2.5 Y 5.5 Z 1.0

TOOL OFF
WAIT 500
HOME`,

    'preset-solder':
`; PRECISION PCB SOLDERING SEQUENCE
; Moves to component solder joints, lowers tool,
; applies heat, raises tool and repeats.

SPEED 90 140
HOME

; Joint 1: Resistor R1 Left Pin
MOVE X -2.5 Y 6.0 Z 2.5
MOVE X -2.5 Y 6.0 Z 1.2
TOOL ON
WAIT 600
TOOL OFF
MOVE X -2.5 Y 6.0 Z 2.5

; Joint 2: Resistor R1 Right Pin
MOVE X -1.5 Y 6.0 Z 2.5
MOVE X -1.5 Y 6.0 Z 1.2
TOOL ON
WAIT 600
TOOL OFF
MOVE X -1.5 Y 6.0 Z 2.5

; Joint 3: Capacitor C1 Left Pin
MOVE X -0.5 Y 5.2 Z 2.5
MOVE X -0.5 Y 5.2 Z 1.2
TOOL ON
WAIT 700
TOOL OFF
MOVE X -0.5 Y 5.2 Z 2.5

; Joint 4: Capacitor C1 Right Pin
MOVE X 0.5 Y 5.2 Z 2.5
MOVE X 0.5 Y 5.2 Z 1.2
TOOL ON
WAIT 700
TOOL OFF
MOVE X 0.5 Y 5.2 Z 2.5

; Joint 5: IC Pin 1
MOVE X 1.5 Y 5.8 Z 2.5
MOVE X 1.5 Y 5.8 Z 1.2
TOOL ON
WAIT 400
TOOL OFF
MOVE X 1.5 Y 5.8 Z 2.5

; Joint 6: IC Pin 2
MOVE X 2.3 Y 5.8 Z 2.5
MOVE X 2.3 Y 5.8 Z 1.2
TOOL ON
WAIT 400
TOOL OFF
MOVE X 2.3 Y 5.8 Z 2.5

HOME`,

    'preset-pickplace':
`; AUTOMATED MRF RECYCLING SORTER
; Reference: Factora's "Entire Recycling Process Explained"
; Simulates industrial sorting systems:
; - Magnetic overbelt automatically extracts Steel Cans.
; - AI Optical Sensor classifies items (PET, Cardboard, Glass).
; - High-speed Robotic Picker intercepts PET and Cardboard.

SPEED 145 220
HOME

; --- RECYCLING INTERCEPTION CYCLES ---
; The robot coordinates moves to grab moving targets.

; Cycle 1: Intercept PET Bottle (Blue Cylinder)
MOVE X -2.0 Y 2.5 Z 5.5
MOVE X -2.0 Y 1.0 Z 5.5
GRIPPER CLOSE
WAIT 300
MOVE X -2.0 Y 2.5 Z 5.5

; Deposit in Plastic Bin
MOVE X 2.0 Y 2.5 Z 4.0
MOVE X 2.0 Y 1.5 Z 4.0
GRIPPER OPEN
WAIT 300
MOVE X 2.0 Y 2.5 Z 4.0

; Cycle 2: Intercept Cardboard Box (Brown Cube)
MOVE X -1.0 Y 2.5 Z 5.5
MOVE X -1.0 Y 1.0 Z 5.5
GRIPPER CLOSE
WAIT 300
MOVE X -1.0 Y 2.5 Z 5.5

; Deposit in Paper Bin
MOVE X 3.5 Y 2.5 Z 4.0
MOVE X 3.5 Y 1.5 Z 4.0
GRIPPER OPEN
WAIT 300
MOVE X 3.5 Y 2.5 Z 4.0

HOME`,

    'preset-sweep':
`; FULL JOINT ANGULAR SWEEP
; Sweeps all joints through extreme range limits
; Waist rotation, shoulder elevation, elbow flexion

SPEED 120 180
HOME
WAIT 500

; 1. Wide Left Reach (Waist rotation extreme negative)
MOVE X -5.0 Y 3.0 Z 4.0
WAIT 500

; 2. Wide Right Reach (Waist rotation extreme positive)
MOVE X 5.0 Y 3.0 Z 4.0
WAIT 500

; 3. Max Overhead Height (Shoulder & elbow fully vertical)
MOVE X 0.0 Y 9.0 Z 1.0
WAIT 500

; 4. Minimum Retraction (Elbow fully folded, shoulder back)
MOVE X 0.0 Y 3.5 Z 1.2
WAIT 500

; 5. Ground Level Horizontal Sweep (Sweeping left to right)
MOVE X -3.5 Y 1.2 Z 4.0
MOVE X 3.5 Y 1.2 Z 4.0
WAIT 500

HOME`,

    'preset-custom':
`; CUSTOM PROGRAM
; Edit this script to write custom paths
SPEED 100 150
HOME
MOVE X 2.0 Y 5.0 Z 3.0
WAIT 1000
MOVE X -2.0 Y 6.0 Z 2.0
HOME`
};

/**
 * Parses MotionScript text line-by-line and compiles it into execution tokens
 * @param {string} text - Raw MotionScript source text
 * @returns {Array} List of executable command objects
 */
function compileSequence(text) {
    const lines = text.split('\n');
    const program = [];
    
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        let line = rawLine.trim();
        
        // Remove comments
        const commentIdx = line.indexOf(';');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx).trim();
        }
        
        // Skip empty lines, but push a NOP to align indices
        if (line === '') {
            program.push({
                type: 'NOP',
                raw: rawLine,
                lineIdx: i
            });
            continue;
        }
        
        const parts = line.split(/\s+/);
        const commandVerb = parts[0].toUpperCase();
        
        const cmd = {
            type: commandVerb,
            raw: rawLine,
            lineIdx: i,
            args: {}
        };
        
        switch (commandVerb) {
            case 'MOVE':
                // Parse keys X Y Z F
                for (let p = 1; p < parts.length - 1; p += 2) {
                    const key = parts[p].toUpperCase();
                    const val = parseFloat(parts[p+1]);
                    if (['X', 'Y', 'Z', 'F'].includes(key) && !isNaN(val)) {
                        cmd.args[key.toLowerCase()] = val;
                    }
                }
                break;
                
            case 'WAIT':
                cmd.args.duration = parseInt(parts[1]) || 0;
                break;
                
            case 'GRIPPER':
                cmd.args.state = (parts[1] || '').toUpperCase();
                break;
                
            case 'TOOL':
                cmd.args.state = (parts[1] || '').toUpperCase();
                break;
                
            case 'SPEED':
                cmd.args.velocity = parseFloat(parts[1]) || 100.0;
                cmd.args.acceleration = parseFloat(parts[2]) || 150.0;
                break;
                
            case 'HOME':
                // No args needed, targets HOME_POSITION
                break;
                
            default:
                cmd.type = 'ERROR';
                cmd.errorMsg = `Unknown command verb: "${commandVerb}"`;
                break;
        }
        
        program.push(cmd);
    }
    
    return program;
}

/**
 * Compiles a list of compiled tokens into standard CNC G-Code
 * @param {Array} compiledProgram - Tokens from compileSequence()
 * @returns {string} Fully generated G-Code
 */
function generateGCode(compiledProgram) {
    let gcode = [];
    gcode.push('; Generated by MOTION-X Kinematic Exporter');
    gcode.push('; Target: Standard Cartestian CNC (.gcode)');
    gcode.push('; Date: ' + new Date().toISOString());
    gcode.push('');
    
    gcode.push('G90 ; Set Absolute Positioning');
    gcode.push('G21 ; Set Units to Millimeters');
    gcode.push('M82 ; Extruder Absolute Mode');
    gcode.push('');
    
    let defaultFeedrate = 6000; // 100 mm/s in G-code feedrate (mm/min)
    let currentTool = false;
    
    for (const cmd of compiledProgram) {
        if (cmd.type === 'NOP' || cmd.type === 'ERROR') continue;
        
        gcode.push(`; Line ${cmd.lineIdx + 1}: ${cmd.raw.trim()}`);
        
        switch (cmd.type) {
            case 'HOME':
                gcode.push('G28 X0 Y0 Z0 ; Auto Home all axes');
                break;
                
            case 'SPEED':
                const vel = cmd.args.velocity || 100;
                defaultFeedrate = Math.round(vel * 60); // mm/min
                gcode.push(`G0 F${defaultFeedrate} ; Set default movement speed`);
                break;
                
            case 'MOVE':
                const args = [];
                // Scale coordinate parameters to standard metric mm sizes (multiply by 10)
                if (cmd.args.x !== undefined) args.push(`X${(cmd.args.x * 10).toFixed(2)}`);
                if (cmd.args.y !== undefined) args.push(`Y${(cmd.args.y * 10).toFixed(2)}`);
                if (cmd.args.z !== undefined) args.push(`Z${(cmd.args.z * 10).toFixed(2)}`);
                
                const speedFeedrate = cmd.args.f !== undefined ? Math.round(cmd.args.f * 60) : defaultFeedrate;
                args.push(`F${speedFeedrate}`);
                
                gcode.push(`G1 ${args.join(' ')}`);
                break;
                
            case 'WAIT':
                const durationSec = (cmd.args.duration / 1000).toFixed(3);
                gcode.push(`G4 P${durationSec} ; Dwell delay`);
                break;
                
            case 'TOOL':
                if (cmd.args.state === 'ON') {
                    gcode.push('M3 S1000 ; Laser Spindle ON (clockwise)');
                    currentTool = true;
                } else {
                    gcode.push('M5 ; Laser Spindle OFF');
                    currentTool = false;
                }
                break;
                
            case 'GRIPPER':
                if (cmd.args.state === 'CLOSE') {
                    gcode.push('M280 P0 S10 ; Gripper Servo Close (10 degrees)');
                    gcode.push('G4 P0.400 ; Gripper closing time');
                } else {
                    gcode.push('M280 P0 S120 ; Gripper Servo Open (120 degrees)');
                    gcode.push('G4 P0.400 ; Gripper opening time');
                }
                break;
        }
    }
    
    gcode.push('');
    gcode.push('M5 ; Ensure spindle off');
    gcode.push('G28 X0 Y0 ; Return home');
    gcode.push('M84 ; Disable stepper motors');
    
    return gcode.join('\n');
}

/**
 * Compiles a list of compiled tokens into standalone Arduino C++ code
 * @param {Array} compiledProgram - Tokens from compileSequence()
 * @returns {string} Fully generated C++ source code
 */
function generateArduinoCode(compiledProgram) {
    let cpp = [];
    
    cpp.push(`/**
 * MOTION-X GENERATED CONTROLLER FIRMWARE
 * Target: Arduino Mega + 3 Stepper Actuators (waist, shoulder, elbow)
 * Dependencies: AccelStepper library (Install via Arduino Library Manager)
 */

#include <AccelStepper.h>
#include <math.h>

// Robotic Arm Link Constants (scaled to mm)
const double L_BASE = 25.0; // Base stand
const double L_SH   = 40.0; // Shoulder
const double L_EL   = 35.0; // Elbow

// Stepper Steps Per Revolution definitions
const int STEPS_PER_REV = 3200; // 1/16 microstepping on 1.8° stepper

// AccelStepper Pins: (Interface=1, StepPin, DirPin)
AccelStepper stepperWaist(1, 2, 5);
AccelStepper stepperShoulder(1, 3, 6);
AccelStepper stepperElbow(1, 4, 7);

const int PIN_LASER = 9;   // Laser/Tool digital driver pin
const int PIN_SERVO = 10;  // Gripper pulse control

// Task Step Data Structures
enum CmdType { CMD_MOVE, CMD_WAIT, CMD_TOOL, CMD_GRIPPER, CMD_HOME };

struct TaskCommand {
    CmdType type;
    double x;
    double y;
    double z;
    long val; // Wait duration or tool/gripper states (0 = off/open, 1 = on/closed)
};
`);

    // Build static command array
    const validCommands = compiledProgram.filter(c => c.type !== 'NOP' && c.type !== 'ERROR');
    
    cpp.push(`const int NUM_COMMANDS = ${validCommands.length};`);
    cpp.push('const TaskCommand COMMAND_QUEUE[] = {');
    
    for (let i = 0; i < validCommands.length; i++) {
        const cmd = validCommands[i];
        let typeStr = 'CMD_HOME';
        let x = 0.0, y = 0.0, z = 0.0, val = 0;
        
        switch (cmd.type) {
            case 'HOME':
                typeStr = 'CMD_HOME';
                break;
            case 'MOVE':
                typeStr = 'CMD_MOVE';
                x = cmd.args.x !== undefined ? cmd.args.x : 0.0;
                y = cmd.args.y !== undefined ? cmd.args.y : 0.0;
                z = cmd.args.z !== undefined ? cmd.args.z : 0.0;
                val = cmd.args.f !== undefined ? Math.round(cmd.args.f) : 0;
                break;
            case 'WAIT':
                typeStr = 'CMD_WAIT';
                val = cmd.args.duration || 0;
                break;
            case 'TOOL':
                typeStr = 'CMD_TOOL';
                val = cmd.args.state === 'ON' ? 1 : 0;
                break;
            case 'GRIPPER':
                typeStr = 'CMD_GRIPPER';
                val = cmd.args.state === 'CLOSE' ? 1 : 0;
                break;
        }
        
        const isLast = (i === validCommands.length - 1);
        cpp.push(`    { ${typeStr}, ${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}, ${val} }${isLast ? '' : ','} // Line ${cmd.lineIdx + 1}: ${cmd.raw.trim()}`);
    }
    
    cpp.push(`};

int currentCommandIndex = 0;
bool commandStarted = false;
unsigned long waitTimer = 0;

void setup() {
    Serial.begin(115200);
    pinMode(PIN_LASER, OUTPUT);
    digitalWrite(PIN_LASER, LOW);
    
    // Gripper pin
    pinMode(PIN_SERVO, OUTPUT);
    
    // Configure steppers maximum physical limits
    stepperWaist.setMaxSpeed(2000);
    stepperWaist.setAcceleration(3000);
    
    stepperShoulder.setMaxSpeed(2000);
    stepperShoulder.setAcceleration(3000);
    
    stepperElbow.setMaxSpeed(2000);
    stepperElbow.setAcceleration(3000);
    
    Serial.println("System initialized. Starting sequence...");
}

// Analytical Inverse Kinematics Function for Hardware Execution
bool computeIK(double x, double y, double z, double &t1, double &t2, double &t3) {
    t1 = atan2(z, x);
    double r = sqrt(x * x + z * z);
    double yRel = y - L_BASE;
    double d = sqrt(r * r + yRel * yRel);
    
    if (d > (L_SH + L_EL) || d < fabs(L_SH - L_EL)) return false; // Range limits
    
    double alpha = atan2(yRel, r);
    double cosBeta = (L_SH * L_SH + d * d - L_EL * L_EL) / (2 * L_SH * d);
    double beta = acos(constrain(cosBeta, -1.0, 1.0));
    
    t2 = alpha + beta; // Shoulder angle
    
    double cosGamma = (L_SH * L_SH + L_EL * L_EL - d * d) / (2 * L_SH * L_EL);
    double gamma = acos(constrain(cosGamma, -1.0, 1.0));
    t3 = -(PI - gamma); // Elbow angle
    
    return true;
}

// Converts radians to stepper positions (steps)
long radToSteps(double radians) {
    return (long)((radians * STEPS_PER_REV) / (2.0 * PI));
}

void loop() {
    // Check if sequence is complete
    if (currentCommandIndex >= NUM_COMMANDS) {
        Serial.println("Sequence Complete. Steppers idling.");
        while(1) { delay(1000); }
    }
    
    TaskCommand cmd = COMMAND_QUEUE[currentCommandIndex];
    
    // Run the stepper motion updater
    stepperWaist.run();
    stepperShoulder.run();
    stepperElbow.run();
    
    // Check if steppers are currently moving
    bool isMoving = (stepperWaist.distanceToGo() != 0 || 
                    stepperShoulder.distanceToGo() != 0 || 
                    stepperElbow.distanceToGo() != 0);
                    
    if (!commandStarted) {
        // Execute the command action once
        Serial.print("Executing Step: ");
        Serial.println(currentCommandIndex);
        
        switch (cmd.type) {
            case CMD_HOME: {
                double t1, t2, t3;
                if (computeIK(0.0, 6.5, 2.0, t1, t2, t3)) {
                    stepperWaist.moveTo(radToSteps(t1));
                    stepperShoulder.moveTo(radToSteps(t2));
                    stepperElbow.moveTo(radToSteps(t3));
                }
                commandStarted = true;
                break;
            }
            case CMD_MOVE: {
                double t1, t2, t3;
                if (computeIK(cmd.x, cmd.y, cmd.z, t1, t2, t3)) {
                    stepperWaist.moveTo(radToSteps(t1));
                    stepperShoulder.moveTo(radToSteps(t2));
                    stepperElbow.moveTo(radToSteps(t3));
                }
                commandStarted = true;
                break;
            }
            case CMD_WAIT:
                waitTimer = millis() + cmd.val;
                commandStarted = true;
                break;
                
            case CMD_TOOL:
                digitalWrite(PIN_LASER, cmd.val == 1 ? HIGH : LOW);
                delay(50); // Small relay latch debounce
                currentCommandIndex++;
                commandStarted = false;
                break;
                
            case CMD_GRIPPER:
                // PWM pulse emulation for claw servo
                analogWrite(PIN_SERVO, cmd.val == 1 ? 40 : 180); 
                delay(400); // Wait for claw mechanical swing
                currentCommandIndex++;
                commandStarted = false;
                break;
        }
    } else {
        // Check for transition triggers (actions completed)
        switch (cmd.type) {
            case CMD_HOME:
            case CMD_MOVE:
                if (!isMoving) {
                    currentCommandIndex++;
                    commandStarted = false;
                }
                break;
                
            case CMD_WAIT:
                if (millis() >= waitTimer) {
                    currentCommandIndex++;
                    commandStarted = false;
                }
                break;
        }
    }
}
`);
    
    return cpp.join('\n');
}
